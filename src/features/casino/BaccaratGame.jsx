import { useEffect, useMemo, useRef, useState } from "react";
import "./BlackjackGame.css";
import "./BaccaratGame.css";
import { getFaceCardComponent } from "./CardFaces";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";
const RED_SUITS = new Set(["♥", "♦"]);
const CHIPS = [1, 5, 10, 25, 50, 100];
const BET_AREAS = [
  { key: "player", label: "PLAYER", zh: "閒", sub: "1賠1，和局退回本金", accent: "player" },
  { key: "tie", label: "TIE", zh: "和", sub: "1賠8", accent: "tie" },
  { key: "banker", label: "BANKER", zh: "莊", sub: "1賠1，莊6點勝只賠0.5，和局退回本金", accent: "banker" },
];
const SUIT_MAP = { S: "♠", H: "♥", D: "♦", C: "♣" };

const chipColor = c =>
  c <= 1 ? "silver" : c <= 5 ? "orange" : c <= 10 ? "red" : c <= 25 ? "green" : c <= 50 ? "blue" : c <= 100 ? "black" : "purple";

const pad2 = n => String(n).padStart(2, "0");

function HelpPanel({ onClose }) {
  return (
    <div className="bac-help-popover">
      <div className="bac-help-header">
        <span>百家樂玩法說明</span>
        <button className="bac-help-close" onClick={onClose}>✕</button>
      </div>
      <div className="bac-help-body">
        <p className="bac-help-intro">
          每局比較閒家與莊家的最終點數，最接近 9 點者勝。<br />
          A 算 1 點，2–9 依牌面，10/J/Q/K 都算 0 點，總點數只看個位數。
        </p>
        <table className="bac-help-table">
          <thead>
            <tr><th>下注區</th><th>說明</th><th>賠率</th></tr>
          </thead>
          <tbody>
            <tr><td>閒</td><td>閒家點數大於莊家</td><td className="bac-help-pay">1賠1</td></tr>
            <tr><td>莊</td><td>莊家點數大於閒家</td><td className="bac-help-pay">1賠1</td></tr>
            <tr><td>莊 6 點勝</td><td>免佣版特例</td><td className="bac-help-pay">1賠0.5</td></tr>
            <tr><td>和</td><td>雙方點數相同</td><td className="bac-help-pay">1賠8</td></tr>
          </tbody>
        </table>
        <p className="bac-help-note">
          ⚠️ 押閒或莊時，若開出和局，退回本金。<br />
          ⚠️ 本遊戲採免佣百家樂規則，莊家 6 點獲勝時只賠半倍。
        </p>
      </div>
    </div>
  );
}

function isOpenNow(s) {
  if (!s || !s.enabled) return false;
  const now = new Date();
  const h = (now.getUTCHours() + 8) % 24;
  const cur = h * 60 + now.getUTCMinutes();
  const open = s.open_hour * 60 + (s.open_min || 0);
  const close = s.close_hour >= 24 ? 24 * 60 : s.close_hour * 60 + (s.close_min || 0);
  return cur >= open && cur < close;
}

function parseCard(card) {
  if (!card) return null;
  return {
    v: card.slice(0, -1),
    s: SUIT_MAP[card.slice(-1)] || card.slice(-1),
  };
}

