// BlackjackGame.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import "./BlackjackGame.css";
import { getFaceCardComponent } from "./CardFaces";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";

// ── Card helpers ────────────────────────────────────────────────
const RED_SUITS = new Set(["♥", "♦"]);

function cardNum(v) {
  if (v === "A") return 11;
  if (["J","Q","K","10"].includes(v)) return 10;
  return parseInt(v, 10);
}

function handTotal(hand) {
  if (!hand) return 0;
  let sum = 0, aces = 0;
  for (const c of hand) {
    if (c.hidden) continue;
    sum += cardNum(c.v);
    if (c.v === "A") aces++;
  }
  while (sum > 21 && aces > 0) { sum -= 10; aces--; }
  return sum;
}

function handLabel(total, hand) {
  if (!hand) return "";
  const vis = hand.filter(c => !c.hidden);
  const isNat = vis.length === 2 && total === 21;
  if (isNat) return "BlackJack! 🃏";
  if (total > 21) return `${total} 爆牌`;
  return String(total);
}

// ── Single Card component ────────────────────────────────────────
function Card({ card, small, highlight, dealIdx = 0 }) {
  if (!card) return null;
  
  // 牌背
  if (card.hidden) {
    return (
      <div
        className={`bj-card bj-card-back${small ? " small" : ""}${highlight ? " bj-card-hl" : ""}`}
        style={{ animationDelay: `${dealIdx * 0.12}s` }}
      >
        <div className="bj-card-back-inner" />
      </div>
    );
  }

  const red = RED_SUITS.has(card.s);
  const isFace = ["J", "Q", "K"].includes(card.v);
  const isAce = card.v === "A";
  const numValue = isFace ? 0 : parseInt(card.v) || 1;

  // 牌面中央內容
  const renderPips = () => {
    // 人頭牌 J/Q/K
    if (isFace) {
      const FaceComponent = getFaceCardComponent(card.s, card.v);
      const svgSize = small ? 40 : 58;
      return (
        <div className="bj-card-center-face">
          {FaceComponent ? (
            <FaceComponent size={svgSize} />
          ) : (
            <span className="bj-card-center-letter">{card.v}</span>
          )}
        </div>
      );
    }

    // Ace
    if (isAce) {
      return (
        <div className="bj-card-center-ace">
          <span className="bj-ace-big">{card.s}</span>
        </div>
      );
    }

    // 數字牌 2-10
    const pipPositions = {
      2: ["top", "bottom"],
      3: ["top", "center", "bottom"],
      4: ["top-left", "top-right", "bottom-left", "bottom-right"],
      5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
      6: ["top-left", "top-right", "center-left", "center-right", "bottom-left", "bottom-right"],
      7: ["top-left", "top-right", "center-top", "center", "center-bottom", "bottom-left", "bottom-right"],
      8: ["top-left", "top-right", "center-top-left", "center-top-right", "center-bottom-left", "center-bottom-right", "bottom-left", "bottom-right"],
      9: ["top-left", "top-right", "center", "top-center", "center-left", "center-right", "bottom-left", "bottom-right", "bottom-center"],
      10: ["top-left", "top-right", "center", "top-center", "center-top-left", "center-top-right", "center-bottom-left", "center-bottom-right", "bottom-left", "bottom-right", "bottom-center"]
    };

    const positions = pipPositions[numValue] || [];

    return (
      <div className={`bj-card-center-pips bj-pips-${numValue}`}>
        {positions.map((pos, i) => (
          <span key={i} className={`bj-pip bj-pip-${pos}`}>{card.s}</span>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`bj-card${red ? " red" : ""}${small ? " small" : ""}${highlight ? " bj-card-hl" : ""}`}
      style={{ animationDelay: `${dealIdx * 0.12}s` }}
    >
      <span className="bj-card-tl">{card.v}<br />{card.s}</span>
      {renderPips()}
      <span className="bj-card-br">{card.v}<br />{card.s}</span>
    </div>
  );
}

// ── Hand component ───────────────────────────────────────────────
function Hand({ cards, value, label, result, isActive, bet, small }) {
  const resultClass = result
    ? { win: "bj-result-win", blackjack: "bj-result-bj", five_card: "bj-result-five",
        lose: "bj-result-lose", push: "bj-result-push", bust: "bj-result-bust",
        surrender: "bj-result-surr" }[result] || ""
    : "";
  const total = value ?? handTotal(cards);

  return (
    <div className={`bj-hand${isActive ? " bj-hand-active" : ""}${result ? " bj-hand-done" : ""}`}>
      {label && <div className="bj-hand-label">{label}</div>}
      <div className="bj-cards-row">
        {(cards || []).map((c, i) => (
          <Card key={i} card={c} small={small} dealIdx={i}
            highlight={result === "blackjack" || result === "win"} />
        ))}
      </div>
      <div className={`bj-hand-score ${total > 21 ? "bust" : total === 21 ? "bj21" : ""}`}>
        {handLabel(total, cards)}
      </div>
      {result && (
        <div className={`bj-hand-result ${resultClass}`}>
          {result === "blackjack"  && "🏆 BlackJack!"}
          {result === "five_card"  && "🐉 過五關！"}
          {result === "win"        && "✅ 贏了"}
          {result === "lose"       && "❌ 輸了"}
          {result === "push"       && "🤝 平局"}
          {result === "bust"       && "💥 爆牌"}
          {result === "surrender"  && "🏳️ 投降"}
        </div>
      )}
      {bet != null && (
        <div className="bj-hand-bet">
          <img src="/gifts/gold_apple.gif" alt="" style={{ width:13, height:13, verticalAlign:"middle" }} />
          {" "}{bet}
        </div>
      )}
    </div>
  );
}

// ── Chip Selector ────────────────────────────────────────────────
const CHIPS = [1, 5, 10, 25, 50, 100, 200];
const chipColor = c =>
  c <= 1 ? "silver" : c <= 5 ? "orange" : c <= 10 ? "red" : c <= 25 ? "green" : c <= 50 ? "blue" : c <= 100 ? "black" : "purple";

function ChipSelector({ bet, setBet, min, max, disabled, apples }) {
  const [step, setStep] = useState(null);

  function addChip(c) {
    setStep(c);
    setBet(b => Math.min(max, b + c));
  }

  return (
    <div className="bj-chips-wrap">
      <div className="bj-chips-row">
        {CHIPS.filter(c => c <= max).map(c => (
          <button
            key={c}
            className={`bj-chip bj-chip-${chipColor(c)}${step === c ? " active" : ""}`}
            onClick={() => addChip(c)}
            disabled={disabled || c > apples}
          >{c}</button>
        ))}
      </div>
      <div className="bj-bet-custom">
        <span className="bj-chip-label">下注金額</span>
        <button className="bj-amt-btn" onClick={() => setBet(b => Math.max(0, b - step))} disabled={disabled || !step}>－</button>
        <span className="bj-amt-val">
          {bet}
          <img src="/gifts/gold_apple.gif" alt="" style={{ width:14, height:14, verticalAlign:"middle", marginLeft:3 }} />
        </span>
        <button className="bj-amt-btn" onClick={() => setBet(b => Math.min(max, b + step))} disabled={disabled || !step}>＋</button>
        <button className="bj-amt-btn bj-amt-clear" onClick={() => { setBet(0); setStep(null); }} disabled={disabled} title="清除">✕</button>
        <span className="bj-range-note">{min}–{max}</span>
      </div>
    </div>
  );
}

// ── Action Buttons ───────────────────────────────────────────────
function ActionButtons({ game, onAction, loading }) {
  if (!game || game.state === "finished") return null;
  const { canHit, canStand, canDouble, canSplit, canSurrender, canInsurance } = game;
  const insuranceCost = Math.floor((game.betAmounts?.[0] || 0) / 2);

  if (game.state === "insurance_offered") {
    return (
      <div className="bj-actions">
        <div className="bj-insurance-prompt">
          莊家亮出 A，是否投保？（花費 {insuranceCost} 顆）
        </div>
        <div className="bj-actions-row">
          <button className="bj-btn bj-btn-insurance" onClick={() => onAction("insurance")} disabled={loading || !canInsurance}>
            投保 (2:1)
          </button>
          <button className="bj-btn bj-btn-no-insurance" onClick={() => onAction("no_insurance")} disabled={loading}>
            不投保
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bj-actions">
      <div className="bj-actions-row">
        {canHit && (
          <button className="bj-btn bj-btn-hit" onClick={() => onAction("hit")} disabled={loading}>
            🃏 補牌 (H)
          </button>
        )}
        {canStand && (
          <button className="bj-btn bj-btn-stand" onClick={() => onAction("stand")} disabled={loading}>
            ✋ 停牌 (S)
          </button>
        )}
        {canDouble && (
          <button className="bj-btn bj-btn-double" onClick={() => onAction("double")} disabled={loading}>
            ✌️ 加倍 (D)
          </button>
        )}
        {canSplit && (
          <button className="bj-btn bj-btn-split" onClick={() => onAction("split")} disabled={loading}>
            ↔️ 分牌 (P)
          </button>
        )}
        {canSurrender && (
          <button className="bj-btn bj-btn-surr" onClick={() => onAction("surrender")} disabled={loading}>
            🏳️ 投降
          </button>
        )}
      </div>
    </div>
  );
}

// ── Result Summary ───────────────────────────────────────────────
function ResultSummary({ game, onReset }) {
  if (!game || game.state !== "finished" || !game.handResults) return null;
  const { handResults, dealerTotal, dealerHasBJ, totalPayout, insurancePayout, betAmounts } = game;
  const totalBet = (betAmounts || []).reduce((s, b) => s + b, 0) + (game.insuranceBet || 0);
  const net = (totalPayout || 0) - totalBet;

  return (
    <div className="bj-result-summary">
      {(handResults || []).map((hr, i) => (
        <div key={i} className={`bj-result-row bj-result-row-${hr.result === "five_card" ? "fivecard" : hr.result}`}>
          <span className="bj-result-label">
            {handResults.length > 1 ? `手牌 ${i + 1}：` : ""}
            {hr.result === "blackjack"  && "🏆 BlackJack"}
            {hr.result === "five_card"  && "🐉 過五關！"}
            {hr.result === "win"        && "✅ 獲勝"}
            {hr.result === "lose"       && "❌ 落敗"}
            {hr.result === "push"       && "🤝 平局"}
            {hr.result === "bust"       && "💥 爆牌"}
            {hr.result === "surrender"  && "🏳️ 投降"}
          </span>
          <span className="bj-result-payout">
            {hr.payout > 0 ? `+${hr.payout}` : `-${hr.bet}`}
            <img src="/gifts/gold_apple.gif" alt="" style={{ width:13, height:13, verticalAlign:"middle", marginLeft:3 }} />
          </span>
        </div>
      ))}
      {insurancePayout > 0 && (
        <div className="bj-result-row bj-result-row-win">
          <span className="bj-result-label">🛡️ 保險賠付</span>
          <span className="bj-result-payout">+{insurancePayout} 🍎</span>
        </div>
      )}
      {insurancePayout === 0 && (game.insuranceBet || 0) > 0 && (
        <div className="bj-result-row bj-result-row-lose">
          <span className="bj-result-label">🛡️ 保險落敗</span>
          <span className="bj-result-payout">-{game.insuranceBet} 🍎</span>
        </div>
      )}
      <div className={`bj-result-total ${net >= 0 ? "pos" : "neg"}`}>
        {net > 0
          ? <span>🎉 淨贏 <strong>{net}</strong> 顆金蘋果！</span>
          : net === 0
          ? <span>持平，下次再試！</span>
          : <span>😢 淨輸 <strong>{Math.abs(net)}</strong> 顆金蘋果</span>
        }
        {dealerHasBJ && <div className="bj-dealer-bj-note">莊家天牌 BlackJack！</div>}
      </div>
      <button className="bj-again-btn" onClick={onReset}>再玩一次</button>
    </div>
  );
}

// ── Help overlay ─────────────────────────────────────────────────
function HelpPanel({ onClose }) {
  return (
    <div className="bj-help-popover">
      <div className="bj-help-header">
        <span>玩法說明</span>
        <button className="bj-help-close" onClick={onClose}>✕</button>
      </div>
      <div className="bj-help-body">
        <p className="bj-help-intro">目標：手牌點數比莊家大，且不超過 21 點。</p>
        <table className="bj-help-table">
          <thead><tr><th>操作</th><th>說明</th></tr></thead>
          <tbody>
            <tr><td>補牌 (H)</td><td>再取一張牌</td></tr>
            <tr><td>停牌 (S)</td><td>不再取牌，等莊家揭牌</td></tr>
            <tr><td>加倍 (D)</td><td>前兩張時可加倍下注，只再取一張牌</td></tr>
            <tr><td>分牌 (P)</td><td>兩張同點數可分成兩手，各自對賭（最多4手）</td></tr>
            <tr><td>投降</td><td>放棄本局，收回半數下注</td></tr>
            <tr><td>投保</td><td>莊家亮A時可投保（花費原注一半），若莊家有BlackJack則 1賠2；若無則保險金沒收</td></tr>
          </tbody>
        </table>
        <table className="bj-help-table" style={{ marginTop: 8 }}>
          <thead><tr><th>結果</th><th>賠率（下注1贏幾）</th></tr></thead>
          <tbody>
            <tr>
              <td>天牌 BlackJack</td>
              <td className="bj-help-pay">
                <strong>1賠1.5</strong>（下注20贏30）<br />
                <small style={{color:"#aaa"}}>※ 分牌後A+10僅算一般21，不享1賠1.5</small>
              </td>
            </tr>
            <tr>
              <td>🐉 過五關（5張不爆且勝出）</td>
              <td className="bj-help-pay">
                <strong>1賠2</strong>（下注20贏40）<br />
                <small style={{color:"#aaa"}}>※ 需點數大於莊家或莊家爆牌；平局/落敗照常算</small>
              </td>
            </tr>
            <tr><td>一般獲勝</td><td className="bj-help-pay"><strong>1賠1</strong>（下注20贏20）</td></tr>
            <tr><td>平局</td><td className="bj-help-pay">退還原注，不賠不賺</td></tr>
            <tr><td>投降</td><td className="bj-help-pay">退回半注（損失下注的一半）</td></tr>
            <tr>
              <td>保險賠付</td>
              <td className="bj-help-pay">
                <strong>1賠2</strong>（投保10贏20）<br />
                <small style={{color:"#aaa"}}>※ 莊家無BJ則保險金沒收</small>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="bj-help-note">
          ⚠️ 莊家抽牌規則：點數 &lt;17 或軟17時補牌，其餘停牌。<br />
          ⚠️ 分牌後的A只各取一張，不可再補牌。
        </p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────
export default function BlackjackGame({ token, apples, onApplesChange }) {
  const [settings, setSettings]   = useState(null);
  const [loadErr, setLoadErr]     = useState("");
  const [game, setGame]           = useState(null);
  const [bet, setBet]             = useState(0);
  const [loading, setLoading]     = useState(false);
  const [errMsg, setErrMsg]       = useState("");
  const [showHelp, setShowHelp]   = useState(false);
  const [animKey, setAnimKey]     = useState(0);
  const tableRef = useRef(null);

  // Keyboard shortcuts during player_turn
  useEffect(() => {
    if (!game || game.state !== "player_turn") return;
    function onKey(e) {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "h" || e.key === "H") { if (game.canHit)    doAction("hit"); }
      if (e.key === "s" || e.key === "S") { if (game.canStand)  doAction("stand"); }
      if (e.key === "d" || e.key === "D") { if (game.canDouble) doAction("double"); }
      if (e.key === "p" || e.key === "P") { if (game.canSplit)  doAction("split"); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // Load settings + check for active game
  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${BACKEND}/api/blackjack/settings`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch(`${BACKEND}/api/blackjack/active`,   { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([s, a]) => {
      setSettings(s);
      if (a.game) {
        setGame(a.game);
        setBet(a.game.betAmounts?.[0] || 10);
      }
    }).catch(() => setLoadErr("無法載入21點設定"));
  }, [token]);

  function updateApples(newApples) {
    if (onApplesChange && newApples != null) onApplesChange(newApples);
  }

  async function startGame() {
    setErrMsg(""); setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/blackjack/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bet }),
      });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error || "開局失敗"); return; }
      setGame(data);
      setAnimKey(k => k + 1);
      updateApples(data.newApples);
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch { setErrMsg("連線失敗，請稍後再試"); }
    finally { setLoading(false); }
  }

  const doAction = useCallback(async (action) => {
    if (!game || loading) return;
    setErrMsg(""); setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/blackjack/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameId: game.gameId, action }),
      });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error || "操作失敗"); return; }
      if (action === "hit" || action === "split") setAnimKey(k => k + 1);
      setGame(data);
      updateApples(data.newApples);
    } catch { setErrMsg("連線失敗，請稍後再試"); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, loading, token]);

  function resetGame() {
    setGame(null);
    setErrMsg("");
    setBet(prev => prev);
  }

  function fmtHour(h, m) {
    if (h === 24 && m === 0) {
      return "24:00";
    }
    if (h >= 24) {
      const hh = h % 24;
      return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}（次日）`;
    }
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function isOpenNow(s) {
    if (!s?.blackjack_enabled) return false;
    const now = new Date();
    const h = (now.getUTCHours() + 8) % 24;
    const cur = h * 60 + now.getUTCMinutes();
    const open  = s.blackjack_open_hour * 60 + s.blackjack_open_minute;
    const close = s.blackjack_close_hour >= 24 ? 24 * 60 : s.blackjack_close_hour * 60 + s.blackjack_close_minute;
    return cur >= open && cur < close;
  }

  if (loadErr) return <div className="bj-error">{loadErr}</div>;
  if (!settings) return <div className="bj-loading">載入中…</div>;

  const open    = isOpenNow(settings);
  const oh      = fmtHour(settings.blackjack_open_hour,  settings.blackjack_open_minute);
  const ch      = fmtHour(settings.blackjack_close_hour, settings.blackjack_close_minute);
  const minBet  = 1;
  const maxBet  = settings.blackjack_max_bet || 200;

  const phase = !game ? "betting" : game.state === "finished" ? "finished" : "playing";
  const isIdle = phase === "betting";

  return (
    <div className="bj-root">
      {/* Help button */}
      <button
        className={`bj-help-btn${showHelp ? " active" : ""}`}
        onClick={() => setShowHelp(v => !v)}
        title="玩法說明"
      >玩法說明</button>
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      {/* Open hours badge */}
      <div className={`bj-hours-badge ${open ? "open" : "closed"}`}>
        {open ? "🟢 開放中" : "🔴 未開放"}&nbsp;
        <span className="bj-hours-text">{oh} – {ch}</span>
      </div>

      {/* Table */}
      <div className="bj-table" ref={tableRef} key={animKey}>

        {/* Dealer area */}
        <div className="bj-area bj-dealer-area">
          <div className="bj-area-title">莊家
            {game && game.state !== "betting" && (
              <span className={`bj-score ${game.dealerValue > 21 ? "bust" : game.dealerValue === 21 ? "bj21" : ""}`}>
                {game.state === "finished"
                  ? handLabel(game.dealerValue, game.dealerHand)
                  : game.dealerValue > 0 ? `顯示 ${game.dealerValue}` : ""}
              </span>
            )}
          </div>
          <div className="bj-cards-row">
            {game?.dealerHand?.map((c, i) => (
              <Card key={i} card={c} dealIdx={i}
                highlight={game.state === "finished" && game.dealerValue > 0 && !game.dealerValue > 21} />
            ))}
            {!game && (
              <div className="bj-placeholder-cards">
                <div className="bj-card bj-card-placeholder" />
                <div className="bj-card bj-card-placeholder" />
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="bj-table-divider">
          <span className="bj-table-logo">♠ 21點 ♥</span>
        </div>

        {/* Player area */}
        <div className="bj-area bj-player-area">
          <div className="bj-area-title">玩家</div>
          {game && (game.playerHands || []).length > 0 ? (
            <div className={`bj-player-hands bj-hands-${(game.playerHands || []).length}`}>
              {(game.playerHands || []).map((hand, idx) => (
                <Hand
                  key={idx}
                  cards={hand}
                  value={(game.playerHandValues || [])[idx]}
                  result={game.state === "finished" ? game.handResults?.[idx]?.result : null}
                  isActive={game.state === "player_turn" && idx === game.currentHandIdx}
                  bet={(game.betAmounts || [])[idx]}
                  label={(game.playerHands || []).length > 1 ? `手牌 ${idx + 1}` : null}
                />
              ))}
            </div>
          ) : (
            <div className="bj-placeholder-cards">
              <div className="bj-card bj-card-placeholder" />
              <div className="bj-card bj-card-placeholder" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bj-controls">

        {/* Betting phase */}
        {isIdle && (
          <>
            <ChipSelector
              bet={bet}
              setBet={b => setBet(typeof b === "function" ? b(bet) : b)}
              min={minBet}
              max={maxBet}
              disabled={loading || !open}
              apples={apples ?? 0}
            />
            <button
              className="bj-start-btn"
              onClick={startGame}
              disabled={loading || !open || bet < 1 || bet < minBet || bet > (apples ?? 0)}
            >
              {!open
                ? `未開放 (${oh} – ${ch})`
                : loading
                ? "⏳ 開局中…"
                : `🃏 開始遊戲（下注 ${bet} 顆）`}
            </button>
          </>
        )}

        {/* Playing phase */}
        {phase === "playing" && (
          <ActionButtons game={game} onAction={doAction} loading={loading} />
        )}

        {/* Current bet info during play */}
        {phase === "playing" && game && (
          <div className="bj-current-bet">
            已下注：{(game.betAmounts || []).reduce((s,b)=>s+b,0)}
            {(game.insuranceBet || 0) > 0 && ` + 保險 ${game.insuranceBet}`}
            &nbsp;顆金蘋果
          </div>
        )}

        {/* Results */}
        {phase === "finished" && (
          <ResultSummary game={game} onReset={resetGame} />
        )}

        {/* Error */}
        {errMsg && <div className="bj-errmsg">⚠️ {errMsg}</div>}

        {loading && phase === "playing" && (
          <div className="bj-loading-overlay">處理中…</div>
        )}
      </div>
    </div>
  );
}
