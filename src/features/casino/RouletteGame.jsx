import { useRef, useEffect, useState, useCallback } from "react";
import "./RouletteGame.css";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";

const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_SET = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SEG_COUNT = WHEEL_ORDER.length;
const SEG_ANGLE = (2 * Math.PI) / SEG_COUNT;
// Initial rotation so 0 is centred at the pointer (top)
const INIT_ROT = -SEG_ANGLE / 2;

const ODDS_LABEL = {
  straight: "1賠35", split: "1賠17", street: "1賠11",
  corner: "1賠8", line: "1賠5", nine: "1賠3",
  column: "1賠2", dozen: "1賠2",
  red: "1賠1", black: "1賠1", odd: "1賠1", even: "1賠1", big: "1賠1", small: "1賠1",
  red_big: "1賠3", red_small: "1賠3", black_big: "1賠3", black_small: "1賠3",
  red_odd: "1賠3", red_even: "1賠3", black_odd: "1賠3", black_even: "1賠3",
  big_odd: "1賠3", big_even: "1賠3", small_odd: "1賠3", small_even: "1賠3",
};

/* ── Bet helpers ─────────────────────────────────────────────── */
function betKey(bet) {
  switch (bet.type) {
    case "straight": return `st:${bet.value}`;
    case "split": return `sp:${bet.values.join(",")}`;
    case "street": return `sr:${bet.value}`;
    case "corner": return `co:${bet.value}`;
    case "line": return `ln:${bet.value}`;
    case "nine": return `ni:${bet.value}`;
    case "column": return `cl:${bet.value}`;
    case "dozen": return `dz:${bet.value}`;
    default: return bet.type;
  }
}

function getNumbersForBet(bet) {
  switch (bet.type) {
    case "straight": return [bet.value];
    case "split": return bet.values;
    case "street": return [bet.value, bet.value + 1, bet.value + 2];
    case "corner": return [bet.value, bet.value + 1, bet.value + 3, bet.value + 4];
    case "line": return [bet.value, bet.value + 1, bet.value + 2, bet.value + 3, bet.value + 4, bet.value + 5];
    case "nine": return Array.from({ length: 9 }, (_, i) => bet.value + i);
    case "column": return Array.from({ length: 12 }, (_, i) => bet.value + i * 3);
    case "dozen": return Array.from({ length: 12 }, (_, i) => (bet.value - 1) * 12 + 1 + i);
    case "red": return [...RED_SET];
    case "black": return [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
    case "odd": return Array.from({ length: 18 }, (_, i) => i * 2 + 1);
    case "even": return Array.from({ length: 18 }, (_, i) => (i + 1) * 2);
    case "big": return Array.from({ length: 18 }, (_, i) => 19 + i);
    case "small": return Array.from({ length: 18 }, (_, i) => 1 + i);
    case "red_big": return [...RED_SET].filter(n => n >= 19);
    case "red_small": return [...RED_SET].filter(n => n <= 18);
    case "black_big": return [20, 22, 24, 26, 28, 29, 31, 33, 35];
    case "black_small": return [2, 4, 6, 8, 10, 11, 13, 15, 17];
    case "red_odd": return [...RED_SET].filter(n => n % 2 === 1);
    case "red_even": return [...RED_SET].filter(n => n % 2 === 0);
    case "black_odd": return [11, 13, 15, 17, 29, 31, 33, 35];
    case "black_even": return [2, 4, 6, 8, 10, 20, 22, 24, 26, 28];
    case "big_odd": return [19, 21, 23, 25, 27, 29, 31, 33, 35];
    case "big_even": return [20, 22, 24, 26, 28, 30, 32, 34, 36];
    case "small_odd": return [1, 3, 5, 7, 9, 11, 13, 15, 17];
    case "small_even": return [2, 4, 6, 8, 10, 12, 14, 16, 18];
    default: return [];
  }
}

function getBetLabel(bet) {
  switch (bet.type) {
    case "straight": return `直注 ${bet.value}`;
    case "split": return `分注 ${bet.values.join("/")}`;
    case "street": return `路注 ${bet.value}–${bet.value + 2}`;
    case "corner": return `角注 ${bet.value}/${bet.value + 1}/${bet.value + 3}/${bet.value + 4}`;
    case "line": return `線注 ${bet.value}–${bet.value + 5}`;
    case "nine": return `九注 ${bet.value}–${bet.value + 8}`;
    case "column": return `第${bet.value}列`;
    case "dozen": return `第${bet.value}打`;
    case "red": return "🔴 紅色";
    case "black": return "⚫ 黑色";
    case "odd": return "單數";
    case "even": return "雙數";
    case "big": return "大 19–36";
    case "small": return "小 1–18";
    case "red_big": return "🔴大";
    case "red_small": return "🔴小";
    case "black_big": return "⚫大";
    case "black_small": return "⚫小";
    case "red_odd": return "🔴單";
    case "red_even": return "🔴雙";
    case "black_odd": return "⚫單";
    case "black_even": return "⚫雙";
    case "big_odd": return "大單";
    case "big_even": return "大雙";
    case "small_odd": return "小單";
    case "small_even": return "小雙";
    default: return bet.type;
  }
}

/* ── Canvas ──────────────────────────────────────────────────── */
function numColor(n) {
  if (n === 0) return "#1a8a45";
  return RED_SET.has(n) ? "#c0392b" : "#111111";
}

function drawWheel(canvas, rotation, highlightIdx) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) / 2 - 8;
  const textR = outerR * 0.73;
  const hubR = outerR * 0.13;

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
    const endA = startA + SEG_ANGLE;
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
    const tx = cx + textR * Math.cos(midA);
    const ty = cy + textR * Math.sin(midA);
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
    ctx.lineTo(cx + outerR * Math.cos(a), cy + outerR * Math.sin(a));
    ctx.strokeStyle = "rgba(212,175,55,0.5)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  const hubGrad = ctx.createRadialGradient(cx - hubR * 0.2, cy - hubR * 0.2, 0, cx, cy, hubR);
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

  // Pointer
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

