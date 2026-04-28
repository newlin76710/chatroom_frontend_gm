import { useEffect, useMemo, useState } from "react";
import "./BaccaratGame.css";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";
const CHIPS = [1, 5, 10, 25, 50, 100];
const BET_AREAS = [
  { key: "player", label: "閒", sub: "1賠1，和局退回本金" },
  { key: "banker", label: "莊", sub: "1賠1，莊6點勝只賠0.5，和局退回本金" },
  { key: "tie", label: "和", sub: "1賠8" },
];

const SUIT_MAP = { S: "♠", H: "♥", D: "♦", C: "♣" };

const pad2 = n => String(n).padStart(2, "0");

function isOpenNow(s) {
  if (!s || !s.enabled) return false;
  const now = new Date();
  const h = (now.getUTCHours() + 8) % 24;
  const cur = h * 60 + now.getUTCMinutes();
  const open = s.open_hour * 60 + (s.open_min || 0);
  const close = s.close_hour >= 24 ? 24 * 60 : s.close_hour * 60 + (s.close_min || 0);
  return cur >= open && cur < close;
}

function cardText(card) {
  const rank = card.slice(0, -1);
  const suit = SUIT_MAP[card.slice(-1)] || card.slice(-1);
  return `${rank}${suit}`;
}

function Hand({ title, total, cards, accent }) {
  return (
    <div className={`bac-hand ${accent}`}>
      <div className="bac-hand-top">
        <span className="bac-hand-title">{title}</span>
        <span className="bac-hand-total">點數 {total ?? "-"}</span>
      </div>
      <div className="bac-cards">
        {cards?.length ? cards.map((card, idx) => (
          <div key={`${card}-${idx}`} className="bac-card">{cardText(card)}</div>
        )) : <div className="bac-card bac-card-empty">待發牌</div>}
      </div>
    </div>
  );
}

export default function BaccaratGame({ token, apples, onApplesChange }) {
  const [settings, setSettings] = useState(null);
  const [selectedBet, setSelectedBet] = useState("player");
  const [betAmount, setBetAmount] = useState(10);
  const [dealing, setDealing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/baccarat/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setSettings)
      .catch(() => setSettings({ enabled: true, open_hour: 0, open_min: 0, close_hour: 24, close_min: 0, max_bet: 200 }));
  }, [token]);

  useEffect(() => {
    const max = settings?.max_bet || 200;
    setBetAmount(prev => Math.max(1, Math.min(prev, apples ?? max, max)));
  }, [apples, settings]);

  const open = useMemo(() => isOpenNow(settings), [settings]);

  function changeBet(delta) {
    const max = settings?.max_bet || 200;
    setBetAmount(prev => Math.max(1, Math.min(prev + delta, max)));
  }

  async function deal() {
    if (dealing || (apples ?? 0) < betAmount) return;
    setDealing(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND}/api/baccarat/deal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ betType: selectedBet, betAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "開局失敗");
        return;
      }
      setResult(data);
      if (onApplesChange) onApplesChange(data.newApples);
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setDealing(false);
    }
  }

  if (!settings) return <div className="bac-loading">載入中…</div>;

  if (!settings.enabled) {
    return (
      <div className="bac-closed">
        <div className="bac-closed-icon">🀄</div>
        <div className="bac-closed-text">百家樂目前未開放</div>
      </div>
    );
  }

  const openStr = `${pad2(settings.open_hour)}:${pad2(settings.open_min || 0)}`;
  const closeStr = settings.close_hour >= 24 ? "24:00" : `${pad2(settings.close_hour)}:${pad2(settings.close_min || 0)}`;

  return (
    <div className="bac-root">
      <div className="bac-header">
        <div className="bac-title-wrap">
          <div className="bac-title">🀄 百家樂</div>
          <div className="bac-subtitle">單押閒／莊／和，結果即時結算</div>
        </div>
        <div className={`bac-hours ${open ? "open" : "closed"}`}>
          <span>{open ? "🟢 開放中" : "🔴 已關閉"}</span>
          <span>{openStr} – {closeStr}</span>
        </div>
      </div>

      <div className="bac-table">
        {BET_AREAS.map(area => (
          <button
            key={area.key}
            className={`bac-bet-area ${selectedBet === area.key ? "active" : ""} ${area.key}`}
            onClick={() => setSelectedBet(area.key)}
            disabled={dealing}
          >
            <span className="bac-bet-label">{area.label}</span>
            <span className="bac-bet-sub">{area.sub}</span>
          </button>
        ))}
      </div>

      <div className="bac-controls">
        <div className="bac-balance">
          <img src="/gifts/gold_apple.gif" alt="" />
          <span>{apples ?? 0}</span>
        </div>
        <div className="bac-chip-row">
          {CHIPS.map(chip => (
            <button
              key={chip}
              className={`bac-chip ${betAmount === chip ? "active" : ""}`}
              onClick={() => setBetAmount(Math.min(chip, settings.max_bet || 200))}
              disabled={dealing || chip > (settings.max_bet || 200)}
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="bac-stepper">
          <button onClick={() => changeBet(-1)} disabled={dealing || betAmount <= 1}>-</button>
          <span>{betAmount} 顆</span>
          <button onClick={() => changeBet(1)} disabled={dealing || betAmount >= (settings.max_bet || 200)}>+</button>
        </div>
        <button
          className="bac-deal-btn"
          onClick={deal}
          disabled={dealing || !open || (apples ?? 0) < betAmount}
        >
          {dealing ? "發牌中…" : "開始發牌"}
        </button>
      </div>

      {error && <div className="bac-error">{error}</div>}

      <div className="bac-board">
        <Hand title="閒家" total={result?.playerTotal} cards={result?.playerCards} accent="player" />
        <div className="bac-center">
          <div className={`bac-result ${result?.result || ""}`}>
            {result?.result === "player" ? "閒勝" : result?.result === "banker" ? "莊勝" : result?.result === "tie" ? "和局" : "等待開局"}
          </div>
          {result && (
            <div className={`bac-net ${result.net >= 0 ? "win" : "lose"}`}>
              {result.net >= 0 ? "+" : ""}{result.net}
            </div>
          )}
          {result && (
            <div className="bac-detail">
              押注 {BET_AREAS.find(area => area.key === result.betType)?.label} {result.betAmount} 顆
              <br />
              實際入帳 {result.totalWin} 顆
            </div>
          )}
        </div>
        <Hand title="莊家" total={result?.bankerTotal} cards={result?.bankerCards} accent="banker" />
      </div>
    </div>
  );
}
