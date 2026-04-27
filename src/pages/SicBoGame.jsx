import { useState, useEffect, useRef } from "react";
import "./SicBoGame.css";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";

const DOT_MAPS = {
  1: [[0,0,0],[0,1,0],[0,0,0]],
  2: [[1,0,0],[0,0,0],[0,0,1]],
  3: [[1,0,0],[0,1,0],[0,0,1]],
  4: [[1,0,1],[0,0,0],[1,0,1]],
  5: [[1,0,1],[0,1,0],[1,0,1]],
  6: [[1,0,1],[1,0,1],[1,0,1]],
};

const BET_TYPES = {
  big:        { name: "大",    odds: 1   },
  small:      { name: "小",    odds: 1   },
  odd:        { name: "單",    odds: 1   },
  even:       { name: "雙",    odds: 1   },
  big_odd:    { name: "大單",  odds: 2   },
  big_even:   { name: "大雙",  odds: 3   },
  small_odd:  { name: "小單",  odds: 3   },
  small_even: { name: "小雙",  odds: 2   },
  anyTriple:  { name: "任意豹子", odds: 24  },
  triple1:    { name: "豹子 1", odds: 150 },
  triple2:    { name: "豹子 2", odds: 150 },
  triple3:    { name: "豹子 3", odds: 150 },
  triple4:    { name: "豹子 4", odds: 150 },
  triple5:    { name: "豹子 5", odds: 150 },
  triple6:    { name: "豹子 6", odds: 150 },
  pair1:      { name: "對子 1", odds: 10  },
  pair2:      { name: "對子 2", odds: 10  },
  pair3:      { name: "對子 3", odds: 10  },
  pair4:      { name: "對子 4", odds: 10  },
  pair5:      { name: "對子 5", odds: 10  },
  pair6:      { name: "對子 6", odds: 10  },
};
for (let i = 4; i <= 17; i++) {
  const oddsMap = {4:50,5:18,6:14,7:12,8:8,9:6,10:6,11:6,12:6,13:8,14:12,15:14,16:18,17:50};
  BET_TYPES[`total_${i}`] = { name: `總和 ${i}`, odds: oddsMap[i] };
}

const CHIPS = [1, 5, 10, 25, 50, 100];

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

