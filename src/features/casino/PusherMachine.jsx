import { useState, useEffect, useRef } from "react";
import "./PusherMachine.css";
import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";
import socket from "../../shared/socket";

const pad2 = n => String(n).padStart(2, "0");

// 用索引產生穩定的偽隨機值（同一顆幣每次 render 位置都一樣，不會亂跳）
function seededRand(seed) {
  const x = Math.sin(seed * 999.7) * 43758.5453;
  return x - Math.floor(x);
}

// 產生散落在推幣台上的硬幣佈局
function coinLayout(count, topMin, topMax, seedBase = 0) {
  return Array.from({ length: count }).map((_, i) => {
    const s      = i + seedBase;
    const left   = 3 + seededRand(s * 3 + 2) * 92;
    const top    = topMin + seededRand(s * 3 + 1) * (topMax - topMin);
    const rotate = (seededRand(s * 3 + 3) - 0.5) * 70;
    const size   = 15 + seededRand(s * 5 + 7) * 8;
    return { left, top, rotate, size, z: Math.round(top * 10) };
  });
}

function Coin({ style, className = "" }) {
  return <div className={`coin ${className}`} style={style} />;
}

function isOpenNow(s) {
  if (!s || !s.enabled) return false;
  const now  = new Date();
  const h    = (now.getUTCHours() + 8) % 24;
  const cur  = h * 60 + now.getUTCMinutes();
  const open = s.open_hour * 60 + (s.open_min || 0);
  const close = s.close_hour >= 24 ? 24 * 60 : s.close_hour * 60 + (s.close_min || 0);
  return cur >= open && cur < close;
}

