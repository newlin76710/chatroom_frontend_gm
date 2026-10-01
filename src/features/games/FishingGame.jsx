// FishingGame.jsx — 多人共用血池捕魚（僅金幣模式）。
// 大尺寸半透明彈窗，可拖曳、可收合成右下角懸浮圖示（邊玩邊看歌詞/聽歌）。
// 魚群由後端 fishingGame.js 產生，前端只拿到每條魚的 spawnAt/duration/方向/高度，
// 用 requestAnimationFrame 自己算座標（不需要伺服器每幀廣播）。點魚 = 開一竿，扣款/傷害/
// 尾刀判定/派彩全部由伺服器決定，這裡只負責畫面與打擊感特效。
// BOSS 被擊殺的全大廳霸屏金幣雨在 ChatApp.jsx（fishingJackpot 事件），這裡只放彈窗內的爆炸特效。

import { useState, useEffect, useRef, useCallback } from "react";
import "./FishingGame.css";
import { RN, roomConfig } from "../../shared/roomConfig";
import { useDraggableWindow } from "../../shared/hooks/useDraggableWindow";

const CLIENT_SHOT_COOLDOWN = 180;
// 只用舊版 Windows/Android 也有的 emoji（🪝🪱🪸🪨🪙 這類 Emoji 13+ 在舊系統會變方框）
const ROD_ICONS = ["🎣", "⚓", "🔱", "👑", "💎"];
// 平台 Logo 浮水印：圖檔放 public/fishing-logo.png，檔案不存在時自動隱藏
const WATERMARK_SRC = "/fishing-logo.png";
const fmt = (n) => Number(n || 0).toLocaleString("en-US");

function fishPos(f, now) {
  const p = (now - f.spawnAt) / f.duration;
  const x = f.dir === 1 ? -0.12 + 1.24 * p : 1.12 - 1.24 * p;
  const y = (f.y + f.amp * Math.sin(p * Math.PI * 4)) / 100;
  return { p, x, y };
}

// speed：後台「魚隻游動速度」（%）。BOSS（魷魚王等）的游動節奏也跟著調整；
// 用伺服器時間當相位，所有裝置同一時間看到的 BOSS 位置一致
function bossPos(now, speed = 100) {
  const t = (now * speed) / 100;
  return { x: 0.5 + 0.26 * Math.sin(t / 5200), y: 0.4 + 0.1 * Math.sin(t / 3100) };
}