function BaccaratCard({ card, highlight, dealIdx = 0 }) {
  if (!card) {
    return <div className="bac-card-slot" />;
  }

  const red = RED_SUITS.has(card.s);
  const isFace = ["J", "Q", "K"].includes(card.v);
  const isAce = card.v === "A";
  const numValue = isFace ? 0 : parseInt(card.v, 10) || 1;

  const renderPips = () => {
    if (isFace) {
      const FaceComponent = getFaceCardComponent(card.s, card.v);
      return (
        <div className="bj-card-center-face">
          {FaceComponent ? <FaceComponent size={56} /> : <span className="bj-card-center-letter">{card.v}</span>}
        </div>
      );
    }

    if (isAce) {
      return (
        <div className="bj-card-center-ace">
          <span className="bj-ace-big">{card.s}</span>
        </div>
      );
    }

    const pipPositions = {
      2: ["top", "bottom"],
      3: ["top", "center", "bottom"],
      4: ["top-left", "top-right", "bottom-left", "bottom-right"],
      5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
      6: ["top-left", "top-right", "center-left", "center-right", "bottom-left", "bottom-right"],
      7: ["top-left", "top-right", "center-top", "center", "center-bottom", "bottom-left", "bottom-right"],
      8: ["top-left", "top-right", "center-top-left", "center-top-right", "center-bottom-left", "center-bottom-right", "bottom-left", "bottom-right"],
      9: ["top-left", "top-right", "center", "top-center", "center-left", "center-right", "bottom-left", "bottom-right", "bottom-center"],
      10: ["top-left", "top-right", "center", "top-center", "center-top-left", "center-top-right", "center-bottom-left", "center-bottom-right", "bottom-left", "bottom-right", "bottom-center"],
    };
    const positions = pipPositions[numValue] || [];

    return (
      <div className="bj-card-center-pips">
        {positions.map((pos, i) => (
          <span key={i} className={`bj-pip bj-pip-${pos}`}>{card.s}</span>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`bj-card bac-card${red ? " red" : ""}${highlight ? " bj-card-hl" : ""}`}
      style={{ animationDelay: `${dealIdx * 0.08}s` }}
    >
      <span className="bj-card-tl">{card.v}<br />{card.s}</span>
      {renderPips()}
      <span className="bj-card-br">{card.v}<br />{card.s}</span>
    </div>
  );
}

function Hand({ label, sub, total, cards, accent, revealed, count }) {
  const displayCards = cards.slice(0, revealed);
  const placeholders = Math.max(0, count - displayCards.length);
  return (
    <div className={`bac-hand bac-${accent}`}>
      <div className="bac-hand-header">
        <div>
          <div className="bac-hand-label">{label}</div>
          <div className="bac-hand-sub">{sub}</div>
        </div>
        <div className="bac-hand-total">{revealed > 0 ? `點數 ${total}` : "待發牌"}</div>
      </div>
      <div className="bac-hand-line">
        {displayCards.map((card, idx) => (
          <BaccaratCard key={`${accent}-${idx}-${card.v}${card.s}`} card={card} dealIdx={idx} />
        ))}
        {Array.from({ length: placeholders }).map((_, idx) => (
          <BaccaratCard key={`${accent}-slot-${idx}`} card={null} />
        ))}
      </div>
    </div>
  );
}

function ResultBadge({ result, net, totalWin, betType, betAmount, settling }) {
  const area = BET_AREAS.find(item => item.key === betType);
  const title = result === "player" ? "閒勝" : result === "banker" ? "莊勝" : result === "tie" ? "和局" : "等待開局";

  return (
    <div className={`bac-result-pill ${result || ""}${settling ? " settling" : ""}`}>
      <div className="bac-result-title">{title}</div>
      <div className={`bac-result-net ${net >= 0 ? "win" : "lose"}`}>{net >= 0 ? "+" : ""}{net ?? 0}</div>
      <div className="bac-result-meta">
        押注 {area?.zh || "-"} {betAmount ?? 0} 顆
        <br />
        入帳 {totalWin ?? 0} 顆
      </div>
    </div>
  );
}

export default function BaccaratGame({ token, apples, onApplesChange }) {
  const [settings, setSettings] = useState(null);
  const [selectedBet, setSelectedBet] = useState("player");
  const [betAmount, setBetAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [displayedPlayer, setDisplayedPlayer] = useState([]);
  const [displayedBanker, setDisplayedBanker] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const timeoutsRef = useRef([]);

  const clearTimers = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => () => clearTimers(), []);

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
  const parsedPlayerCards = useMemo(() => (result?.playerCards || []).map(parseCard), [result]);
  const parsedBankerCards = useMemo(() => (result?.bankerCards || []).map(parseCard), [result]);

  function changeBet(delta) {
    const max = settings?.max_bet || 200;
    setBetAmount(prev => Math.max(1, Math.min(prev + delta, max)));
  }

  function animateDeal(data) {
    clearTimers();
    const playerCards = (data.playerCards || []).map(parseCard);
    const bankerCards = (data.bankerCards || []).map(parseCard);
    setDisplayedPlayer([]);
    setDisplayedBanker([]);
    setShowResult(false);
    setSettling(true);

    const steps = [];
    if (playerCards[0]) steps.push(() => setDisplayedPlayer(prev => [...prev, playerCards[0]]));
    if (bankerCards[0]) steps.push(() => setDisplayedBanker(prev => [...prev, bankerCards[0]]));
    if (playerCards[1]) steps.push(() => setDisplayedPlayer(prev => [...prev, playerCards[1]]));
    if (bankerCards[1]) steps.push(() => setDisplayedBanker(prev => [...prev, bankerCards[1]]));
    if (playerCards[2]) steps.push(() => setDisplayedPlayer(prev => [...prev, playerCards[2]]));
    if (bankerCards[2]) steps.push(() => setDisplayedBanker(prev => [...prev, bankerCards[2]]));

    steps.forEach((step, idx) => {
      timeoutsRef.current.push(setTimeout(step, 240 + idx * 280));
    });

    timeoutsRef.current.push(setTimeout(() => {
      setResult(data);
      setDisplayedPlayer(playerCards);
      setDisplayedBanker(bankerCards);
      setShowResult(true);
      setSettling(false);
    }, 240 + steps.length * 280 + 220));
  }

  async function deal() {
    if (loading || settling || (apples ?? 0) < betAmount) return;
    setLoading(true);
    setError("");
    setResult(null);
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
      if (onApplesChange) onApplesChange(data.newApples);
      animateDeal(data);
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setLoading(false);
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
  const playerCount = Math.max(2, parsedPlayerCards.length || displayedPlayer.length || 2);
  const bankerCount = Math.max(2, parsedBankerCards.length || displayedBanker.length || 2);

  return (
    <div className="bac-root">
      <div className="bac-marquee">
        <div className="bac-title-wrap">
          <div className="bac-subtitle">免佣百家樂</div>
        </div>
        <div className="bac-marquee-center">
          <div className={`bj-hours-badge ${open ? "open" : "closed"}`}>
            <span>{open ? "🟢" : "🔴"}</span>
            <span className="bj-hours-text">{openStr} – {closeStr}</span>
          </div>
        </div>
        <button
          className={`bac-help-btn${showHelp ? " active" : ""}`}
          onClick={() => setShowHelp(v => !v)}
        >？玩法說明</button>
      </div>
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      <div className="bac-surface">
        <div className="bac-table-shell">
          <div className="bac-table-felt">
            <div className="bac-layout-top">
              <div className="bac-chip-bank">
                <div className="bac-bank-label">可用金蘋果</div>
                <div className="bac-bank-value">
                  <img src="/gifts/gold_apple.gif" alt="" />
                  <span>{apples ?? 0}</span>
                </div>
              </div>
              <div className="bac-center-logo">
                <div className="bac-center-mark">B</div>
                <div className="bac-center-text">免佣百家樂</div>
              </div>
              <div className="bac-limit-box">
                <div>單注上限</div>
                <strong>{settings.max_bet}</strong>
              </div>
            </div>

            <div className="bac-hands-stage">
              <Hand
                label="PLAYER"
                sub="閒家"
                accent="player"
                total={result?.playerTotal}
                cards={displayedPlayer}
                revealed={displayedPlayer.length}
                count={playerCount}
              />
              <div className="bac-mid">
                {showResult && result ? (
                  <ResultBadge
                    result={result.result}
                    net={result.net}
                    totalWin={result.totalWin}
                    betType={result.betType}
                    betAmount={result.betAmount}
                    settling={settling}
                  />
                ) : (
                  <div className={`bac-dealer-shoe ${settling ? "active" : ""}`}>
                    <div className="bac-dealer-card back one" />
                    <div className="bac-dealer-card back two" />
                    <div className="bac-shoe-label">{settling ? "發牌中" : "等候下注"}</div>
                  </div>
                )}
              </div>
              <Hand
                label="BANKER"
                sub="莊家"
                accent="banker"
                total={result?.bankerTotal}
                cards={displayedBanker}
                revealed={displayedBanker.length}
                count={bankerCount}
              />
            </div>

            <div className="bac-betting-rail">
              {BET_AREAS.map(area => (
                <button
                  key={area.key}
                  className={`bac-bet-zone ${area.accent}${selectedBet === area.key ? " active" : ""}`}
                  onClick={() => setSelectedBet(area.key)}
                  disabled={loading || settling}
                >
                  <span className="bac-bet-en">{area.label}</span>
                  <span className="bac-bet-zh">{area.zh}</span>
                  <span className="bac-bet-sub">{area.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bac-control-bar">
          <div className="bac-chip-row">
            {CHIPS.map(chip => (
              <button
                key={chip}
                className={`bj-chip bj-chip-${chipColor(chip)}${betAmount === chip ? " active" : ""}`}
                onClick={() => setBetAmount(Math.min(chip, settings.max_bet || 200))}
                disabled={loading || settling || chip > (settings.max_bet || 200)}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="bac-stepper">
            <button onClick={() => changeBet(-1)} disabled={loading || settling || betAmount <= 1}>－</button>
            <span className="bac-stepper-value">
              {betAmount}
              <img src="/gifts/gold_apple.gif" alt="" />
            </span>
            <button onClick={() => changeBet(1)} disabled={loading || settling || betAmount >= (settings.max_bet || 200)}>＋</button>
          </div>

          <button
            className="bac-deal-btn"
            onClick={deal}
            disabled={loading || settling || !open || (apples ?? 0) < betAmount}
          >
            {settling ? "牌局進行中…" : loading ? "送出下注…" : "發牌"}
          </button>
        </div>

        {error && <div className="bac-error">{error}</div>}
      </div>
    </div>
  );
}
