import { useState, useEffect } from "react";
import "./SlotMachine.css";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";

const SYMBOLS = [
  "☀️", "⚔️", "🐍", "🦊", "🐢",
  "👺", "⚡", "🌀", "🌸", "🪖",
  "🌙", "🗻", "⛩️", "🎎", "🐱"
];

// sprite sheet 定位（不變）
const SYMBOL_POS = {
  "☀️": [0,0], "⚔️": [1,0], "🐍": [2,0], "🦊": [3,0], "🐢": [4,0],
  "👺": [0,1], "⚡": [1,1], "🌀": [2,1], "🌸": [3,1], "🪖": [4,1],
  "🌙": [0,2], "🗻": [1,2], "⛩️": [2,2], "🎎": [3,2], "🐱": [4,2],
};
const SPRITE = "/game/15.gif";
const COLS = 5;
const ROW_Y_ORIG = [0, 336, 650];

function spriteStyle(sym, cellW) {
  const pos = SYMBOL_POS[sym];
  if (!pos) return {};
  const [c, r] = pos;
  const scale  = (cellW * COLS) / 1536;
  const imgH   = Math.round(1024 * scale);
  const yOff   = Math.round(ROW_Y_ORIG[r] * scale);
  return {
    backgroundImage:    `url(${SPRITE})`,
    backgroundSize:     `${cellW * COLS}px ${imgH}px`,
    backgroundPosition: `${-c * cellW}px ${-yOff}px`,
    backgroundRepeat:   "no-repeat",
  };
}

// ── 賠率表（與後端一致，目標 RTP 約 78%）────────────────
const PAYOUTS = {
  "☀️": [327, 131, 33],
  "⚔️": [196, 65, 20],
  "🐍": [131, 52, 13],
  "🦊": [98, 39, 13],
  "🐢": [98, 39, 13],
  "👺": [65, 26, 7],
  "⚡": [65, 26, 7],
  "🌀": [65, 26, 7],
  "🌸": [52, 20, 7],
  "🪖": [52, 20, 7],
  "🌙": [52, 20, 7],
  "🗻": [39, 13, 6],
  "⛩️": [39, 13, 6],
  "🎎": [39, 13, 6],
  "🐱": [39, 13, 6],
};

const pad2 = n => String(n).padStart(2, "0");

function isOpenNow(s) {
  if (!s || !s.enabled) return false;
  const now  = new Date();
  const h    = (now.getUTCHours() + 8) % 24;
  const cur  = h * 60 + now.getUTCMinutes();
  const open = s.open_hour * 60 + (s.open_min || 0);
  const close = s.close_hour >= 24 ? 24 * 60 : s.close_hour * 60 + (s.close_min || 0);
  return cur >= open && cur < close;
}

function randomReels() {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)])
  );
}