function Die({ value, rolling }) {
  return (
    <div className={`sic-die ${rolling ? "rolling" : ""}`}>
      <div className="sic-die-inner">
        {DOT_MAPS[value].map((row, r) => (
          <div className="sic-dot-row" key={r}>
            {row.map((dot, c) => (
              <span key={c} className={`sic-die-dot ${dot ? "filled" : ""}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function HelpPanel({ onClose }) {
  return (
    <div className="sic-help-popover">
      <div className="sic-help-header">
        <span>骰寶玩法說明</span>
        <button className="sic-help-close" onClick={onClose}>✕</button>
      </div>
      <div className="sic-help-body">
        <p className="sic-help-intro">擲出三顆骰子，依骰子結果決定勝負。可同時押多種注型，各自獨立結算。</p>
        <table className="sic-help-table">
          <thead><tr><th>注型</th><th>說明</th><th>賠率</th></tr></thead>
          <tbody>
            <tr><td>大</td><td>總和 11–17，豹子通殺</td><td className="sic-help-pay">1賠1</td></tr>
            <tr><td>小</td><td>總和 4–10，豹子通殺</td><td className="sic-help-pay">1賠1</td></tr>
            <tr><td>單</td><td>總和為奇數，豹子通殺</td><td className="sic-help-pay">1賠1</td></tr>
            <tr><td>雙</td><td>總和為偶數，豹子通殺</td><td className="sic-help-pay">1賠1</td></tr>
            <tr><td>大單</td><td>大 且 單數</td><td className="sic-help-pay">1賠2</td></tr>
            <tr><td>大雙</td><td>大 且 雙數</td><td className="sic-help-pay">1賠3</td></tr>
            <tr><td>小單</td><td>小 且 單數</td><td className="sic-help-pay">1賠3</td></tr>
            <tr><td>小雙</td><td>小 且 雙數</td><td className="sic-help-pay">1賠2</td></tr>
            <tr><td>任意豹子</td><td>三骰同號（任意）</td><td className="sic-help-pay">1賠24</td></tr>
            <tr><td>指定豹子</td><td>三骰均為指定點數</td><td className="sic-help-pay">1賠150</td></tr>
            <tr><td>對子</td><td>三骰中有兩個指定點數</td><td className="sic-help-pay">1賠10</td></tr>
            <tr><td>總和 4/17</td><td></td><td className="sic-help-pay">1賠50</td></tr>
            <tr><td>總和 5/16</td><td></td><td className="sic-help-pay">1賠18</td></tr>
            <tr><td>總和 6/15</td><td></td><td className="sic-help-pay">1賠14</td></tr>
            <tr><td>總和 7/14</td><td></td><td className="sic-help-pay">1賠12</td></tr>
            <tr><td>總和 8/13</td><td></td><td className="sic-help-pay">1賠8</td></tr>
            <tr><td>總和 9–12</td><td></td><td className="sic-help-pay">1賠6</td></tr>
          </tbody>
        </table>
        <p className="sic-help-note">
          ⚠️ 豹子時，大小單雙全部輸。<br />
          ⚠️ 每種注型獨立，可同時押多種。
        </p>
      </div>
    </div>
  );
}

function ResultPopup({ result, onClose }) {
  const win = result.net > 0;
  return (
    <div className="sic-result-overlay" onClick={onClose}>
      <div className="sic-result-card" onClick={e => e.stopPropagation()}>
        <div className="sic-result-icon">{win ? "🎉" : "😢"}</div>
        <div className="sic-result-title">{win ? "恭喜獲勝！" : "再接再厲"}</div>
        <div className="sic-result-amount">
          {win ? `+${result.net}` : `-${Math.abs(result.net)}`}
          <img src="/gifts/gold_apple.gif" alt="" className="sic-result-apple" />
        </div>
        <div className="sic-result-detail">
          骰子：{result.dice[0]} - {result.dice[1]} - {result.dice[2]}　總和 {result.total}
        </div>
        <button className="sic-result-btn" onClick={onClose}>繼續</button>
      </div>
    </div>
  );
}

// ── 主元件 ────────────────────────────────────────────────
export default function SicBoGame({ token, apples, onApplesChange }) {
  const [settings, setSettings]         = useState(null);
  const [selectedChip, setSelectedChip] = useState(1);
  const [bets, setBets]                 = useState({});
  const [dice, setDice]                 = useState([1, 2, 3]);
  const [rolling, setRolling]           = useState(false);
  const [lastResult, setLastResult]     = useState(null);
  const [error, setError]               = useState("");
  const [showHelp, setShowHelp]         = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    fetch(`${BACKEND}/api/sicbo/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setSettings(d))
      .catch(() => setSettings({ enabled: true, open_hour: 0, open_min: 0, close_hour: 24, close_min: 0, max_bet: 200 }));
  }, [token]);

  const totalBet = Object.values(bets).reduce((s, b) => s + b, 0);
  const maxBet   = settings?.max_bet ?? 200;
  const open     = isOpenNow(settings);

  function placeBet(type) {
    if (rolling) return;
    if ((apples ?? 0) < selectedChip) return;
    const curBet = bets[type] || 0;
    if (curBet + selectedChip > maxBet) { setError(`單注最高 ${maxBet} 顆`); return; }
    setError("");
    setBets(prev => ({ ...prev, [type]: curBet + selectedChip }));
  }

  function clearBets() { setBets({}); setError(""); }

  async function rollDice() {
    if (totalBet < 1 || rolling) return;
    setRolling(true);
    setError("");
    const scrollEl = rootRef.current?.closest(".casino-body");
    if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: "smooth" });

    const rollInterval = setInterval(() => {
      setDice([
        Math.ceil(Math.random() * 6),
        Math.ceil(Math.random() * 6),
        Math.ceil(Math.random() * 6),
      ]);
    }, 80);

    try {
      const res  = await fetch(`${BACKEND}/api/sicbo/roll`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bets }),
      });
      const data = await res.json();
      clearInterval(rollInterval);

      if (!res.ok) {
        setError(data.error || "下注失敗");
        setBets({});
        setRolling(false);
        return;
      }

      setDice(data.dice);
      setRolling(false);
      setBets({});
      setLastResult({ dice: data.dice, total: data.total, net: data.net });
      if (onApplesChange) onApplesChange(data.newApples);
    } catch {
      clearInterval(rollInterval);
      setError("連線失敗，請重試");
      setRolling(false);
    }
  }

  if (!settings) {
    return <div style={{ color: "#d4af37", textAlign: "center", padding: 40 }}>載入中…</div>;
  }

  if (!settings.enabled) {
    return (
      <div className="sic-closed">
        <div className="sic-closed-icon">🎲</div>
        <div className="sic-closed-text">骰寶目前未開放</div>
      </div>
    );
  }

  const openStr  = `${pad2(settings.open_hour)}:${pad2(settings.open_min || 0)}`;
  const closeStr = settings.close_hour >= 24 ? "24:00" : `${pad2(settings.close_hour)}:${pad2(settings.close_min || 0)}`;

  return (
    <div className="sic-root" ref={rootRef}>
      {/* 說明按鈕 */}
      <button
        className={`sic-help-btn${showHelp ? " active" : ""}`}
        onClick={() => setShowHelp(v => !v)}
      >？玩法說明</button>
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      {/* 頂部：骰子 + 籌碼/狀態 */}
      <div className="sic-top-row">
        <div className="sic-dice-block">
          <div className={`sic-hours-badge ${open ? "open" : "closed"}`}>
            <span>{open ? "🟢" : "🔴"}</span>
            <span className="sic-hours-text">{openStr} – {closeStr}</span>
          </div>
          <div className="sic-dice-row">
            {dice.map((v, i) => <Die key={i} value={v} rolling={rolling} />)}
          </div>
          {!rolling && lastResult && (
            <div className="sic-dice-sum">總和 {lastResult.total}</div>
          )}
        </div>
        <div className="sic-chips-block">
          <div className="sic-chip-selector">
            <span className="sic-chip-label">籌碼</span>
            <div className="sic-chips-row">
              {CHIPS.map(c => (
                <button
                  key={c}
                  className={`sic-chip ${selectedChip === c ? "active" : ""}`}
                  onClick={() => setSelectedChip(c)}
                  disabled={c > (apples ?? 0) || rolling}
                >{c}</button>
              ))}
            </div>
          </div>
          <div className="sic-status-row">
            <span className="sic-bal">
              <img src="/gifts/gold_apple.gif" alt="" />
              {apples ?? 0}
            </span>
            <span className="sic-bet-label">下注 <strong>{totalBet}</strong></span>
            {totalBet > 0 && (
              <button className="sic-clear-btn" onClick={clearBets} disabled={rolling}>清除</button>
            )}
          </div>
          {error && <div className="sic-error">{error}</div>}
        </div>
      </div>

      {/* 大小 / 單雙 */}
      <div className="sic-section-row sic-large-row">
        {["big","small","odd","even"].map(type => (
          <BetButton key={type} type={type} amount={bets[type]||0} onClick={() => placeBet(type)} disabled={rolling} />
        ))}
      </div>

      {/* 組合 */}
      <div className="sic-section-row sic-medium-row">
        {["big_odd","big_even","small_odd","small_even"].map(type => (
          <BetButton key={type} type={type} amount={bets[type]||0} onClick={() => placeBet(type)} disabled={rolling} />
        ))}
      </div>

      {/* 豹子 */}
      <div className="sic-labeled-row">
        <span className="sic-row-label">豹子</span>
        <div className="sic-compact-row">
          <BetButton type="anyTriple" label="任意" amount={bets["anyTriple"]||0} onClick={() => placeBet("anyTriple")} disabled={rolling} />
          {[1,2,3,4,5,6].map(n => (
            <BetButton key={`triple${n}`} type={`triple${n}`} label={`${n}`}
              amount={bets[`triple${n}`]||0} onClick={() => placeBet(`triple${n}`)} disabled={rolling} />
          ))}
        </div>
      </div>

      {/* 對子 */}
      <div className="sic-labeled-row">
        <span className="sic-row-label">對子</span>
        <div className="sic-compact-row">
          {[1,2,3,4,5,6].map(n => (
            <BetButton key={`pair${n}`} type={`pair${n}`} label={`${n}`}
              amount={bets[`pair${n}`]||0} onClick={() => placeBet(`pair${n}`)} disabled={rolling} />
          ))}
        </div>
      </div>

      {/* 點數總和 */}
      <div className="sic-labeled-row">
        <span className="sic-row-label">總和</span>
        <div className="sic-total-grid">
          {Array.from({length:14}, (_, i) => i+4).map(t => (
            <BetButton key={`total_${t}`} type={`total_${t}`} label={`${t}`}
              amount={bets[`total_${t}`]||0} onClick={() => placeBet(`total_${t}`)} disabled={rolling} />
          ))}
        </div>
      </div>

      {/* 擲骰子 */}
      <button
        className={`sic-roll-btn ${totalBet > 0 && !rolling ? "active" : ""}`}
        onClick={rollDice}
        disabled={totalBet < 1 || rolling}
      >
        {rolling ? "骰子在轉…" : "擲骰子"}
      </button>

      {lastResult && !rolling && (
        <ResultPopup result={lastResult} onClose={() => setLastResult(null)} />
      )}
    </div>
  );
}

// ── 下注按鈕元件 ──────────────────────────────────────────
function BetButton({ type, amount, onClick, disabled, label }) {
  const def = BET_TYPES[type];
  if (!def) return null;
  return (
    <button className="sic-bet-btn" onClick={onClick} disabled={disabled}>
      <span className="sic-bet-name">{label ?? def.name}</span>
      <span className="sic-bet-odds">×{def.odds}</span>
      {amount > 0 && (
        <span className="sic-bet-amount">
          {amount}
          <img src="/gifts/gold_apple.gif" alt="" style={{width:10,height:10,verticalAlign:"middle",marginLeft:1}} />
        </span>
      )}
    </button>
  );
}
