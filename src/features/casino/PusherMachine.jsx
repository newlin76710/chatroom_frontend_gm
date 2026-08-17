import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import "./PusherMachine.css";
import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";
import socket from "../../shared/socket";
import PusherGameScene, { GAME_HEIGHT, GAME_WIDTH } from "./pusher/PusherGameScene";
import { closePusherAudio, unlockPusherAudio } from "./pusher/SoundManager";

// 每次投幣固定 1 顆，不再開放自訂投幣數量
const BET = 1;

const DEFAULT_SETTINGS = {
  enabled: true,
  open_hour: 0,
  open_min: 0,
  close_hour: 24,
  close_min: 0,
  plate_speed: "normal",
  jackpotPool: 0,
};

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isOpenNow(settings) {
  if (!settings?.enabled) return false;
  const now = new Date();
  const hour = (now.getUTCHours() + 8) % 24;
  const current = hour * 60 + now.getUTCMinutes();
  const open = Number(settings.open_hour || 0) * 60 + Number(settings.open_min || 0);
  const closeHour = Number(settings.close_hour ?? 24);
  const close = closeHour >= 24 ? 24 * 60 : closeHour * 60 + Number(settings.close_min || 0);
  return current >= open && current < close;
}

function formatHours(settings) {
  if (!settings) return "00:00 - 24:00";
  const open = `${pad2(settings.open_hour || 0)}:${pad2(settings.open_min || 0)}`;
  const close = settings.close_hour >= 24
    ? "24:00"
    : `${pad2(settings.close_hour || 0)}:${pad2(settings.close_min || 0)}`;
  return `${open} - ${close}`;
}

