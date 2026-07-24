import { useState, useEffect, useRef } from "react";
import "./RacingGame.css";
import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";

const CAR_EMOJIS = ["🚗", "🚙", "🚕", "🏎️", "🚓"];
const CAR_COLORS = ["#ff5b5b", "#5b8cff", "#ffd75b", "#5bffb0", "#c85bff"];
const RACE_DURATION_MS = 4200;
const WINNER_TARGET = 96;

const pad2 = n => String(n).padStart(2, "0");

function isOpenNow(s) {
  if (!s || !s.race_enabled) return false;
  const now  = new Date();
  const h    = (now.getUTCHours() + 8) % 24;
  const cur  = h * 60 + now.getUTCMinutes();
  const open = s.race_open_hour * 60 + (s.race_open_minute || 0);
  const close = s.race_close_hour >= 24 ? 24 * 60 : s.race_close_hour * 60 + (s.race_close_minute || 0);
  return cur >= open && cur < close;
}

export default function RacingGame({ token, apples, onApplesChange }) {
  const [settings, setSettings]         = useState(null);
  const [carNumber, setCarNumber]       = useState(1);
  const [bet, setBet]                   = useState(1);
  const [racing, setRacing]             = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [progress, setProgress]         = useState([0, 0, 0, 0, 0]);
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState("");
  const raceTimeoutRef = useRef(null);
  const currencyIcon = `/gifts/${roomConfig.currency_icon}`;

  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/race/settings?room=${RN}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setSettings)
      .catch(() => setSettings({ race_enabled: true, race_open_hour: 0, race_open_minute: 0, race_close_hour: 24, race_close_minute: 0, race_max_bet: 50 }));
  }, [token]);

  useEffect(() => {
    if (apples != null) setBet(b => Math.min(b, apples, settings?.race_max_bet || 50));
  }, [apples, settings]);

  useEffect(() => () => clearTimeout(raceTimeoutRef.current), []);

  const changeBet = delta => {
    const max = settings?.race_max_bet || 50;
    setBet(b => Math.max(1, Math.min(b + delta, max)));
  };

  const startRace = async () => {
    if (racing || (apples ?? 0) < bet) return;
    setRacing(true);
    setError("");
    setResult(null);
    setTransitioning(false);
    setProgress([0, 0, 0, 0, 0]);

    try {
      const res = await fetch(`${BACKEND}/api/race/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ carNumber, amount: bet, room: RN }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "下注失敗");
        setRacing(false);
        return;
      }

      // 產生 5 台車的終點位置：冠軍車衝線，其餘隨機落後，純視覺呈現用
      const targets = Array.from({ length: 5 }, (_, i) =>
        (i + 1) === data.winner ? WINNER_TARGET : 55 + Math.random() * 32
      );

      // 先讓瀏覽器畫出 0% 起跑位置，下一輪 frame 再切到動畫模式並設定終點，
      // 這樣 CSS transition 才會從起點滑到終點，而不是瞬間跳過去。
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitioning(true);
          setProgress(targets);
        });
      });

      raceTimeoutRef.current = setTimeout(() => {
        setResult(data);
        if (onApplesChange) onApplesChange(data.newApples);
        setRacing(false);
      }, RACE_DURATION_MS + 150);
    } catch {
      setError("連線失敗，請重試");
      setRacing(false);
    }
  };

  if (!settings) return <div className="race-loading">載入中…</div>;

  if (!settings.race_enabled) {
    return (
      <div className="race-closed">
        <div className="race-closed-icon">🏎️</div>
        <div className="race-closed-text">賽車遊戲目前未開放</div>
      </div>
    );
  }

  const openStr  = `${pad2(settings.race_open_hour)}:${pad2(settings.race_open_minute || 0)}`;
  const closeStr = settings.race_close_hour >= 24 ? "24:00" : `${pad2(settings.race_close_hour)}:${pad2(settings.race_close_minute || 0)}`;
  const open     = isOpenNow(settings);

  return (
    <div className="race-game">
      <div className="race-header">
        <h1 className="race-title">🏎️ 賽車冠軍賭</h1>
      </div>

      <div className={`race-hours-badge ${open ? "open" : "closed"}`}>
        <span>{open ? "🟢 開放中" : "🔴 已關閉"}</span>
        <span className="race-hours-text">{openStr} – {closeStr}</span>
      </div>

      <div className="race-info">
        <div className="race-balance">
          <img src={currencyIcon} alt="" />
          <span>{apples ?? 0}</span>
        </div>
        <div className="race-bet-controls">
          <button onClick={() => changeBet(-1)} disabled={racing || bet <= 1}>-</button>
          <span className="race-bet-amount">{bet} <img src={currencyIcon} alt="" className="race-apple-icon" /></span>
          <button onClick={() => changeBet(1)} disabled={racing || bet >= (settings.race_max_bet || 50)}>+</button>
        </div>
      </div>

      {error && <div className="race-error-msg">{error}</div>}

      <div className="race-track-wrap">
        {CAR_EMOJIS.map((emoji, i) => {
          const num = i + 1;
          const isWinner = result && result.winner === num;
          return (
            <div
              key={num}
              className={`race-lane ${carNumber === num ? "selected" : ""} ${isWinner ? "winner" : ""}`}
              onClick={() => !racing && setCarNumber(num)}
            >
              <span className="race-lane-num" style={{ color: CAR_COLORS[i] }}>{num}</span>
              <div className="race-lane-track">
                <div className="race-finish-line" />
                <div
                  className="race-car"
                  style={{
                    left: `${100 - progress[i]}%`,
                    transitionDuration: transitioning ? `${RACE_DURATION_MS}ms` : "0ms",
                  }}
                >
                  {emoji}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="race-start-btn"
        onClick={startRace}
        disabled={!open || racing || bet > (apples ?? 0)}
      >
        {racing ? "比賽進行中..." : `下注 ${carNumber} 號車並開跑`}
      </button>

      <div className="race-hint">點選車道選擇要下注的車號，1 賠 4</div>

      {result && (
        <div className="race-result-popup" onClick={() => setResult(null)}>
          <div className="race-result-content">
            <div className="race-result-title">🏆 {result.winner} 號車冠軍！</div>
            {result.won ? (
              <div className="race-result-amount win">
                恭喜中獎 +{result.actualWin} <img src={currencyIcon} alt="" className="race-apple-icon" />
              </div>
            ) : (
              <div className="race-result-amount lose">這局沒中，再接再厲！</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