// 說明面板（顯示更新後的賠率）
function HelpPanel({ onClose }) {
  return (
    <div className="slot-help-popover">
      <div className="slot-help-header">
        <span>老虎機玩法說明</span>
        <button className="slot-help-close" onClick={onClose}>✕</button>
      </div>
      <div className="slot-help-body">
        <p className="slot-help-intro">
          🎰 5×3 轉輪，任意位置開始連續相同符號即可獲獎。<br/>
          ✨ 連贏方式：<br/>
          &nbsp;&nbsp;• 水平線（任意連續≥3個）<br/>
          &nbsp;&nbsp;• 對角線（左上→右下 / 右上→左下）<br/>
          &nbsp;&nbsp;• 2×2 方塊（四個格子相同）<br/>
          &nbsp;&nbsp;• 菱形（圍繞中心空格的四個對角格相同）<br/>
          💎 多條線獎金疊加，中獎格子會高亮金色外框。
        </p>
        <table className="slot-help-table">
          <thead><tr><th>符號</th><th>3連</th><th>4連</th><th>5連</th><th>2×2 / 菱形</th></tr>
          </thead>
          <tbody>
            {Object.entries(PAYOUTS).map(([sym, [p5, p4, p3]]) => (
              <tr key={sym}>
                <td><div className="slot-help-icon" style={spriteStyle(sym, 28)}/></td>
                <td className="slot-help-pay">×{p3}</td>
                <td className="slot-help-pay">×{p4}</td>
                <td className="slot-help-pay">×{p5}</td>
                <td className="slot-help-pay">×{p3}（方塊）<br/>×{p4}（菱形）</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="slot-help-note">
          ⚠️ 賠率為下注額的倍數（不含本金）。<br/>
          ⚠️ 每一條線／形狀僅支付最高獎勵組合。<br/>
          ⚠️ 所有中獎的格子都會高亮，獎金累計相加。
        </p>
      </div>
    </div>
  );
}

// 主元件
export default function SlotMachine({ token, apples, onApplesChange }) {
  const [settings, setSettings] = useState(null);
  const [bet, setBet]           = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels]       = useState(randomReels());
  const [winningCells, setWinningCells] = useState(new Set());
  const [lastWin, setLastWin]   = useState(0);
  const [showWinPopup, setShowWinPopup] = useState(false);
  const [error, setError]       = useState("");
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/slot/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setSettings)
      .catch(() => setSettings({ enabled: true, open_hour: 0, open_min: 0, close_hour: 24, close_min: 0, max_bet: 200 }));
  }, [token]);

  useEffect(() => {
    if (apples != null) setBet(b => Math.min(b, apples, settings?.max_bet || 200));
  }, [apples, settings]);

  const spin = async () => {
    if (spinning || (apples ?? 0) < bet) return;
    setSpinning(true);
    setWinningCells(new Set());
    setLastWin(0);
    setError("");

    const interval = setInterval(() => setReels(randomReels()), 80);

    try {
      const res  = await fetch(`${BACKEND}/api/slot/spin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bet }),
      });
      const data = await res.json();
      clearInterval(interval);

      if (!res.ok) {
        setError(data.error || "旋轉失敗");
        setSpinning(false);
        return;
      }

      setReels(data.reels);
      const cellsSet = new Set();
      if (data.lines) {
        data.lines.forEach(line => {
          if (line.cells) {
            line.cells.forEach(([col, row]) => {
              cellsSet.add(`${col},${row}`);
            });
          }
        });
      }
      setWinningCells(cellsSet);
      if (data.win > 0) { setLastWin(data.win); setShowWinPopup(true); }
      if (onApplesChange) onApplesChange(data.newApples);
    } catch {
      clearInterval(interval);
      setError("連線失敗，請重試");
    } finally {
      setSpinning(false);
    }
  };

  const changeBet = delta => {
    const max = settings?.max_bet || 200;
    setBet(b => Math.max(1, Math.min(b + delta, max)));
  };

  if (!settings) return <div className="slot-loading">載入中…</div>;

  if (!settings.enabled) {
    return (
      <div className="slot-closed">
        <div className="slot-closed-icon">🎰</div>
        <div className="slot-closed-text">老虎機目前未開放</div>
      </div>
    );
  }

  const openStr  = `${pad2(settings.open_hour)}:${pad2(settings.open_min || 0)}`;
  const closeStr = settings.close_hour >= 24 ? "24:00" : `${pad2(settings.close_hour)}:${pad2(settings.close_min || 0)}`;
  const open     = isOpenNow(settings);

  return (
    <div className="slot-machine">
      <button
        className={`slot-help-btn${showHelp ? " active" : ""}`}
        onClick={() => setShowHelp(v => !v)}
      >？玩法說明</button>
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      <div className="slot-header">
        <div className="slot-lantern left"></div>
        <h1 className="slot-title">
          <span>大和神話</span>
          <span className="title-gold">老虎機</span>
        </h1>
        <div className="slot-lantern right"></div>
      </div>

      <div className={`slot-hours-badge ${open ? "open" : "closed"}`}>
        <span>{open ? "🟢 開放中" : "🔴 已關閉"}</span>
        <span className="slot-hours-text">{openStr} – {closeStr}</span>
      </div>

      <div className="slot-info">
        <div className="slot-balance">
          <img src="/gifts/gold_apple.gif" alt="" />
          <span>{apples ?? 0}</span>
        </div>
        <div className="slot-bet-controls">
          <button onClick={() => changeBet(-1)} disabled={spinning || bet <= 1}>-</button>
          <span className="slot-bet-amount">{bet} <img src="/gifts/gold_apple.gif" alt="" className="slot-apple-icon" /></span>
          <button onClick={() => changeBet(1)} disabled={spinning || bet >= (settings?.max_bet || 200)}>+</button>
        </div>
      </div>

      {error && <div className="slot-error-msg">{error}</div>}

      <div className="slot-reels-container">
        <div className="slot-frame">
          <div className="slot-reels">
            {reels.map((col, ci) => (
              <div key={ci} className={`slot-reel ${spinning ? "spinning" : ""}`}>
                {col.map((symbol, ri) => (
                  <div
                    key={ri}
                    className={`slot-cell ${winningCells.has(`${ci},${ri}`) ? "win-line" : ""}`}
                    style={spriteStyle(symbol, 90)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className={`slot-lever ${spinning ? "pulled" : ""}`} onClick={spin}>
          <div className="lever-ball"></div>
          <div className="lever-handle"></div>
          <div className="lever-base"></div>
        </div>
      </div>

      <button
        className="slot-spin-btn"
        onClick={spin}
        disabled={spinning || bet > (apples ?? 0)}
      >
        {spinning ? "轉動中..." : "拉下拉桿！"}
      </button>

      {showWinPopup && (
        <div className="slot-win-popup" onClick={() => setShowWinPopup(false)}>
          <div className="popup-content">
            <div className="popup-title">🎉 大獎！ 🎉</div>
            <div className="popup-amount">+{lastWin} <img src="/gifts/gold_apple.gif" alt="" className="slot-apple-icon" /></div>
          </div>
        </div>
      )}
    </div>
  );
}