export default function PusherMachine({ token, apples, onApplesChange, demo = false, visible = true }) {
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const sceneRef = useRef(null);
  const controlsRef = useRef(null);
  const applesRef = useRef(apples ?? 0);
  const positionRef = useRef(50);
  const demoTokenIdRef = useRef(1000);
  const demoTokenValueRef = useRef(new Map());
  const jackpotPoolRef = useRef(0);
  const [settings, setSettings] = useState(null);
  const [position, setPosition] = useState(50);
  const [message, setMessage] = useState("");
  const [jackpotPool, setJackpotPool] = useState(0);
  jackpotPoolRef.current = jackpotPool;
  const [sessionWin, setSessionWin] = useState(0);
  const [jackpotPopup, setJackpotPopup] = useState(null);
  const [dailyCapInfo, setDailyCapInfo] = useState(null);

  const currencyIcon = `/gifts/${roomConfig.currency_icon}`;
  const currencyName = roomConfig.currency_name || "金蘋果";
  const open = isOpenNow(settings);
  // 每日淨賺上限只影響「入帳金額」（見後端 /pusher/collect），達到上限後仍可以繼續投幣、繼續輸，
  // 不會整台機器被鎖住——賺錢封頂，輸錢不封頂。

  useEffect(() => {
    applesRef.current = apples ?? 0;
    sceneRef.current?.setExternalState({ balance: apples ?? 0 });
    controlsRef.current?.setState({ balance: apples ?? 0 });
  }, [apples]);

  useEffect(() => {
    positionRef.current = position;
    sceneRef.current?.setExternalState({ position });
    controlsRef.current?.setState({ position });
  }, [position]);

  // 面板切到背景（切分頁/關閉遊樂場）時讓 Phaser 進入休眠，避免物理模擬持續耗費效能；
  // 重新顯示時喚醒即可，桌面上的幣局不會被重新排列。
  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (visible) game.loop.wake();
    else game.loop.sleep();
  }, [visible]);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      if (demo) {
        const next = { ...DEFAULT_SETTINGS, special_chance_pct: 18, jackpotPool: 500 };
        setSettings(next);
        setJackpotPool(next.jackpotPool);
        return;
      }
      if (!token) {
        setSettings(DEFAULT_SETTINGS);
        setJackpotPool(0);
        return;
      }
      try {
        const res = await fetch(`${BACKEND}/api/pusher/settings?room=${encodeURIComponent(RN)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled) {
          const next = { ...DEFAULT_SETTINGS, ...data };
          setSettings(next);
          setJackpotPool(Number(next.jackpotPool || 0));
          setDailyCapInfo({ netProfit: Number(data.dailyNetProfit || 0), cap: Number(data.dailyCap || 100) });
        }
      } catch {
        if (!cancelled) setSettings(DEFAULT_SETTINGS);
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, [demo, token]);

  useEffect(() => {
    if (!settings) return;
    sceneRef.current?.setExternalState({
      plateSpeed: settings.plate_speed || "normal",
      enabled: settings.enabled && open,
    });
    controlsRef.current?.setState({
      plateSpeed: settings.plate_speed || "normal",
      enabled: settings.enabled && open,
    });
  }, [settings, open]);

  useEffect(() => {
    const onPool = ({ jackpotPool: nextPool }) => setJackpotPool(Number(nextPool || 0));
    const onJackpot = ({ username, amount }) => {
      setMessage(`${username} 推落 Jackpot，獲得 ${amount} ${currencyName}`);
      setTimeout(() => setMessage(""), 4200);
    };
    socket.on("pusherPoolUpdate", onPool);
    socket.on("pusherJackpot", onJackpot);
    return () => {
      socket.off("pusherPoolUpdate", onPool);
      socket.off("pusherJackpot", onJackpot);
    };
  }, [currencyName]);

  const insertCoin = useCallback(async () => {
    if (demo) {
      if ((applesRef.current || 0) < BET) throw new Error("試玩餘額不足");
      // 試玩機率跟正式後端 pusherMachine.js 的 special_chance_pct=4% 對齊，方便測手感
      const kinds = [
        { kind: "coin", multiplier: 1, weight: 960 },
        { kind: "diamond", multiplier: 2, weight: 16 },
        { kind: "car", multiplier: 3, weight: 12 },
        { kind: "plane", multiplier: 4, weight: 11 },
        { kind: "jackpot", multiplier: 0, weight: 1 },
      ];
      const total = kinds.reduce((sum, item) => sum + item.weight, 0);
      let roll = Math.random() * total;
      const picked = kinds.find((item) => {
        roll -= item.weight;
        return roll <= 0;
      }) || kinds[0];
      const tokenId = demoTokenIdRef.current++;
      const value = picked.kind === "jackpot" ? null : Math.max(1, Math.round(BET * picked.multiplier));
      applesRef.current -= BET;
      demoTokenValueRef.current.set(tokenId, { kind: picked.kind, value });
      onApplesChange?.(applesRef.current);
      // 獎池提撥比例以小數累積，避免固定投 1 顆時每次都無條件捨去到 0
      setJackpotPool((pool) => pool + BET * 0.3);
      return { tokenId, kind: picked.kind, value, newApples: applesRef.current };
    }

    const res = await fetch(`${BACKEND}/api/pusher/insert`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bet: BET, room: RN }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "投幣失敗");
    applesRef.current = Number(data.newApples ?? applesRef.current);
    onApplesChange?.(applesRef.current);
    if (data.dailyCap != null) {
      setDailyCapInfo({ netProfit: Number(data.dailyNetProfit || 0), cap: Number(data.dailyCap || 100) });
    }
    setMessage("");
    return data;
  }, [demo, onApplesChange, token]);

  const collectDrops = useCallback(async (tokenIds) => {
    if (demo) {
      let credited = 0;
      let jackpotHit = false;
      let jackpotAmount = 0;
      for (const id of tokenIds) {
        const tokenInfo = demoTokenValueRef.current.get(id);
        if (!tokenInfo) continue;
        demoTokenValueRef.current.delete(id);
        if (tokenInfo.kind === "jackpot") {
          jackpotHit = true;
          jackpotAmount += Math.floor(jackpotPoolRef.current * 0.6);
        } else {
          credited += Number(tokenInfo.value || 0);
        }
      }
      if (jackpotHit) {
        credited += jackpotAmount;
        setJackpotPool((pool) => Math.max(0, pool - jackpotAmount));
        setJackpotPopup({ amount: jackpotAmount });
      }
      applesRef.current += credited;
      onApplesChange?.(applesRef.current);
      if (credited > 0) setSessionWin((value) => value + credited);
      return { credited, newApples: applesRef.current, jackpotHit, jackpotAmount };
    }

    const res = await fetch(`${BACKEND}/api/pusher/collect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tokenIds, room: RN }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "結算失敗");
    applesRef.current = Number(data.newApples ?? applesRef.current);
    onApplesChange?.(applesRef.current);
    if (data.credited > 0) setSessionWin((value) => value + Number(data.credited || 0));
    if (data.jackpotHit) setJackpotPopup({ amount: data.jackpotAmount });
    if (data.dailyCap != null) {
      setDailyCapInfo({ netProfit: Number(data.dailyNetProfit || 0), cap: Number(data.dailyCap || 100) });
    }
    if (data.capped && data.message) {
      setMessage(data.message);
      setTimeout(() => setMessage(""), 3200);
    }
    return data;
  }, [demo, onApplesChange, token]);

  // insertCoin/collectDrops 會隨 state 改變而重新產生；用 ref 轉接讓 services
  // 物件本身永遠保持同一個參考，避免 Phaser game 因為 services 變了而被重建，
  // 導致正在進行中的物理世界（含尚未回報的掉落硬幣）被整個銷毀重來。
  const insertCoinRef = useRef(insertCoin);
  useEffect(() => { insertCoinRef.current = insertCoin; }, [insertCoin]);
  const collectDropsRef = useRef(collectDrops);
  useEffect(() => { collectDropsRef.current = collectDrops; }, [collectDrops]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const openRef = useRef(open);
  openRef.current = open;

  const services = useMemo(() => ({
    insertCoin: (...args) => insertCoinRef.current(...args),
    collectDrops: (...args) => collectDropsRef.current(...args),
    onMessage: (text) => {
      setMessage(text);
      if (text) setTimeout(() => setMessage(""), 2600);
    },
    onReady: (controls) => {
      controlsRef.current = controls;
      controls.setState({
        bet: BET,
        position: positionRef.current,
        balance: applesRef.current,
        plateSpeed: settingsRef.current?.plate_speed || "normal",
        enabled: settingsRef.current?.enabled && openRef.current,
      });
    },
  }), []);

  useEffect(() => {
    if (!settings || !hostRef.current || gameRef.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: "#111817",
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: "matter",
        matter: {
          debug: false,
          enableSleeping: false,
        },
      },
      scene: [],
      input: {
        activePointers: 3,
      },
    });
    gameRef.current = game;
    if (!visible) game.loop.sleep();
    game.scene.add("PusherGameScene", PusherGameScene, true, {
      services,
      initialState: {
        bet: BET,
        position: positionRef.current,
        balance: applesRef.current,
        plateSpeed: settings.plate_speed || "normal",
        enabled: settings.enabled && open,
      },
    });
    const scene = game.scene.getScene("PusherGameScene");
    sceneRef.current = scene;
    return () => {
      sceneRef.current = null;
      controlsRef.current = null;
      game.destroy(true);
      gameRef.current = null;
      closePusherAudio();
    };
  }, [open, services, settings]);

  useEffect(() => {
    sceneRef.current?.setExternalState({
      bet: BET,
      position,
      balance: apples ?? 0,
      plateSpeed: settings?.plate_speed || "normal",
      enabled: settings?.enabled && open,
    });
    controlsRef.current?.setState({
      bet: BET,
      position,
      balance: apples ?? 0,
      plateSpeed: settings?.plate_speed || "normal",
      enabled: settings?.enabled && open,
    });
  }, [apples, open, position, settings]);

  const quickDrop = () => {
    unlockPusherAudio();
    controlsRef.current?.quickDrop(positionRef.current);
  };

  if (!settings) {
    return <div className="pusher-shell pusher-empty">推幣機載入中...</div>;
  }

  if (!settings.enabled) {
    return (
      <div className="pusher-shell pusher-empty">
        <h2>推幣機暫停開放</h2>
        <p>請稍後再來試試手氣。</p>
      </div>
    );
  }

  return (
    <div className="pusher-shell">
      <header className="pusher-topbar">
        <div>
          <h1>SEGA 風格推幣機</h1>
          <span className={`pusher-status ${open ? "is-open" : "is-closed"}`}>
            {demo ? "試玩模式" : open ? "營業中" : "休息中"} {formatHours(settings)}
          </span>
        </div>
        <div className="pusher-bank">
          <span>Jackpot {Math.floor(jackpotPool)}</span>
          <span>本局收益 {sessionWin}</span>
        </div>
      </header>

      <div className="pusher-layout">
        <section className="pusher-stage" aria-label="Phaser 推幣機遊戲">
          <div ref={hostRef} className="pusher-phaser-host" />
          {!open && <div className="pusher-stage-lock">目前非營業時間</div>}
        </section>

        <aside className="pusher-controls">
          <div className="pusher-balance">
            <img src={currencyIcon} alt="" />
            <span>{apples ?? 0}</span>
            <small>{currencyName}</small>
          </div>

          {dailyCapInfo && (
            <div className="pusher-control-group">
              <label>今日淨賺 {Math.min(dailyCapInfo.netProfit, dailyCapInfo.cap)} / {dailyCapInfo.cap} {currencyName}</label>
            </div>
          )}

          <div className="pusher-control-group">
            <label htmlFor="pusher-position">出幣位置 {position < 40 ? "◀ 偏左" : position > 60 ? "偏右 ▶" : "中間"}</label>
            <input
              id="pusher-position"
              type="range"
              min="0"
              max="100"
              value={position}
              onChange={(event) => setPosition(Number(event.target.value))}
            />
          </div>

          <button type="button" className="pusher-launch" onClick={quickDrop} disabled={!open || (!token && !demo)}>
            投幣 (每次 1 顆)
          </button>
          {dailyCapInfo && dailyCapInfo.netProfit >= dailyCapInfo.cap && (
            <div className="pusher-tips">今日淨賺已達上限，之後掉落的獎品不會再入帳，但仍可以繼續投幣。</div>
          )}

          <div className="pusher-tips">
            用左右滑桿選擇出幣位置後按「投幣」直線落下；也可以直接拖曳台面瞄準方向與力度。推板前慢後快，硬幣會因靜摩擦卡住後連鎖滑落。
          </div>
        </aside>
      </div>

      {message && <div className="pusher-toast">{message}</div>}

      {jackpotPopup && (
        <div className="pusher-jackpot-popup" onClick={() => setJackpotPopup(null)}>
          <div className="pusher-jackpot-card">
            <h2>JACKPOT</h2>
            <strong>+{jackpotPopup.amount}</strong>
            <span>{currencyName}</span>
          </div>
        </div>
      )}
    </div>
  );
}