/* ── Betting Table ───────────────────────────────────────────── */
function BettingTable({ phase, selectedKeys, toggleBet, betAmount, winNumber }) {
  const [hoveredNums, setHoveredNums] = useState(new Set());
  const disabled = phase !== "idle";

  function hover(bet) { if (!disabled) setHoveredNums(new Set(getNumbersForBet(bet))); }
  function leave() { setHoveredNums(new Set()); }
  function isSel(bet) { return selectedKeys.has(betKey(bet)); }
  function isHov(n) { return hoveredNums.has(n); }
  function isWin(n) { return winNumber !== null && winNumber !== undefined && n === winNumber; }

  // Return a button element (NOT a sub-component to avoid re-mount anti-pattern)
  function mkBtn(key, bet, className, style, children) {
    return (
      <button key={key}
        className={`${className}${isSel(bet) ? " rlt-sel" : ""}`}
        style={style}
        onClick={() => toggleBet(bet)}
        onMouseEnter={() => hover(bet)}
        onMouseLeave={leave}
        disabled={disabled}
        title={`${getBetLabel(bet)} (${ODDS_LABEL[bet.type]})`}
      >{children}</button>
    );
  }

  const cells = [];

  // ── Zero ──────────────────────────────────────────────────────
  const zeroBet = { type: "straight", value: 0 };
  cells.push(mkBtn("z", zeroBet,
    `rlt-num-cell rlt-green${isHov(0) ? " rlt-hov" : ""}${isWin(0) ? " rlt-win" : ""}`,
    { gridRow: 1, gridColumn: "3/8" }, "0"));

  // ── 12 number rows ────────────────────────────────────────────
  for (let r = 1; r <= 12; r++) {
    const n1 = r * 3 - 2, n2 = r * 3 - 1, n3 = r * 3;
    const gr = r * 2; // CSS grid row

    // Street hotspot (col 2)
    cells.push(mkBtn(`sr${r}`, { type: "street", value: n1 },
      "rlt-hotspot rlt-hotspot-v", { gridRow: gr, gridColumn: 2 }));

    // Three number cells
    [[n1, 3], [n2, 5], [n3, 7]].forEach(([n, gc]) => {
      const color = RED_SET.has(n) ? "rlt-red" : "rlt-black";
      cells.push(mkBtn(`n${n}`, { type: "straight", value: n },
        `rlt-num-cell ${color}${isHov(n) ? " rlt-hov" : ""}${isWin(n) ? " rlt-win" : ""}`,
        { gridRow: gr, gridColumn: gc }, n));
    });

    // H-split col1-col2
    cells.push(mkBtn(`hs12-${r}`, { type: "split", values: [n1, n2] },
      "rlt-hotspot rlt-hotspot-h", { gridRow: gr, gridColumn: 4 }));

    // H-split col2-col3
    cells.push(mkBtn(`hs23-${r}`, { type: "split", values: [n2, n3] },
      "rlt-hotspot rlt-hotspot-h", { gridRow: gr, gridColumn: 6 }));

    // Gap row
    if (r < 12) {
      const gg = gr + 1;
      const nn1 = n1 + 3, nn2 = n2 + 3, nn3 = n3 + 3;

      // Six-line
      cells.push(mkBtn(`ln${r}`, { type: "line", value: n1 },
        "rlt-hotspot rlt-hotspot-corner", { gridRow: gg, gridColumn: 2 }));
      // V-split col1
      cells.push(mkBtn(`vs1-${r}`, { type: "split", values: [n1, nn1] },
        "rlt-hotspot rlt-hotspot-v", { gridRow: gg, gridColumn: 3 }));
      // Corner col1-2
      cells.push(mkBtn(`co1-${r}`, { type: "corner", value: n1 },
        "rlt-hotspot rlt-hotspot-corner", { gridRow: gg, gridColumn: 4 }));
      // V-split col2
      cells.push(mkBtn(`vs2-${r}`, { type: "split", values: [n2, nn2] },
        "rlt-hotspot rlt-hotspot-v", { gridRow: gg, gridColumn: 5 }));
      // Corner col2-3
      cells.push(mkBtn(`co2-${r}`, { type: "corner", value: n2 },
        "rlt-hotspot rlt-hotspot-corner", { gridRow: gg, gridColumn: 6 }));
      // V-split col3
      cells.push(mkBtn(`vs3-${r}`, { type: "split", values: [n3, nn3] },
        "rlt-hotspot rlt-hotspot-v", { gridRow: gg, gridColumn: 7 }));
    }
  }

  // ── Nine-line hotspots (col 1, each spans 3 streets = 5 grid rows) ──
  [[1, 1], [10, 2], [19, 3], [28, 4]].forEach(([v, g]) => {
    const rowStart = (g - 1) * 6 + 2;
    cells.push(mkBtn(`ni${v}`, { type: "nine", value: v },
      "rlt-hotspot rlt-nine-hotspot",
      { gridRow: `${rowStart}/${rowStart + 5}`, gridColumn: 1 },
      <span className="rlt-nine-label" key="lbl">九注</span>));
  });

  // ── Column bets (row 25, cols 3/5/7) ────────────────────────
  [[1, 3], [2, 5], [3, 7]].forEach(([col, gc]) => {
    cells.push(mkBtn(`cl${col}`, { type: "column", value: col },
      "rlt-outside-cell rlt-col-bet", { gridRow: 25, gridColumn: gc }, "2:1"));
  });

  // ── Dozen bets — right-side col 8, each spans 4 num-rows ─────
  // 第一打 (1-12)  : num-rows 1-4  → grid-rows 2–8  (span 2/9)
  // 第二打 (13-24) : num-rows 5-8  → grid-rows 10–16 (span 10/17)
  // 第三打 (25-36) : num-rows 9-12 → grid-rows 18–24 (span 18/25)
  const dozenRows = [[1, "一", 2, 9], [2, "二", 10, 17], [3, "三", 18, 25]];
  dozenRows.forEach(([d, zh, rs, re]) => {
    cells.push(mkBtn(`dz${d}`, { type: "dozen", value: d },
      "rlt-dozen-side",
      { gridColumn: 8, gridRow: `${rs}/${re}` },
      <>
        <span className="rlt-dozen-side-zh" key="zh">第{zh}打</span>
        <span className="rlt-dozen-side-odds" key="od">1賠2</span>
      </>
    ));
  });

  return (
    <div className="rlt-table-wrap">
      <div className="rlt-table-outer">
        <div className="rlt-table-grid">{cells}</div>
      </div>

      {/* Outside bets */}
      <div className="rlt-outside-row">
        {[
          [{ type: "small" }, "小 1–18", "rlt-ob-blue"],
          [{ type: "even" }, "雙", "rlt-ob-neutral"],
          [{ type: "red" }, "紅", "rlt-ob-red"],
          [{ type: "black" }, "黑", "rlt-ob-black"],
          [{ type: "odd" }, "單", "rlt-ob-neutral"],
          [{ type: "big" }, "大 19–36", "rlt-ob-blue"],
        ].map(([bet, label, cls]) => (
          <button key={bet.type}
            className={`rlt-ob-btn ${cls}${isSel(bet) ? " rlt-sel" : ""}`}
            onClick={() => toggleBet(bet)}
            onMouseEnter={() => hover(bet)}
            onMouseLeave={leave}
            disabled={disabled}
            title={`${getBetLabel(bet)} (1賠1)`}
          >{label}</button>
        ))}
      </div>

      {/* Combo bets — 3 rows × 4 */}
      <div className="rlt-combo-section">
        <div className="rlt-combo-label">組合注 <span className="rlt-odds-tag">1賠3</span></div>
        {[
          ["red_big", "red_small", "black_big", "black_small"],
          ["red_odd", "red_even", "black_odd", "black_even"],
          ["big_odd", "big_even", "small_odd", "small_even"],
        ].map((row, ri) => (
          <div key={ri} className="rlt-combo-row">
            {row.map(type => {
              const bet = { type };
              return (
                <button key={type}
                  className={`rlt-combo-btn rlt-combo-${type.replace("_", "-")}${isSel(bet) ? " rlt-sel" : ""}`}
                  onClick={() => toggleBet(bet)}
                  onMouseEnter={() => hover(bet)}
                  onMouseLeave={leave}
                  disabled={disabled}
                  title={`${getBetLabel(bet)} (1賠3)`}
                >{getBetLabel(bet)}</button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Result helpers ──────────────────────────────────────────── */
function resultBadgeClass(n) {
  if (n === 0) return "rlt-result-green";
  return RED_SET.has(n) ? "rlt-result-red" : "rlt-result-black";
}
function resultDesc(n) {
  if (n === 0) return "零（綠色）";
  return `${RED_SET.has(n) ? "紅" : "黑"}色・${n <= 18 ? "小" : "大"}・${n % 2 === 1 ? "單" : "雙"}`;
}

/* ── Main component ──────────────────────────────────────────── */
export default function RouletteGame({ token, onApplesChange }) {
  const canvasRef = useRef(null);
  const wheelRef = useRef(null);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const baseRotRef = useRef(INIT_ROT);

  const [phase, setPhase] = useState("idle");
  const [settings, setSettings] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [selectedBets, setSelectedBets] = useState([]);
  const [betAmount, setBetAmount] = useState(1);
  const [result, setResult] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(-1);

  const SPIN_DURATION = 10000;
  const EXTRA_SPINS = 6;

  // Load settings
  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/roulette/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setSettings(d))
      .catch(() => setLoadErr("無法載入輪盤設定"));
  }, [token]);

  // Draw
  const draw = useCallback((rotation, hiIdx = -1) => {
    const canvas = canvasRef.current;
    if (canvas) drawWheel(canvas, rotation, hiIdx);
  }, []);

  // Draw wheel as soon as canvas is mounted (canvas only appears after settings load)
  useEffect(() => { draw(INIT_ROT); }, [settings, draw]);

  // Toggle bet selection
  function toggleBet(bet) {
    if (phase !== "idle") return;
    const key = betKey(bet);
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); return next; }
      if (next.size >= 20) return prev;
      next.add(key);
      return next;
    });
    setSelectedBets(prev => {
      if (prev.find(b => betKey(b) === key)) return prev.filter(b => betKey(b) !== key);
      if (prev.length >= 20) return prev;
      return [...prev, bet];
    });
  }

  // Spin animation
  function startSpin(targetResult) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const resultIdx = WHEEL_ORDER.indexOf(targetResult);
    const startRot = baseRotRef.current % (2 * Math.PI);
    const segCenter = resultIdx * SEG_ANGLE + SEG_ANGLE / 2;
    const raw = -(startRot + segCenter);
    const base = ((raw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const totalRot = base + EXTRA_SPINS * 2 * Math.PI;
    baseRotRef.current = startRot;
    startTimeRef.current = performance.now();

    function frame(now) {
      const t = Math.min((now - startTimeRef.current) / SPIN_DURATION, 1);
      const rotation = startRot + totalRot * (1 - Math.pow(1 - t, 3));
      draw(rotation);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        baseRotRef.current = rotation % (2 * Math.PI);
        setHighlightIdx(resultIdx);
        draw(rotation % (2 * Math.PI), resultIdx);
        setPhase("result");
      }
    }
    rafRef.current = requestAnimationFrame(frame);
  }

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  async function placeBet() {
    if (selectedBets.length === 0) { setErrMsg("請至少選擇一種下注"); return; }
    setErrMsg("");
    setResult(null);
    setHighlightIdx(-1);
    setPhase("spinning");
    wheelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const res = await fetch(`${BACKEND}/api/roulette/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bets: selectedBets, amount: betAmount }),
      });
      const data = await res.json();
      if (!res.ok) { setPhase("idle"); setErrMsg(data.error || "下注失敗"); return; }
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
    draw(INIT_ROT);
  }

  function fmtHour(h, m) {
    // 特例：24:00 保持原樣
    if (h === 24 && m === 0) {
      return "24:00";
    }
    // 只要 >= 24（但排除 24:00）→ 次日
    if (h >= 24) {
      const hh = h % 24;
      return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}（次日）`;
    }
    // 正常時間
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  function isOpen() {
    if (!settings || !settings.roulette_enabled) return false;
    const now = new Date();
    const h = (now.getUTCHours() + 8) % 24;
    const cur = h * 60 + now.getUTCMinutes();
    const open = settings.roulette_open_hour * 60 + settings.roulette_open_minute;
    const close = settings.roulette_close_hour >= 24 ? 24 * 60 : settings.roulette_close_hour * 60 + settings.roulette_close_minute;
    return cur >= open && cur < close;
  }

  if (loadErr) return <div className="rlt-error">{loadErr}</div>;
  if (!settings) return <div className="rlt-loading">載入中…</div>;

  const open = isOpen();
  const oh = fmtHour(settings.roulette_open_hour, settings.roulette_open_minute);
  const ch = fmtHour(settings.roulette_close_hour, settings.roulette_close_minute);
  const maxBet = settings.roulette_max_bet || 50;
  const totalCost = betAmount * selectedBets.length;

  const helpContent = (
    <div className="rlt-help-body">
      <p className="rlt-help-how">在桌面點選要下注的區域，可同時選多種注法，再按「開始旋轉」。</p>
      <table className="rlt-help-table">
        <thead><tr><th>注法</th><th>說明</th><th>賠率</th></tr></thead>
        <tbody>
          <tr><td>直注</td><td>點選單一數字格</td><td>1賠35</td></tr>
          <tr><td>分注</td><td>點選兩數字之間的細線（左右或上下相鄰）</td><td>1賠17</td></tr>
          <tr><td>路注</td><td>點選橫列左側邊緣，涵蓋同列 3 個數字</td><td>1賠11</td></tr>
          <tr><td>角注</td><td>點選四數字的交叉角點</td><td>1賠8</td></tr>
          <tr><td>線注</td><td>點選兩橫列間的左側邊緣，涵蓋 6 個數字</td><td>1賠5</td></tr>
          <tr><td>九注</td><td>點選最左側條狀區域，涵蓋連續 9 個數字</td><td>1賠3</td></tr>
          <tr><td>列注</td><td>點選底部「2:1」，涵蓋縱列 12 個數字</td><td>1賠2</td></tr>
          <tr><td>12注</td><td>點選第一／二／三打，各涵蓋 12 個數字</td><td>1賠2</td></tr>
          <tr><td>紅 / 黑</td><td>押中獎數字的顏色</td><td>1賠1</td></tr>
          <tr><td>單 / 雙</td><td>押中獎數字為單數或雙數</td><td>1賠1</td></tr>
          <tr><td>大 / 小</td><td>大：19–36；小：1–18</td><td>1賠1</td></tr>
          <tr><td>組合注</td><td>同時押兩種條件（如紅大、黑單、小雙…共12種）</td><td>1賠3</td></tr>
        </tbody>
      </table>
      <p className="rlt-help-note">⚠️ 停在 0 時，除直注 0 外所有注法皆輸。</p>
    </div>
  );

  return (
    <div className="rlt-root">
      {/* Help button — top-right corner */}
      <button
        className={`rlt-help-btn${showHelp ? " active" : ""}`}
        onClick={() => setShowHelp(v => !v)}
        title="玩法說明"
      >玩法說明</button>
      {showHelp && (
        <div className="rlt-help-popover">
          <div className="rlt-help-popover-header">
            <span>玩法說明</span>
            <button className="rlt-help-close" onClick={() => setShowHelp(false)}>✕</button>
          </div>
          {helpContent}
        </div>
      )}

      <div className={`rlt-hours-badge ${open ? "open" : "closed"}`}>
        {open ? "🟢 開放中" : "🔴 未開放"}&nbsp;
        <span className="rlt-hours-text">{oh} – {ch}</span>
      </div>

      {/* Wheel */}
      <div className="rlt-wheel-wrap" ref={wheelRef}>
        <canvas ref={canvasRef} width={260} height={260} className="rlt-canvas" />
        {phase === "spinning" && (
          <div className="rlt-spinning-overlay">
            <div className="rlt-spinner-text">🎰 旋轉中…</div>
          </div>
        )}
      </div>

      {/* Betting table */}
      <BettingTable
        phase={phase}
        selectedKeys={selectedKeys}
        toggleBet={toggleBet}
        betAmount={betAmount}
        winNumber={phase === "result" ? (result?.result ?? null) : null}
      />

      {/* Amount + controls */}
      <div className="rlt-controls">
        <div className="rlt-amount-row">
          <span className="rlt-label">單注金額</span>
          <div className="rlt-amount-ctrl">
            <button className="rlt-amt-btn" onClick={() => setBetAmount(a => Math.max(1, a - 1))} disabled={phase !== "idle"}>－</button>
            <span className="rlt-amt-val">
              {betAmount}&nbsp;<img src="/gifts/gold_apple.gif" alt="" style={{ width: 16, height: 16, verticalAlign: "middle" }} />
            </span>
            <button className="rlt-amt-btn" onClick={() => setBetAmount(a => Math.min(maxBet, a + 1))} disabled={phase !== "idle"}>＋</button>
          </div>
          <span className="rlt-max-note">最多 {maxBet} 顆</span>
        </div>

        {phase === "idle" && selectedBets.length > 0 && (
          <div className="rlt-selection">
            <span>已選 {selectedBets.length} 注 × {betAmount} = <strong>{totalCost}</strong> 顆</span>
            <button className="rlt-clear-btn" onClick={() => { setSelectedKeys(new Set()); setSelectedBets([]); }}>清除</button>
          </div>
        )}

        {phase === "idle" && (
          <button className="rlt-spin-btn" onClick={placeBet} disabled={!open || selectedBets.length === 0}>
            {!open ? `未開放 (${oh} – ${ch})` : `🎰 開始旋轉${selectedBets.length > 0 ? ` (共 ${totalCost} 顆)` : ""}`}
          </button>
        )}
        {phase === "spinning" && (
          <button className="rlt-spin-btn spinning" disabled>⏳ 旋轉中…</button>
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
            <div className="rlt-bet-breakdown">
              {result.betResults.map((br, i) => (
                <div key={i} className={`rlt-br-row ${br.won ? "won" : "lost"}`}>
                  <span>{getBetLabel(br)}</span>
                  <span>{br.won ? `+${br.winAmount} 🍎` : `－${result.amount} 🍎`}</span>
                </div>
              ))}
            </div>
            <button className="rlt-again-btn" onClick={resetGame}>再玩一次</button>
          </div>
        )}

        {errMsg && <div className="rlt-errmsg">⚠️ {errMsg}</div>}
      </div>

    </div>
  );
}