export default function PusherMachine({ token, apples, onApplesChange }) {
  const [settings, setSettings]         = useState(null);
  const [bet, setBet]                   = useState(1);
  const [pushing, setPushing]           = useState(false);
  const [fillLevel, setFillLevel]       = useState(0);
  const [capacity, setCapacity]         = useState(1000);
  const [jackpotPool, setJackpotPool]   = useState(0);
  const [lastWin, setLastWin]           = useState(0);
  const [showWinPopup, setShowWinPopup] = useState(false);
  const [jackpotPopup, setJackpotPopup] = useState(null);
  const [toast, setToast]               = useState(null);
  const [error, setError]               = useState("");
  const [coinDrop, setCoinDrop]         = useState(0);
  const [fallingCoins, setFallingCoins] = useState([]);
  const dropXRef  = useRef(50);
  const fallTimer = useRef(null);

  const myName = sessionStorage.getItem("name") || "";

  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/pusher/settings?room=${RN}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setFillLevel(data.fillLevel || 0);
        setCapacity(data.capacity || 1000);
        setJackpotPool(data.jackpotPool || 0);
      })
      .catch(() => setSettings({ enabled: true, open_hour: 0, open_min: 0, close_hour: 24, close_min: 0, max_bet: 50 }));
  }, [token]);

  useEffect(() => {
    if (apples != null) setBet(b => Math.min(b, apples, settings?.max_bet || 50));
  }, [apples, settings]);

  useEffect(() => {
    const onState = ({ fillLevel, capacity, jackpotPool }) => {
      setFillLevel(fillLevel);
      setCapacity(capacity);
      setJackpotPool(jackpotPool);
    };
    const onJackpot = ({ username, amount }) => {
      if (username !== myName) {
        setToast(`🪙 ${username} 觸發幣槽大量落幣，獲得 ${amount} 顆${roomConfig.currency_name}！`);
        setTimeout(() => setToast(null), 4000);
      }
    };
    socket.on("pusherState", onState);
    socket.on("pusherJackpot", onJackpot);
    return () => {
      socket.off("pusherState", onState);
      socket.off("pusherJackpot", onJackpot);
    };
  }, [myName]);

  useEffect(() => () => clearTimeout(fallTimer.current), []);

  const MIN_PUSH_MS = 900;

  const spawnFallingCoins = (count) => {
    const n = Math.max(1, Math.min(40, count));
    const batch = Array.from({ length: n }).map((_, i) => ({
      id: `${Date.now()}-${i}`,
      left: 8 + seededRand(i * 7 + Date.now() % 97) * 84,
      delay: seededRand(i * 11 + 3) * 0.4,
      drift: (seededRand(i * 13 + 5) - 0.5) * 60,
    }));
    setFallingCoins(batch);
    clearTimeout(fallTimer.current);
    fallTimer.current = setTimeout(() => setFallingCoins([]), 1700);
  };

  const push = async () => {
    if (pushing || (apples ?? 0) < bet) return;
    setPushing(true);
    setError("");
    setLastWin(0);
    dropXRef.current = 22 + Math.random() * 56;
    setCoinDrop(d => d + 1);

    try {
      const [res] = await Promise.all([
        fetch(`${BACKEND}/api/pusher/push`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ bet, room: RN }),
        }),
        new Promise(r => setTimeout(r, MIN_PUSH_MS)),
      ]);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "投幣失敗");
        return;
      }

      setFillLevel(data.fillLevel);
      setCapacity(data.capacity);
      setJackpotPool(data.jackpotPool);
      if (onApplesChange) onApplesChange(data.newApples);

      if (data.jackpotTriggered && data.jackpotWin > 0) {
        spawnFallingCoins(36);
        setJackpotPopup({ amount: data.jackpotWin });
      } else if (data.win > 0) {
        spawnFallingCoins(4 + Math.min(16, data.win));
      }
      if (data.win > 0) { setLastWin(data.win); setShowWinPopup(true); }
    } catch {
      setError("連線失敗，請重試");
    } finally {
      setPushing(false);
    }
  };

  const changeBet = delta => {
    const max = settings?.max_bet || 50;
    setBet(b => Math.max(1, Math.min(b + delta, max)));
  };

  if (!settings) return <div className="pusher-loading">載入中…</div>;

  if (!settings.enabled) {
    return (
      <div className="pusher-closed">
        <div className="pusher-closed-icon">🪙</div>
        <div className="pusher-closed-text">推幣機目前未開放</div>
      </div>
    );
  }

  const openStr  = `${pad2(settings.open_hour)}:${pad2(settings.open_min || 0)}`;
  const closeStr = settings.close_hour >= 24 ? "24:00" : `${pad2(settings.close_hour)}:${pad2(settings.close_min || 0)}`;
  const open     = isOpenNow(settings);
  const fillPct  = Math.max(0, Math.min(100, (fillLevel / (capacity || 1)) * 100));

  const shelfCoins = coinLayout(24, 4, 62, 1000);
  const baseCoinCount = Math.max(28, Math.round(28 + (fillPct / 100) * 100));
  const baseCoins = coinLayout(baseCoinCount, 8, 88, 5000);

  return (
    <div className="pusher-machine">
      <div className="pusher-header">
        <h1 className="pusher-title">🪙 推幣機</h1>
      </div>

      <div className={`pusher-hours-badge ${open ? "open" : "closed"}`}>
        <span>{open ? "🟢 開放中" : "🔴 已關閉"}</span>
        <span className="pusher-hours-text">{openStr} – {closeStr}</span>
      </div>

      <div className="pusher-info">
        <div className="pusher-balance">
          <img src={`/gifts/${roomConfig.currency_icon}`} alt="" />
          <span>{apples ?? 0}</span>
        </div>
        <div className="pusher-bet-controls">
          <button onClick={() => changeBet(-1)} disabled={pushing || bet <= 1}>-</button>
          <span className="pusher-bet-amount">{bet} <img src={`/gifts/${roomConfig.currency_icon}`} alt="" className="pusher-apple-icon" /></span>
          <button onClick={() => changeBet(1)} disabled={pushing || bet >= (settings?.max_bet || 50)}>+</button>
        </div>
      </div>

      {error && <div className="pusher-error-msg">{error}</div>}

      <div className="pusher-jackpot-bar-wrap">
        <div className="pusher-jackpot-label">
          <span>🏆 幣槽獎池：{jackpotPool} 顆{roomConfig.currency_name}</span>
          <span>{Math.floor(fillPct)}%</span>
        </div>
        <div className="pusher-jackpot-bar">
          <div className="pusher-jackpot-fill" style={{ width: `${fillPct}%` }} />
        </div>
      </div>

      <div className="pusher-cabinet">
        <div className="pusher-marquee">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="pusher-bulb" style={{ animationDelay: `${(i * 0.13).toFixed(2)}s` }} />
          ))}
        </div>

        <div className="pusher-chute-row">
          <div className="pusher-chute-slot" />
          <div key={coinDrop} className={`pusher-drop-coin ${pushing ? "dropping" : ""}`} style={{ left: `${dropXRef.current}%` }}>
            <Coin style={{ width: 20, height: 20, position: "static" }} />
          </div>
        </div>

        <div className="pusher-playfield">
          <div className="pusher-shelf-wrap">
            <div className={`pusher-shelf ${pushing ? "pushing" : ""}`}>
              {shelfCoins.map((c, i) => (
                <Coin
                  key={i}
                  className="pusher-placed-coin"
                  style={{ left: `${c.left}%`, top: `${c.top}%`, width: c.size, height: c.size, transform: `rotate(${c.rotate}deg)`, zIndex: c.z }}
                />
              ))}
            </div>
          </div>

          <div className={`pusher-base ${pushing ? "jolt" : ""}`}>
            {baseCoins.map((c, i) => (
              <Coin
                key={i}
                className="pusher-placed-coin"
                style={{ left: `${c.left}%`, top: `${c.top}%`, width: c.size, height: c.size, transform: `rotate(${c.rotate}deg)`, zIndex: c.z }}
              />
            ))}
            <div className="pusher-edge-lip" />
          </div>

          <div className="pusher-fall-zone">
            {fallingCoins.map(c => (
              <Coin
                key={c.id}
                className="pusher-falling-coin"
                style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, "--drift": `${c.drift}px`, width: 16, height: 16 }}
              />
            ))}
          </div>
        </div>
      </div>

      <button
        className="pusher-push-btn"
        onClick={push}
        disabled={pushing || bet > (apples ?? 0)}
      >
        {pushing ? "投幣中..." : "投幣推推看！"}
      </button>

      {showWinPopup && (
        <div className="pusher-win-popup" onClick={() => setShowWinPopup(false)}>
          <div className="popup-content">
            <div className="popup-title">✨ 掉幣了！ ✨</div>
            <div className="popup-amount">+{lastWin} <img src={`/gifts/${roomConfig.currency_icon}`} alt="" className="pusher-apple-icon" /></div>
          </div>
        </div>
      )}

      {jackpotPopup && (
        <div className="pusher-jackpot-popup" onClick={() => setJackpotPopup(null)}>
          <div className="jackpot-popup-content">
            <div className="jackpot-popup-title">🎉 幣槽爆滿！大量落幣！ 🎉</div>
            <div className="jackpot-popup-amount">+{jackpotPopup.amount} <img src={`/gifts/${roomConfig.currency_icon}`} alt="" className="pusher-apple-icon" /></div>
          </div>
        </div>
      )}

      {toast && <div className="pusher-toast">{toast}</div>}
    </div>
  );
}
