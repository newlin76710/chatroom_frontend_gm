import { useRef, useEffect, useState, useCallback } from "react";
import "./RouletteGame.css";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";

const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const RED_SET = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const SEG_COUNT = WHEEL_ORDER.length;
const SEG_ANGLE = (2 * Math.PI) / SEG_COUNT;

const BET_LABELS = {
  big:         "大 (19–36)",
  small:       "小 (1–18)",
  red:         "🔴 紅色",
  black:       "⚫ 黑色",
  red_big:     "🔴大",
  red_small:   "🔴小",
  black_big:   "⚫大",
  black_small: "⚫小",
};

function numColor(n) {
  if (n === 0) return "#1a8a45";
  return RED_SET.has(n) ? "#c0392b" : "#111111";
}

/* ─── Canvas ────────────────────────────────────────────────── */
function drawWheel(canvas, rotation, highlightIdx) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) / 2 - 8;
  const textR  = outerR * 0.73;
  const hubR   = outerR * 0.13;

  ctx.clearRect(0, 0, W, H);

  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 7, 0, 2 * Math.PI);
  ctx.fillStyle = "#1a0a00";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 3, 0, 2 * Math.PI);
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 5;
  ctx.stroke();

  WHEEL_ORDER.forEach((num, i) => {
    const startA = -Math.PI / 2 + rotation + i * SEG_ANGLE;
    const endA   = startA + SEG_ANGLE;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startA, endA);
    ctx.closePath();
    ctx.fillStyle = highlightIdx === i ? "#ffd700" : numColor(num);
    ctx.fill();
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    const midA = startA + SEG_ANGLE / 2;
    const tx   = cx + textR * Math.cos(midA);
    const ty   = cy + textR * Math.sin(midA);

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(midA + Math.PI / 2);
    ctx.fillStyle = highlightIdx === i ? "#000" : "#fff";
    ctx.font = `bold ${Math.max(8, Math.round(outerR * 0.082))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 2;
    ctx.fillText(String(num), 0, 0);
    ctx.restore();
  });

  for (let i = 0; i < SEG_COUNT; i++) {
    const a = -Math.PI / 2 + rotation + i * SEG_ANGLE;
    ctx.beginPath();
    ctx.moveTo(cx + hubR * 1.5 * Math.cos(a), cy + hubR * 1.5 * Math.sin(a));
    ctx.lineTo(cx + outerR  * Math.cos(a), cy + outerR  * Math.sin(a));
    ctx.strokeStyle = "rgba(212,175,55,0.5)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  const hubGrad = ctx.createRadialGradient(cx - hubR*0.2, cy - hubR*0.2, 0, cx, cy, hubR);
  hubGrad.addColorStop(0, "#fff7cc");
  hubGrad.addColorStop(0.5, "#d4af37");
  hubGrad.addColorStop(1, "#7a5c00");
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, 2 * Math.PI);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, hubR * 0.25, 0, 2 * Math.PI);
  ctx.fillStyle = "#111";
  ctx.fill();

  // Pointer (tip points down toward wheel)
  ctx.beginPath();
  ctx.moveTo(cx, 20);
  ctx.lineTo(cx - 10, 2);
  ctx.lineTo(cx + 10, 2);
  ctx.closePath();
  ctx.fillStyle = "#ffd700";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
}

/* ─── bet key helpers ───────────────────────────────────────── */
function betKey(bet) {
  return bet.type === "number" ? `num:${bet.value}` : bet.type;
}

/* ─── Main component ─────────────────────────────────────────── */
export default function RouletteGame({ token, onApplesChange }) {
  const canvasRef    = useRef(null);
  const rafRef       = useRef(null);
  const startTimeRef = useRef(null);
  const baseRotRef   = useRef(0);

  const [phase, setPhase]         = useState("idle");
  const [settings, setSettings]   = useState(null);
  const [loadErr, setLoadErr]     = useState("");

  // Multi-select: Set of bet keys  →  array of { type, value? }
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [selectedBets, setSelectedBets] = useState([]);

  const [betAmount, setBetAmount] = useState(1);
  const [result, setResult]       = useState(null);
  const [errMsg, setErrMsg]       = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const SPIN_DURATION = 10000;
  const EXTRA_SPINS   = 6;

  /* Load settings */
  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/roulette/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setSettings(d))
      .catch(() => setLoadErr("無法載入輪盤設定"));
  }, [token]);

  /* Draw */
  const draw = useCallback((rotation, hiIdx = -1) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawWheel(canvas, rotation, hiIdx);
  }, []);

  useEffect(() => { draw(0); }, [draw]);

  /* Toggle a bet selection */
  function toggleBet(bet) {
    if (phase !== "idle") return;
    const key = betKey(bet);
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= 10) return prev;
        next.add(key);
      }
      return next;
    });
    setSelectedBets(prev => {
      const exists = prev.find(b => betKey(b) === key);
      if (exists) return prev.filter(b => betKey(b) !== key);
      if (prev.length >= 10) return prev;
      return [...prev, bet];
    });
  }

  function isSel(bet) { return selectedKeys.has(betKey(bet)); }

  /* Spin animation */
  function startSpin(targetResult) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const resultIdx = WHEEL_ORDER.indexOf(targetResult);

    // Normalize accumulated rotation to [0, 2π) before computing delta,
    // so the formula stays accurate across multiple games.
    const startRot = baseRotRef.current % (2 * Math.PI);

    // Segment resultIdx center needs to land at angle -π/2 (top, where pointer is).
    // Condition: startRot + delta + resultIdx*SEG_ANGLE + SEG_ANGLE/2 ≡ 0 (mod 2π)
    const segCenter = resultIdx * SEG_ANGLE + SEG_ANGLE / 2;
    const raw  = -(startRot + segCenter);
    const base = ((raw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const totalRot = base + EXTRA_SPINS * 2 * Math.PI;

    // Keep absolute rotation for smooth animation, but use normalised start
    baseRotRef.current = startRot;
    startTimeRef.current = performance.now();

    function frame(now) {
      const t = Math.min((now - startTimeRef.current) / SPIN_DURATION, 1);
      const rotation = startRot + totalRot * (1 - Math.pow(1 - t, 3));
      draw(rotation);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        // Normalize so the next game's formula stays precise
        baseRotRef.current = rotation % (2 * Math.PI);
        setHighlightIdx(resultIdx);
        draw(rotation % (2 * Math.PI), resultIdx);
        setPhase("result");
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  /* Place bet */
  async function placeBet() {
    if (selectedBets.length === 0) { setErrMsg("請至少選擇一種下注"); return; }
    setErrMsg("");
    setResult(null);
    setHighlightIdx(-1);
    setPhase("spinning");

    try {
      const res = await fetch(`${BACKEND}/api/roulette/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bets: selectedBets, amount: betAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("idle");
        setErrMsg(data.error || "下注失敗");
        return;
      }
      setResult(data);
      if (onApplesChange) onApplesChange(data.newApples);
      startSpin(data.result);
    } catch {
      setPhase("idle");
      setErrMsg("連線失敗，請稍後再試");
    }
  }

  function resetGame() {
    setPhase("idle");
    setResult(null);
    setHighlightIdx(-1);
    setSelectedKeys(new Set());
    setSelectedBets([]);
    setBetAmount(1);
    setErrMsg("");
    draw(baseRotRef.current);
  }

  /* Open hours */
  function fmtHour(h, m) {
    return h >= 24 ? "00:00（次日）" : `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
  }
  const isOpen = () => {
    if (!settings || !settings.roulette_enabled) return false;
    const now = new Date();
    const h = (now.getUTCHours() + 8) % 24;
    const cur = h * 60 + now.getUTCMinutes();
    const open  = settings.roulette_open_hour * 60 + settings.roulette_open_minute;
    const close = settings.roulette_close_hour >= 24 ? 24*60 : settings.roulette_close_hour*60 + settings.roulette_close_minute;
    return cur >= open && cur < close;
  };

  /* Number grid */
  const numberGrid = [];
  for (let row = 0; row < 5; row++) {
    const cells = [];
    if (row === 0) {
      const bet = { type: "number", value: 0 };
      cells.push(
        <button key={0}
          className={`rlt-num rlt-green ${isSel(bet) ? "selected" : ""}`}
          onClick={() => toggleBet(bet)}
          disabled={phase !== "idle"}
        >0</button>
      );
    } else {
      for (let col = 1; col <= 9; col++) {
        const n = (row - 1) * 9 + col;
        if (n > 36) break;
        const bet = { type: "number", value: n };
        cells.push(
          <button key={n}
            className={`rlt-num ${RED_SET.has(n) ? "rlt-red" : "rlt-black"} ${isSel(bet) ? "selected" : ""}`}
            onClick={() => toggleBet(bet)}
            disabled={phase !== "idle"}
          >{n}</button>
        );
      }
    }
    numberGrid.push(<div key={row} className="rlt-num-row">{cells}</div>);
  }

  /* Result helpers */
  function resultBadgeClass(n) {
    if (n === 0) return "rlt-result-green";
    return RED_SET.has(n) ? "rlt-result-red" : "rlt-result-black";
  }
  function resultDesc(n) {
    if (n === 0) return "零（綠色）";
    return `${RED_SET.has(n) ? "紅" : "黑"}色・${n <= 18 ? "小" : "大"}`;
  }

  if (loadErr) return <div className="rlt-error">{loadErr}</div>;
  if (!settings) return <div className="rlt-loading">載入中…</div>;

  const open     = isOpen();
  const oh       = fmtHour(settings.roulette_open_hour,  settings.roulette_open_minute);
  const ch       = fmtHour(settings.roulette_close_hour, settings.roulette_close_minute);
  const maxBet   = settings.roulette_max_bet   || 50;
  const numMul   = settings.roulette_num_multiplier   || 36;
  const bhMul    = settings.roulette_bh_multiplier    || 2;
  const comboMul = settings.roulette_combo_multiplier || 4;
  const totalCost = betAmount * selectedBets.length;

  const sb = (type, value) => {
    const bet = value !== undefined ? { type, value } : { type };
    return isSel(bet) ? "selected" : "";
  };
  const tb = (type, value) => {
    const bet = value !== undefined ? { type, value } : { type };
    toggleBet(bet);
  };

  return (
    <div className="rlt-root">
      <div className={`rlt-hours-badge ${open ? "open" : "closed"}`}>
        {open ? "🟢 開放中" : "🔴 未開放"}&nbsp;
        <span className="rlt-hours-text">{oh} – {ch}</span>
      </div>

      <div className="rlt-layout">
        {/* Wheel */}
        <div className="rlt-wheel-wrap">
          <canvas ref={canvasRef} width={260} height={260} className="rlt-canvas" />
          {phase === "spinning" && (
            <div className="rlt-spinning-overlay">
              <div className="rlt-spinner-text">🎰 旋轉中…</div>
            </div>
          )}
        </div>

        {/* Bet panel */}
        <div className="rlt-bet-panel">

          {/* Big / Small */}
          <div className="rlt-bet-section">
            <div className="rlt-section-title">大 / 小 <span className="rlt-multiplier">×{bhMul}</span></div>
            <div className="rlt-btn-row">
              <button className={`rlt-bet-btn rlt-btn-big   ${sb("big")}`}   onClick={() => tb("big")}   disabled={phase !== "idle"}>大 (19–36)</button>
              <button className={`rlt-bet-btn rlt-btn-small ${sb("small")}`} onClick={() => tb("small")} disabled={phase !== "idle"}>小 (1–18)</button>
            </div>
          </div>

          {/* Red / Black */}
          <div className="rlt-bet-section">
            <div className="rlt-section-title">紅 / 黑 <span className="rlt-multiplier">×{bhMul}</span></div>
            <div className="rlt-btn-row">
              <button className={`rlt-bet-btn rlt-btn-red ${sb("red")}`}   onClick={() => tb("red")}   disabled={phase !== "idle"}>🔴 紅色</button>
              <button className={`rlt-bet-btn rlt-btn-blk ${sb("black")}`} onClick={() => tb("black")} disabled={phase !== "idle"}>⚫ 黑色</button>
            </div>
          </div>

          {/* Combo */}
          <div className="rlt-bet-section">
            <div className="rlt-section-title">組合下注 <span className="rlt-multiplier">×{comboMul}</span></div>
            <div className="rlt-btn-row rlt-btn-row-2x2">
              <button className={`rlt-bet-btn rlt-btn-combo-rb ${sb("red_big")}`}     onClick={() => tb("red_big")}     disabled={phase !== "idle"}>🔴大</button>
              <button className={`rlt-bet-btn rlt-btn-combo-rs ${sb("red_small")}`}   onClick={() => tb("red_small")}   disabled={phase !== "idle"}>🔴小</button>
              <button className={`rlt-bet-btn rlt-btn-combo-bb ${sb("black_big")}`}   onClick={() => tb("black_big")}   disabled={phase !== "idle"}>⚫大</button>
              <button className={`rlt-bet-btn rlt-btn-combo-bs ${sb("black_small")}`} onClick={() => tb("black_small")} disabled={phase !== "idle"}>⚫小</button>
            </div>
          </div>

          {/* Number grid */}
          <div className="rlt-bet-section">
            <div className="rlt-section-title">指定數字 <span className="rlt-multiplier">×{numMul}</span>
              <span className="rlt-multiplier-note">（可多選）</span>
            </div>
            <div className="rlt-num-grid">{numberGrid}</div>
          </div>

          {/* Amount + cost summary */}
          <div className="rlt-bet-section rlt-amount-row">
            <span className="rlt-section-title">單注金額</span>
            <div className="rlt-amount-ctrl">
              <button className="rlt-amt-btn" onClick={() => setBetAmount(a => Math.max(1, a - 1))}       disabled={phase !== "idle"}>－</button>
              <span className="rlt-amt-val">
                {betAmount} <img src="/gifts/gold_apple.gif" alt="" style={{width:16,height:16,verticalAlign:"middle"}} />
              </span>
              <button className="rlt-amt-btn" onClick={() => setBetAmount(a => Math.min(maxBet, a + 1))} disabled={phase !== "idle"}>＋</button>
            </div>
            <span className="rlt-max-note">最多 {maxBet} 顆</span>
          </div>

          {/* Selected summary */}
          {phase === "idle" && selectedBets.length > 0 && (
            <div className="rlt-selection">
              已選 {selectedBets.length} 種 × {betAmount} 顆 ＝ 共 <strong>{totalCost}</strong> 顆金蘋果
              <button className="rlt-clear-btn" onClick={() => { setSelectedKeys(new Set()); setSelectedBets([]); }}>清除</button>
            </div>
          )}

          {/* Spin / spinning / result */}
          {phase === "idle" && (
            <button className="rlt-spin-btn" onClick={placeBet}
              disabled={!open || selectedBets.length === 0}>
              {!open ? `未開放 (${oh} – ${ch})` : `🎰 開始旋轉${selectedBets.length > 0 ? ` (共 ${totalCost} 顆)` : ""}`}
            </button>
          )}
          {phase === "spinning" && (
            <button className="rlt-spin-btn spinning" disabled>⏳ 旋轉中（10秒）…</button>
          )}
          {phase === "result" && result && (
            <div className="rlt-result-box">
              <div className="rlt-result-number">
                <span className={`rlt-result-badge ${resultBadgeClass(result.result)}`}>{result.result}</span>
                <span className="rlt-result-desc">{resultDesc(result.result)}</span>
              </div>
              {result.totalWin > 0
                ? <div className="rlt-win">🎉 獲得 <strong>{result.totalWin}</strong> 個金蘋果！</div>
                : <div className="rlt-lose">😢 未中獎，再接再厲！</div>
              }
              {/* Per-bet breakdown */}
              <div className="rlt-bet-breakdown">
                {result.betResults.map((br, i) => {
                  const label = br.type === "number" ? `數字 ${br.value}` : BET_LABELS[br.type] || br.type;
                  return (
                    <div key={i} className={`rlt-br-row ${br.won ? "won" : "lost"}`}>
                      <span>{label}</span>
                      <span>{br.won ? `+${br.winAmount} 🍎` : `－${betAmount} 🍎`}</span>
                    </div>
                  );
                })}
              </div>
              <button className="rlt-again-btn" onClick={resetGame}>再玩一次</button>
            </div>
          )}

          {errMsg && <div className="rlt-errmsg">⚠️ {errMsg}</div>}
        </div>
      </div>
    </div>
  );
}