// demo：/fishing-demo 展示頁用，略過「僅金幣房間」的顯示條件
export default function FishingGame({ socket, token, name, apples, setApples, open, onOpenChange, demo = false }) {
  const [minimized, setMinimized] = useState(false);
  const [fishList, setFishList] = useState([]);
  const [boss, setBoss] = useState(null);
  const [poolAmount, setPoolAmount] = useState(0);
  const [rodBets, setRodBets] = useState(() => String(roomConfig.fishing_rod_bets || "100,500,1000,5000,10000").split(",").map(Number));
  const [rodNames, setRodNames] = useState(["初級竿", "中級竿", "高級竿", "王者竿", "帝王神竿"]);
  const [rod, setRod] = useState(0);
  const [freeShots, setFreeShots] = useState(0);
  const [useBait, setUseBait] = useState(false);
  const [nextBoss, setNextBoss] = useState(null); // { tierLabel, name, emoji, threshold, payoutPct }：下一隻要召喚的 BOSS
  const [watermarkOk, setWatermarkOk] = useState(true);
  const [perms, setPerms] = useState({ canSummon: false, canResetPool: false, seedPool: 0 });
  const [toast, setToast] = useState("");
  const [warning, setWarning] = useState(false);
  const [lobbyAlert, setLobbyAlert] = useState(null); // { pool, boss }
  const [connected, setConnected] = useState(false);
  const [joinSlow, setJoinSlow] = useState(false); // 送出加入後遲遲等不到伺服器快照

  const { windowRef, onPointerDown } = useDraggableWindow();
  const pondRef = useRef(null);
  const fxRef = useRef(null);
  const cannonRef = useRef(null);
  const fishDataRef = useRef(new Map()); // id → fish
  const fishElRef = useRef(new Map());   // id → element
  const bossRef = useRef(null);
  const bossElRef = useRef(null);
  const offsetRef = useRef(0);
  const rttRef = useRef(Infinity);   // 目前時鐘差樣本的往返時間，越小越準
  const speedRef = useRef(Number(roomConfig.fishing_fish_speed) || 100);
  const lastShotRef = useRef(0);
  const sizeRef = useRef({ w: 800, h: 450 });
  const tokenRef = useRef(token);
  const nameRef = useRef(name);
  const openRef = useRef(open);
  const toastTimer = useRef(null);
  const connectedRef = useRef(false);

  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { nameRef.current = name; }, [name]);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { connectedRef.current = connected; if (connected) setJoinSlow(false); }, [connected]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  const serverNow = () => Date.now() + offsetRef.current;

  const syncFishList = useCallback(() => {
    setFishList(Array.from(fishDataRef.current.values()).map((f) => ({ ...f })));
  }, []);

  // ── 特效工具（直接操作 DOM，避免每個粒子都觸發 React 重繪） ──
  const spawnFx = useCallback((className, x, y, text, life = 1000, style = {}) => {
    const layer = fxRef.current;
    if (!layer) return null;
    const el = document.createElement("div");
    el.className = className;
    if (text !== undefined) el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    Object.assign(el.style, style);
    layer.appendChild(el);
    setTimeout(() => el.remove(), life);
    return el;
  }, []);

  const coinBurst = useCallback((x, y, count, big = false) => {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = (big ? 90 : 50) + Math.random() * (big ? 160 : 70);
      const sparkle = Math.random() < 0.2;
      spawnFx(sparkle ? "fg-coin fg-coin-sparkle" : "fg-coin fg-coin-disc", x, y, sparkle ? "✨" : "", 1100, {
        "--dx": `${Math.cos(ang) * dist}px`,
        "--dy": `${Math.sin(ang) * dist - (big ? 40 : 20)}px`,
        "--size": `${(big ? 18 : 12) + Math.random() * (big ? 14 : 8)}px`,
        fontSize: `${(big ? 20 : 14) + Math.random() * (big ? 16 : 8)}px`,
        animationDelay: `${Math.random() * 0.12}s`,
      });
    }
  }, [spawnFx]);

  const targetScreenPos = useCallback((fishId) => {
    const { w, h } = sizeRef.current;
    const now = serverNow();
    if (fishId === "boss") {
      const b = bossPos(now, speedRef.current);
      return { x: b.x * w, y: b.y * h };
    }
    const f = fishDataRef.current.get(fishId);
    if (!f) return null;
    const { x, y } = fishPos(f, now);
    return { x: x * w, y: y * h };
  }, []);

  const shake = useCallback((strong) => {
    const el = windowRef.current;
    if (!el) return;
    el.classList.remove("fg-shake", "fg-shake-strong");
    void el.offsetWidth;
    el.classList.add(strong ? "fg-shake-strong" : "fg-shake");
    setTimeout(() => el.classList.remove("fg-shake", "fg-shake-strong"), 700);
  }, [windowRef]);

  // ── 動畫迴圈：更新每條魚/BOSS 的位置，游出畫面的魚自動移除 ──
  useEffect(() => {
    if (!open || minimized) return;
    let raf;
    // 用 clientWidth/clientHeight（不受開窗縮放動畫的 transform 影響），並用 ResizeObserver 追蹤
    // 池塘尺寸：手機上標題列換行、按鈕列展開、網址列收合都不會觸發 window resize，原本只在
    // resize 時量一次，量到的是錯的尺寸，魚在手機上走的像素距離跟實際池塘對不上 → 看起來跟電腦版速度不同
    const measure = () => {
      const el = pondRef.current;
      if (el && el.clientWidth > 0) sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" && pondRef.current ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(pondRef.current);
    const loop = () => {
      const now = serverNow();
      // 後台改游速會透過 roomConfigUpdate 即時寫進 roomConfig，BOSS 節奏跟著更新
      speedRef.current = Number(roomConfig.fishing_fish_speed) || speedRef.current;
      const { w, h } = sizeRef.current;
      let removed = false;
      for (const [id, f] of fishDataRef.current) {
        const { p, x, y } = fishPos(f, now);
        if (p > 1.02) {
          fishDataRef.current.delete(id);
          removed = true;
          continue;
        }
        const el = fishElRef.current.get(id);
        if (el) el.style.transform = `translate3d(${x * w}px, ${y * h}px, 0) translate(-50%, -50%)`;
      }
      if (bossRef.current && bossElRef.current) {
        const b = bossPos(now, speedRef.current);
        bossElRef.current.style.transform = `translate3d(${b.x * w}px, ${b.y * h}px, 0) translate(-50%, -50%)`;
      }
      if (removed) syncFishList();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, [open, minimized, syncFishList]);

  // ── 加入/離開觀戰頻道 ──
  // 伺服器沒回快照時每 3 秒自動重試，6 秒後顯示原因（例如後端還沒更新到有捕魚遊戲的版本）。
  // 斷線重連（例如後端重新部署）時一定要重新加入：伺服器重啟後記憶體裡的 token 會清空，
  // 要等聊天室的 joinRoom 重新登記 token 之後 fishingJoin 才會被受理，所以重連後先標記成
  // 「未連線」、稍等一下再加入，沒成功就交給重試機制，不會再出現「魚游完就沒有新魚」卡住的情況
  useEffect(() => {
    if (!open) return;
    const join = () => socket.emit("fishingJoin", { token: tokenRef.current, room: RN });
    let slowTimer = setTimeout(() => setJoinSlow(true), 6000);
    const onReconnect = () => {
      connectedRef.current = false;
      setConnected(false);
      clearTimeout(slowTimer);
      slowTimer = setTimeout(() => setJoinSlow(true), 8000);
      setTimeout(join, 1000);
    };
    const onDisconnect = () => { connectedRef.current = false; setConnected(false); };
    join();
    socket.on("connect", onReconnect);
    socket.on("disconnect", onDisconnect);
    const retryTimer = setInterval(() => { if (!connectedRef.current) join(); }, 3000);
    return () => {
      clearTimeout(slowTimer);
      clearInterval(retryTimer);
      socket.off("connect", onReconnect);
      socket.off("disconnect", onDisconnect);
      socket.emit("fishingLeave", { room: RN });
      setConnected(false);
      setJoinSlow(false);
    };
  }, [open, socket]);

  // ── 時鐘校正（NTP 式）：送出時間 t0 → 伺服器回 serverNow → 用往返時間的一半扣掉網路延遲。
  // 連續取樣、只留往返時間最短（最準）的那筆，之後每 15 秒再校一次，手機跟電腦的魚位置才會同步
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const sample = () => {
      if (typeof socket.timeout !== "function") return; // /fishing-demo 的假 socket 沒有網路延遲，不用校正
      const t0 = Date.now();
      socket.timeout(3000).emit("fishingTimeSync", { t0 }, (err, d) => {
        if (cancelled || err || !d?.serverNow) return;
        const t1 = Date.now();
        const rtt = t1 - t0;
        // 舊樣本放寬一點（網路狀況會變），避免永遠卡在很久以前的一筆
        if (rtt <= rttRef.current * 1.5 + 20) {
          rttRef.current = rtt;
          offsetRef.current = d.serverNow + rtt / 2 - t1;
        }
      });
    };
    rttRef.current = Infinity;
    const burst = [0, 300, 700, 1200].map((ms) => setTimeout(sample, ms));
    const periodic = setInterval(sample, 15000);
    return () => { cancelled = true; burst.forEach(clearTimeout); clearInterval(periodic); };
  }, [open, socket]);

  // ── Socket 事件 ──
  useEffect(() => {
    const onSnapshot = (d) => {
      if (!Number.isFinite(rttRef.current)) offsetRef.current = d.serverNow - Date.now();
      if (d.fishSpeed) { speedRef.current = Number(d.fishSpeed) || 100; roomConfig.fishing_fish_speed = speedRef.current; }
      fishDataRef.current = new Map((d.fish || []).map((f) => [f.id, f]));
      bossRef.current = d.boss || null;
      setBoss(d.boss || null);
      setPoolAmount(d.pool || 0);
      if (Array.isArray(d.rodBets)) setRodBets(d.rodBets);
      if (Array.isArray(d.rodNames)) setRodNames(d.rodNames);
      setFreeShots(d.freeShots || 0);
      setNextBoss(d.nextBoss || null);
      setPerms({ canSummon: !!d.canSummon, canResetPool: !!d.canResetPool, seedPool: d.seedPool || 0 });
      setConnected(true);
      syncFishList();
    };
    const onSpawn = ({ fish, serverNow: sn }) => {
      // 尚未完成往返校正時才用事件夾帶的時間粗估（這個值少算了網路延遲，校正完就不再用）
      if (sn && !Number.isFinite(rttRef.current)) offsetRef.current = offsetRef.current * 0.8 + (sn - Date.now()) * 0.2;
      fishDataRef.current.set(fish.id, fish);
      syncFishList();
    };
    const onHit = ({ fishId, shooter, damage, hp, pool, rod: shotRod }) => {
      setPoolAmount(pool);
      const mine = shooter === nameRef.current;
      if (fishId === "boss") {
        if (bossRef.current) {
          bossRef.current = { ...bossRef.current, hp };
          setBoss(bossRef.current);
        }
      } else {
        const f = fishDataRef.current.get(fishId);
        if (f) {
          f.hp = hp;
          syncFishList();
        }
      }
      const pos = targetScreenPos(fishId);
      if (!pos) return;
      const el = fishId === "boss" ? bossElRef.current : fishElRef.current.get(fishId);
      if (el) {
        el.classList.remove("fg-hit");
        void el.offsetWidth;
        el.classList.add("fg-hit");
      }
      // 一般魚沒有血量（每竿獨立判定擊殺，伺服器傳 damage 0），只有 BOSS 才飄傷害數字
      if (damage > 0) spawnFx(`fg-dmg${mine ? " fg-dmg-mine" : ""}${shotRod >= 3 ? " fg-dmg-king" : ""}`, pos.x + (Math.random() * 30 - 15), pos.y - 20, `-${damage}`, 900);
      if (!mine) spawnFx("fg-net fg-net-other", pos.x, pos.y, undefined, 500);
    };
    const onCatch = ({ fishId, shooter, payout, isBoss, name: fname, emoji, mult, tier, nextBoss: nb, crit, hits }) => {
      const pos = targetScreenPos(fishId) || { x: sizeRef.current.w / 2, y: sizeRef.current.h / 2 };
      const mine = shooter === nameRef.current;
      if (isBoss) {
        bossRef.current = null;
        setBoss(null);
        if (nb !== undefined) setNextBoss(nb);
        spawnFx("fg-boss-explode", pos.x, pos.y, undefined, 1600);
        coinBurst(pos.x, pos.y, 60, true);
        spawnFx("fg-catch-banner fg-catch-boss", sizeRef.current.w / 2, sizeRef.current.h * 0.42,
          `${emoji} ${shooter} 斬殺${fname}！+${fmt(payout)}`, 3200);
        shake(true);
      } else {
        fishDataRef.current.delete(fishId);
        syncFishList();
        const big = tier === "large";
        spawnFx(`fg-splash${big ? " fg-splash-big" : ""}`, pos.x, pos.y, undefined, 900);
        coinBurst(pos.x, pos.y, big ? 36 : tier === "mid" ? 18 : 9, big);
        spawnFx(`fg-payout${mine ? " fg-payout-mine" : ""}${big ? " fg-payout-big" : ""}`, pos.x, pos.y - 30,
          `${emoji} +${fmt(payout)}`, 1600);
        if (big || crit || (mine && tier === "mid")) {
          spawnFx("fg-catch-banner", sizeRef.current.w / 2, sizeRef.current.h * 0.3,
            crit
              ? `⚡暴擊！${mine ? "" : `${shooter} `}${hits} 竿秒殺 ${emoji}${fname} ×${mult}`
              : `${mine ? "大豐收！" : `${shooter} 釣起`} ${emoji}${fname} ×${mult}`, 2200);
          if (big) shake(false);
        }
      }
    };
    const onBossSpawn = ({ boss: b }) => {
      bossRef.current = b;
      setBoss(b);
      setWarning(true);
      shake(true);
      setTimeout(() => setWarning(false), 2600);
    };
    const onShotFail = ({ reason, balance, freeShots: fs }) => {
      if (reason) showToast(reason);
      if (typeof balance === "number") { setApples?.(balance); sessionStorage.setItem("apples", balance); }
      if (typeof fs === "number") setFreeShots(fs);
    };
    const onShotAck = ({ balance, freeShots: fs }) => {
      if (typeof balance === "number") { setApples?.(balance); sessionStorage.setItem("apples", balance); }
      if (typeof fs === "number") {
        setFreeShots(fs);
        if (fs === 0) setUseBait(false);
      }
    };
    const onPool = ({ pool }) => setPoolAmount(pool);
    const onError = ({ reason }) => showToast(reason || "發生錯誤");
    const onFreeShots = ({ freeShots: fs }) => setFreeShots(fs);
    const onBossAlert = ({ pool, boss: b }) => {
      if (openRef.current) return;
      setLobbyAlert({ pool, boss: b });
      setTimeout(() => setLobbyAlert(null), 9000);
    };

    socket.on("fishingSnapshot", onSnapshot);
    socket.on("fishingSpawn", onSpawn);
    socket.on("fishingHit", onHit);
    socket.on("fishingCatch", onCatch);
    socket.on("fishingBossSpawn", onBossSpawn);
    socket.on("fishingShotFail", onShotFail);
    socket.on("fishingShotAck", onShotAck);
    socket.on("fishingPool", onPool);
    socket.on("fishingError", onError);
    socket.on("fishingFreeShots", onFreeShots);
    socket.on("fishingBossAlert", onBossAlert);
    return () => {
      socket.off("fishingSnapshot", onSnapshot);
      socket.off("fishingSpawn", onSpawn);
      socket.off("fishingHit", onHit);
      socket.off("fishingCatch", onCatch);
      socket.off("fishingBossSpawn", onBossSpawn);
      socket.off("fishingShotFail", onShotFail);
      socket.off("fishingShotAck", onShotAck);
      socket.off("fishingPool", onPool);
      socket.off("fishingError", onError);
      socket.off("fishingFreeShots", onFreeShots);
      socket.off("fishingBossAlert", onBossAlert);
    };
  }, [socket, setApples, syncFishList, targetScreenPos, spawnFx, coinBurst, shake, showToast]);

  // ── 開竿 ──
  const shoot = (fishId, e) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastShotRef.current < CLIENT_SHOT_COOLDOWN) return;
    const baiting = useBait && freeShots > 0;
    if (!baiting && apples != null && apples < rodBets[rod]) {
      showToast(`金幣不足，${rodNames[rod]}每竿需 ${fmt(rodBets[rod])}`);
      return;
    }
    lastShotRef.current = now;
    const rect = pondRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // 砲台轉向 + 發射軌跡 + 網子
    const cx = rect.width / 2;
    const cy = rect.height;
    const angle = Math.atan2(y - cy, x - cx) * (180 / Math.PI) + 90;
    if (cannonRef.current) cannonRef.current.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    const shotRod = baiting ? 0 : rod;
    const bullet = spawnFx(`fg-bullet fg-bullet-${shotRod}`, cx, cy - 30, ROD_ICONS[shotRod], 400);
    if (bullet) {
      requestAnimationFrame(() => {
        bullet.style.transform = `translate(${x - cx}px, ${y - cy + 30}px) translate(-50%, -50%) scale(1.2)`;
        bullet.style.opacity = "0.2";
      });
    }
    setTimeout(() => spawnFx(`fg-net fg-net-${shotRod}`, x, y, undefined, 600), 160);
    socket.emit("fishingShoot", { token: tokenRef.current, room: RN, fishId, rod: shotRod, useBait: baiting });
  };

  if (!demo && (roomConfig.currency_name !== "金幣" || roomConfig.fishing_enabled === false)) return null;

  const bossProgress = nextBoss?.threshold > 0 ? Math.min(1, poolAmount / nextBoss.threshold) : 0;

  return (
    <>
      {/* 大廳提示：BOSS 出現（彈窗沒開時） */}
      {lobbyAlert && !open && (
        <div className="fg-lobby-alert">
          <span>{lobbyAlert.boss?.emoji || "🐉"} {lobbyAlert.boss ? `${lobbyAlert.boss.tierLabel} BOSS「${lobbyAlert.boss.name}」` : "BOSS"}現身捕魚池！血池 {fmt(lobbyAlert.pool)}</span>
          <button onClick={() => { setLobbyAlert(null); setMinimized(false); onOpenChange(true); }}>前往挑戰</button>
          <button className="fg-lobby-alert-close" onClick={() => setLobbyAlert(null)}>✖</button>
        </div>
      )}

      {open && minimized && (
        <button className="fg-mini" onClick={() => setMinimized(false)} title="展開捕魚池">
          <span className="fg-mini-icon">{boss ? boss.emoji : "🎣"}</span>
          <span className="fg-mini-pool">💰{fmt(poolAmount)}</span>
        </button>
      )}

      {open && (
        <div className={`fg-window${minimized ? " fg-hidden" : ""}${boss ? " fg-boss-mode" : ""}`} ref={windowRef}>
          <div className="fg-header" onPointerDown={onPointerDown} title="按住拖曳">
            <span className="fg-title">🎣 深海捕魚・共用血池</span>
            <div className="fg-pool">
              <span className="fg-pool-label">血池</span>
              <span className="fg-pool-amount">💰 {fmt(poolAmount)}</span>
            </div>
            <div className="fg-header-btns">
              <button onClick={() => setMinimized(true)} title="收合">—</button>
              <button onClick={() => { setMinimized(false); onOpenChange(false); }} title="關閉">✖</button>
            </div>
          </div>

          <div className="fg-pond" ref={pondRef}>
            <div className="fg-rays" />
            {watermarkOk ? (
              <img className="fg-watermark" src={WATERMARK_SRC} alt="" draggable={false} onError={() => setWatermarkOk(false)} />
            ) : (
              // 尚無正式 Logo 圖檔時的文字版佔位
              <div className="fg-radio-logo" aria-hidden="true">
                <span className="fg-radio-logo-icon">📻</span>
                <span className="fg-radio-logo-text">
                  <span className="fg-radio-logo-title">忘年音樂電台團隊</span>
                  <span className="fg-radio-logo-sub">WANGNIAN RADIO TEAM</span>
                </span>
              </div>
            )}
            <div className="fg-bubbles">
              {Array.from({ length: 14 }).map((_, i) => (
                <span key={i} style={{ left: `${(i * 7.3) % 100}%`, animationDelay: `${(i * 0.9) % 6}s`, animationDuration: `${5 + (i % 5)}s` }} />
              ))}
            </div>
            <div className="fg-seabed">🌿 🐚 🦀 🌾 ⭐ 🌿 🐚 🌾 🦀 🌿</div>

            {fishList.map((f) => (
              <div
                key={f.id}
                className={`fg-fish fg-tier-${f.tier}`}
                ref={(el) => { if (el) fishElRef.current.set(f.id, el); else fishElRef.current.delete(f.id); }}
                onPointerDown={(e) => shoot(f.id, e)}
              >
                <span className="fg-fish-emoji" style={{ transform: f.dir === 1 ? "scaleX(-1)" : "none" }}>{f.emoji}</span>
                <span className="fg-fish-mult">×{f.mult}</span>
              </div>
            ))}

            {boss && (
              <div className="fg-boss" ref={bossElRef} onPointerDown={(e) => shoot("boss", e)}>
                <span className="fg-boss-aura" />
                <span className="fg-boss-emoji">{boss.emoji}</span>
              </div>
            )}

            {boss && (
              <div className="fg-boss-bar">
                <span className="fg-boss-bar-name">{boss.emoji} {boss.tierLabel} BOSS・{boss.name}・尾刀獨得血池 {boss.payoutPct}%</span>
                <span className="fg-boss-bar-track"><i style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} /></span>
              </div>
            )}

            {warning && (
              <div className="fg-warning">
                <div className="fg-warning-text">⚠ WARNING ⚠</div>
                <div className="fg-warning-sub">{boss ? `${boss.tierLabel} BOSS「${boss.name}」來襲！` : "BOSS 來襲！"}</div>
              </div>
            )}

            <div className="fg-fx" ref={fxRef} />
            <div className="fg-cannon" ref={cannonRef}>{ROD_ICONS[useBait && freeShots > 0 ? 0 : rod]}</div>

            {!connected && (
              <div className={`fg-loading${joinSlow ? " fg-loading-slow" : ""}`}>
                {joinSlow ? "捕魚池伺服器沒有回應（伺服器可能尚未更新），自動重試中…" : "連線到捕魚池中…"}
              </div>
            )}
            {toast && <div className="fg-toast">{toast}</div>}
          </div>

          <div className="fg-footer">
            <div className="fg-rods">
              {rodBets.map((bet, i) => (
                <button
                  key={i}
                  className={`fg-rod fg-rod-${i}${rod === i && !(useBait && freeShots > 0) ? " fg-rod-active" : ""}`}
                  disabled={apples != null && apples < bet}
                  onClick={() => { setRod(i); setUseBait(false); }}
                >
                  <span className="fg-rod-icon">{ROD_ICONS[i]}</span>
                  <span className="fg-rod-name">{rodNames[i]}</span>
                  <span className="fg-rod-bet">{fmt(bet)}</span>
                </button>
              ))}
            </div>
            <div className="fg-side">
              <button
                className={`fg-bait${useBait && freeShots > 0 ? " fg-bait-active" : ""}`}
                disabled={freeShots <= 0}
                onClick={() => setUseBait((v) => !v)}
                title="免費魚餌：以初級竿傷害出竿，不扣金幣"
              >
                🍤 免費魚餌 ×{freeShots}
              </button>
              {nextBoss && !boss && (
                <div className="fg-boss-progress" title={`血池累積到 ${fmt(nextBoss.threshold)} 時自動召喚${nextBoss.tierLabel} BOSS「${nextBoss.name}」，尾刀獨得血池 ${nextBoss.payoutPct}%`}>
                  <span>{nextBoss.emoji} {nextBoss.tierLabel}BOSS {Math.floor(bossProgress * 100)}%</span>
                  <span className="fg-boss-progress-track"><i style={{ width: `${bossProgress * 100}%` }} /></span>
                </div>
              )}
              {(perms.canSummon || perms.canResetPool) && (
                <div className="fg-admin">
                  {perms.canSummon && (
                    <button disabled={!!boss} onClick={() => socket.emit("fishingSummonBoss", { token: tokenRef.current, room: RN })}>🐉 召喚BOSS</button>
                  )}
                  {perms.canResetPool && (
                    <button onClick={() => {
                      if (window.confirm(`確定把血池重設為保底金額 ${fmt(perms.seedPool)}？`)) {
                        socket.emit("fishingResetPool", { token: tokenRef.current, room: RN });
                      }
                    }}>♻ 重設血池</button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="fg-hint">點魚開竿・大家共用魚的血量，打出最後一擊（尾刀）的人獨得「竿注 × 倍率」；血池大獎只有打死 BOSS 才能抱走</div>
        </div>
      )}
    </>
  );
}
