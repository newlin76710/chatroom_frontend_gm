import { useEffect, useRef, useState, useCallback } from "react";
import { roomConfig } from "../../shared/roomConfig";
import "./MahjongGame.css";

const ENTRY_FEE = 10;
const SUIT_NAME = { w: "萬", p: "筒", s: "條" };
const HONOR_NAME = { zE: "東", zS: "南", zW: "西", zN: "北", zZ: "中", zF: "發", zB: "白" };
const CN_NUM = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七", 8: "八", 9: "九" };

function tileLabel(t) {
  if (!t) return { label: "?", color: "#333" };
  if (t[0] === "z") {
    const color = t === "zZ" ? "#c0392b" : t === "zF" ? "#2e8b57" : "#2b2b2b";
    return { label: HONOR_NAME[t] || t, color };
  }
  const suit = t[0], num = t[1];
  const color = suit === "w" ? "#c0392b" : suit === "p" ? "#2255aa" : "#2e8b57";
  return { label: num + (SUIT_NAME[suit] || suit), color };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── 筒子/條子的真實牌面（圓餅/竹枝排列），花牌則畫季節/植物小圖示，
// 萬子與字牌沿用文字（本來就是真實牌面的樣子，字牌只有一個大字）。
const DOT_LAYOUTS = {
  1: [[0.5, 0.5]],
  2: [[0.5, 0.27], [0.5, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.3, 0.18], [0.3, 0.5], [0.3, 0.82], [0.7, 0.18], [0.7, 0.5], [0.7, 0.82]],
  7: [[0.5, 0.14], [0.3, 0.38], [0.7, 0.38], [0.3, 0.62], [0.7, 0.62], [0.3, 0.86], [0.7, 0.86]],
  8: [[0.3, 0.14], [0.7, 0.14], [0.3, 0.38], [0.7, 0.38], [0.3, 0.62], [0.7, 0.62], [0.3, 0.86], [0.7, 0.86]],
  9: [[0.28, 0.18], [0.5, 0.18], [0.72, 0.18], [0.28, 0.5], [0.5, 0.5], [0.72, 0.5], [0.28, 0.82], [0.5, 0.82], [0.72, 0.82]],
};
const CIRCLE_COLORS = ["#1f5fa8", "#c0392b"];
// 七筒傳統牌面：上方 3 顆藍色斜線排列，下方 4 顆紅色 2x2 排列
const CIRCLE_SEVEN = {
  top: [[0.28, 0.16], [0.5, 0.3], [0.72, 0.44]],
  grid: [[0.3, 0.64], [0.68, 0.64], [0.3, 0.88], [0.68, 0.88]],
};

function drawDot(ctx, cx, cy, r, color) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.lineWidth = 1; ctx.stroke();
}
function drawCircleTile(ctx, x, y, w, h, n) {
  const r = Math.min(w, h) * 0.11;
  if (n === 7) {
    CIRCLE_SEVEN.top.forEach(([fx, fy]) => drawDot(ctx, x + fx * w, y + fy * h, r, CIRCLE_COLORS[0]));
    CIRCLE_SEVEN.grid.forEach(([fx, fy]) => drawDot(ctx, x + fx * w, y + fy * h, r, CIRCLE_COLORS[1]));
    return;
  }
  const layout = DOT_LAYOUTS[n] || DOT_LAYOUTS[1];
  layout.forEach(([fx, fy], i) => drawDot(ctx, x + fx * w, y + fy * h, r, CIRCLE_COLORS[i % CIRCLE_COLORS.length]));
}

const BAMBOO_GREEN = "#1f8a4d";
function drawStick(ctx, cx, cy, len, color) {
  const w = len * 0.3;
  ctx.fillStyle = color;
  roundRect(ctx, cx - w / 2, cy - len / 2, w, len, w * 0.35);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.moveTo(cx - w / 2, cy - len / 6); ctx.lineTo(cx + w / 2, cy - len / 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - w / 2, cy + len / 6); ctx.lineTo(cx + w / 2, cy + len / 6); ctx.stroke();
}
function drawBird(ctx, cx, cy, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(cx, cy + size * 0.1, size * 0.32, size * 0.22, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - size * 0.28, cy - size * 0.12, size * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.44, cy - size * 0.12);
  ctx.lineTo(cx - size * 0.58, cy - size * 0.06);
  ctx.lineTo(cx - size * 0.44, cy - size * 0.02);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(cx - size * 0.3, cy - size * 0.15, size * 0.04, 0, Math.PI * 2); ctx.fill();
}
// 七條傳統牌面：頂端一根紅色＋下方 2 欄 3 排的綠色（總統府）
function drawBamboo7(ctx, x, y, w, h) {
  const len = h * 0.2;
  drawStick(ctx, x + 0.5 * w, y + 0.18 * h, len, "#c0392b");
  const gridY = [0.42, 0.62, 0.82], gridX = [0.28, 0.72];
  for (const gy of gridY) for (const gx of gridX) drawStick(ctx, x + gx * w, y + gy * h, len, BAMBOO_GREEN);
}
// 八條傳統牌面：兩個連續的「M」字形綠色摺線
function drawZigzagM(ctx, x, yTop, w, bandH, color, lineW) {
  const pts = [
    [x + w * 0.12, yTop + bandH * 0.85],
    [x + w * 0.32, yTop + bandH * 0.15],
    [x + w * 0.5, yTop + bandH * 0.7],
    [x + w * 0.68, yTop + bandH * 0.15],
    [x + w * 0.88, yTop + bandH * 0.85],
  ];
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}
function drawBamboo8(ctx, x, y, w, h) {
  const lineW = Math.max(2, w * 0.09);
  drawZigzagM(ctx, x, y + h * 0.08, w, h * 0.36, BAMBOO_GREEN, lineW);
  drawZigzagM(ctx, x, y + h * 0.52, w, h * 0.36, BAMBOO_GREEN, lineW);
}
function drawBambooTile(ctx, x, y, w, h, n) {
  if (n === 1) { drawBird(ctx, x + w * 0.5, y + h * 0.5, Math.min(w, h) * 0.85, BAMBOO_GREEN); return; }
  if (n === 7) { drawBamboo7(ctx, x, y, w, h); return; }
  if (n === 8) { drawBamboo8(ctx, x, y, w, h); return; }
  const layout = DOT_LAYOUTS[n] || DOT_LAYOUTS[1];
  const len = h * 0.22;
  layout.forEach(([fx, fy]) => drawStick(ctx, x + fx * w, y + fy * h, len, BAMBOO_GREEN));
}

function drawWanTile(ctx, x, y, w, h, n) {
  const cx = x + w / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1a1a1a";
  ctx.font = `bold ${Math.floor(h * 0.3)}px "Noto Serif TC", serif`;
  ctx.fillText(CN_NUM[n] || n, cx, y + h * 0.3);
  ctx.fillStyle = "#c0392b";
  ctx.font = `bold ${Math.floor(h * 0.32)}px "Noto Serif TC", serif`;
  ctx.fillText("萬", cx, y + h * 0.68);
}

function drawBlankTile(ctx, x, y, w, h) {
  const inset = Math.min(w, h) * 0.17;
  ctx.strokeStyle = "#1f5fa8";
  ctx.lineWidth = Math.max(1.5, h * 0.05);
  ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);
}

function drawTile(ctx, x, y, w, h, tileId, opts = {}) {
  const { faceDown = false, highlight = false, dim = false } = opts;
  ctx.save();
  ctx.globalAlpha = dim ? 0.55 : 1;
  ctx.fillStyle = faceDown ? "#2f6b46" : "#f7f0dd";
  ctx.strokeStyle = highlight ? "#ffd76a" : "#7a6a4a";
  ctx.lineWidth = highlight ? 2.5 : 1;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();
  if (!faceDown && tileId) {
    if (tileId[0] === "w") drawWanTile(ctx, x, y, w, h, +tileId[1]);
    else if (tileId[0] === "p") drawCircleTile(ctx, x, y, w, h, +tileId[1]);
    else if (tileId[0] === "s") drawBambooTile(ctx, x, y, w, h, +tileId[1]);
    else if (tileId === "zB") drawBlankTile(ctx, x, y, w, h);
    else {
      const { label, color } = tileLabel(tileId);
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.floor(h * 0.4)}px "Noto Sans TC", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    }
  }
  ctx.restore();
}

const CANVAS_W = 700, CANVAS_H = 560;
const HAND_TILE_W = 34, HAND_TILE_H = 46;
const SMALL_TILE_W = 18, SMALL_TILE_H = 24;

const MELD_LABEL = { chi: "吃", peng: "碰", gang: "槓", angang: "槓" };

function drawSeatPanel(ctx, x, y, seat, isTurn, label, maxWidth = 220, timerSuffix = "") {
  ctx.fillStyle = isTurn ? "#ffd76a" : "#cfe9d2";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`${label} ${seat.name}（${seat.seatWind}）手牌${seat.handCount}${isTurn ? timerSuffix : ""}`, x, y);

  const rightEdge = x + maxWidth;
  let mx = x, my = y + 20;
  for (const m of seat.melds || []) {
    ctx.font = "11px sans-serif";
    const labelText = MELD_LABEL[m.type] || "";
    const labelWidth = ctx.measureText(labelText).width + 4;
    const groupWidth = labelWidth + m.tiles.length * (SMALL_TILE_W + 2);
    if (mx !== x && mx + groupWidth > rightEdge) { mx = x; my += SMALL_TILE_H + 4; }
    ctx.fillStyle = "#9fc7a4";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, mx, my + SMALL_TILE_H / 2);
    mx += labelWidth;
    for (const t of m.tiles) { drawTile(ctx, mx, my, SMALL_TILE_W, SMALL_TILE_H, t); mx += SMALL_TILE_W + 2; }
    mx += 10;
  }
  ctx.textBaseline = "top";

  let dx = x, dy = my + SMALL_TILE_H + 8;
  (seat.discards || []).forEach((t) => {
    if (dx + SMALL_TILE_W > rightEdge) { dx = x; dy += SMALL_TILE_H + 2; }
    drawTile(ctx, dx, dy, SMALL_TILE_W, SMALL_TILE_H, t);
    dx += SMALL_TILE_W + 2;
  });
}

// st.myHand already includes the just-drawn tile (server adds it straight into the hand
// counts); pull one copy out here so it isn't rendered twice — once in the row, once highlighted.
function getShownHand(st) {
  const hand = [...st.myHand];
  if (st.drawn) {
    const idx = hand.indexOf(st.drawn);
    if (idx !== -1) hand.splice(idx, 1);
  }
  return hand;
}

function draw(ctx, st, now) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#0e2818";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (!st) return;

  const secondsLeft = st.turnDeadline ? Math.max(0, Math.ceil((st.turnDeadline - now) / 1000)) : null;
  const timerSuffix = secondsLeft !== null ? `　⏱${secondsLeft}s` : "";

  const seatAt = rel => st.seats[(st.myIndex + rel) % 4];
  drawSeatPanel(ctx, 260, 14, seatAt(2), st.turn === (st.myIndex + 2) % 4, "對家", 424, timerSuffix);
  drawSeatPanel(ctx, 16, 150, seatAt(3), st.turn === (st.myIndex + 3) % 4, "上家", 434, timerSuffix);
  drawSeatPanel(ctx, 470, 150, seatAt(1), st.turn === (st.myIndex + 1) % 4, "下家", 214, timerSuffix);

  ctx.fillStyle = "#9fc7a4";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`牌牆剩餘 ${st.wallCount}`, CANVAS_W / 2, 260);
  if (st.lastDiscard) {
    ctx.fillStyle = "#dcefe0";
    ctx.fillText("最後出牌", CANVAS_W / 2 - 40, 285);
    drawTile(ctx, CANVAS_W / 2 - 17, 290, HAND_TILE_W, HAND_TILE_H, st.lastDiscard.tile, { highlight: true });
  }

  const me = seatAt(0);
  const meActive = st.turn === st.myIndex;
  ctx.textAlign = "left";
  ctx.fillStyle = meActive ? "#ffd76a" : "#cfe9d2";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(`我（${me.seatWind}）${meActive ? timerSuffix : ""}`, 16, 372);
  let mmx = 16, mmy = 392;
  for (const m of me.melds || []) {
    for (const t of m.tiles) { drawTile(ctx, mmx, mmy, SMALL_TILE_W, SMALL_TILE_H, t); mmx += SMALL_TILE_W + 2; }
    mmx += 8;
  }

  const handY = 440;
  const shownHand = getShownHand(st);
  shownHand.forEach((t, i) => {
    drawTile(ctx, 16 + i * (HAND_TILE_W + 3), handY, HAND_TILE_W, HAND_TILE_H, t);
  });
  if (st.drawn) {
    const dx = 16 + shownHand.length * (HAND_TILE_W + 3) + 14;
    drawTile(ctx, dx, handY, HAND_TILE_W, HAND_TILE_H, st.drawn, { highlight: true });
  }
}

export default function MahjongGame({ socket, room, name, apples }) {
  const canvasRef = useRef(null);
  const [view, setView] = useState("lobby");
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [st, setSt] = useState(null);
  const [claimAsk, setClaimAsk] = useState(null);
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [postHand, setPostHand] = useState(null); // {seats, confirmed, everPlayed, mySeatIndex}

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(t => (t === msg ? null : t)), 3500);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.emit("mahjongGetTables");

    const onTableList = (list) => setTables(list);
    const onState = (payload) => { setSt(payload); setClaimAsk(null); setPostHand(null); setView("game"); };
    const onClaimAsk = (payload) => setClaimAsk(payload);
    const onResult = (payload) => {
      setResult(payload);
      setTimeout(() => setResult(r => (r === payload ? null : r)), 6000);
    };
    const onTableWaiting = (payload) => { setPostHand(payload); setView("postHand"); };
    const onCancelled = () => { showToast("房主已取消此桌"); setView("lobby"); setTableId(null); };
    const onError = ({ reason }) => showToast(reason || "發生錯誤");
    const onToastMsg = ({ msg }) => showToast(msg);

    socket.on("mahjongTableList", onTableList);
    socket.on("mahjongState", onState);
    socket.on("mahjongClaimAsk", onClaimAsk);
    socket.on("mahjongResult", onResult);
    socket.on("mahjongTableWaiting", onTableWaiting);
    socket.on("mahjongTableCancelled", onCancelled);
    socket.on("mahjongError", onError);
    socket.on("mahjongToast", onToastMsg);

    return () => {
      socket.off("mahjongTableList", onTableList);
      socket.off("mahjongState", onState);
      socket.off("mahjongClaimAsk", onClaimAsk);
      socket.off("mahjongResult", onResult);
      socket.off("mahjongTableWaiting", onTableWaiting);
      socket.off("mahjongTableCancelled", onCancelled);
      socket.off("mahjongError", onError);
      socket.off("mahjongToast", onToastMsg);
    };
  }, [socket, showToast]);

  useEffect(() => {
    if (view !== "game" || !canvasRef.current) return;
    draw(canvasRef.current.getContext("2d"), st, now);
  }, [view, st, now]);

  useEffect(() => {
    if (view !== "game" || !st?.turnDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [view, st?.turnDeadline]);

  function handleCreateTable() {
    if (apples != null && apples < ENTRY_FEE) { showToast(`${roomConfig.currency_name}不足，需要 ${ENTRY_FEE} 個才能建桌`); return; }
    socket.emit("mahjongCreateTable");
    setView("waiting");
  }
  function handleJoinTable(id) {
    if (apples != null && apples < ENTRY_FEE) { showToast(`${roomConfig.currency_name}不足，需要 ${ENTRY_FEE} 個才能加入`); return; }
    socket.emit("mahjongJoinTable", { tableId: id });
    setTableId(id);
    setView("waiting");
  }
  function handleCancelOrLeave(id, isHost) {
    socket.emit(isHost ? "mahjongCancelTable" : "mahjongLeaveTable", { tableId: id });
    setView("lobby"); setTableId(null);
  }

  function handleLeaveAfterHand() {
    socket.emit("mahjongLeaveTable", { tableId });
    setView("lobby"); setTableId(null); setSt(null); setPostHand(null);
    socket.emit("mahjongGetTables");
  }

  function handleCanvasClick(e) {
    if (!st || st.turn !== st.myIndex || st.turnPhase !== "discard" || claimAsk) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    if (y < 440 || y > 440 + HAND_TILE_H) return;
    const shownHand = getShownHand(st);
    const idx = Math.floor((x - 16) / (HAND_TILE_W + 3));
    if (idx >= 0 && idx < shownHand.length) {
      socket.emit("mahjongDiscard", { tableId: st.tableId, tile: shownHand[idx] });
      return;
    }
    if (st.drawn) {
      const dx = 16 + shownHand.length * (HAND_TILE_W + 3) + 14;
      if (x >= dx && x <= dx + HAND_TILE_W) {
        socket.emit("mahjongDiscard", { tableId: st.tableId, tile: st.drawn });
      }
    }
  }

  function claim(type, tiles) {
    socket.emit("mahjongClaim", { tableId: st?.tableId, type, tiles });
    setClaimAsk(null);
  }

  if (view === "lobby") {
    return (
      <div className="mj-lobby">
        {toast && <div className="mj-toast">{toast}</div>}
        <p className="mj-hint">進場費 {ENTRY_FEE} 個{roomConfig.currency_name}，4 人到齊自動開局，胡牌者拿走全部彩池（40 個）；流局或中途離線則四家各退回進場費。</p>
        <button className="mj-create-btn" onClick={handleCreateTable}>➕ 建立新桌</button>
        <div className="mj-table-list">
          {tables.length === 0 && <div className="mj-empty">目前沒有等待中的桌子</div>}
          {tables.map(t => {
            const seated = t.seats.filter(Boolean).length;
            const isMine = t.seats.includes(name);
            return (
              <div key={t.id} className="mj-table-row">
                <span>{t.hostName} 的桌子（{seated}/4）</span>
                {isMine ? (
                  <button className="mj-cancel-btn" onClick={() => handleCancelOrLeave(t.id, t.hostName === name)}>
                    {t.hostName === name ? "取消" : "離開"}
                  </button>
                ) : (
                  <button className="mj-join-btn" disabled={seated >= 4} onClick={() => handleJoinTable(t.id)}>加入</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "waiting") {
    const t = tables.find(x => x.id === tableId) || tables.find(x => x.seats.includes(name));
    const seated = t ? t.seats.filter(Boolean).length : 1;
    return (
      <div className="mj-lobby">
        {toast && <div className="mj-toast">{toast}</div>}
        <p className="mj-hint">等待其他玩家加入…（{seated}/4）</p>
        {t && (
          <ul className="mj-waiting-seats">
            {t.seats.map((s, i) => <li key={i}>{s || "（空位）"}</li>)}
          </ul>
        )}
        <button className="mj-cancel-btn" onClick={() => handleCancelOrLeave(tableId ?? t?.id, t?.hostName === name)}>
          {t?.hostName === name ? "取消建桌" : "離開等待"}
        </button>
      </div>
    );
  }

  if (view === "postHand") {
    const seats = postHand?.seats || [null, null, null, null];
    const confirmed = postHand?.confirmed || [false, false, false, false];
    const mySeatIndex = postHand?.mySeatIndex;
    return (
      <div className="mj-lobby">
        {toast && <div className="mj-toast">{toast}</div>}
        {result && (
          <div className="mj-result-overlay">
            {result.draw ? (
              <p>🀄 {result.reason}</p>
            ) : (
              <>
                <p>🏆 {result.winnerName} 胡牌獲勝（{result.info?.zimo ? "自摸" : "榮和"}）</p>
                <p>共 {result.tai?.total ?? 0} 台，贏得 {result.pot} 個{roomConfig.currency_name}</p>
              </>
            )}
          </div>
        )}
        <p className="mj-hint">本局結束，等待全員確認「再來一局」（空位可讓其他人加入補位）</p>
        <ul className="mj-waiting-seats">
          {seats.map((s, i) => <li key={i}>{s || "（空位，等待補位）"}{s && confirmed[i] ? " ✅ 已準備" : ""}</li>)}
        </ul>
        {mySeatIndex != null && (
          <div className="mj-actions">
            <button
              className="mj-primary"
              disabled={confirmed[mySeatIndex]}
              onClick={() => socket.emit("mahjongPlayAgain", { tableId })}
            >
              {confirmed[mySeatIndex] ? "已準備，等待其他人" : "🔁 再來一局"}
            </button>
            <button onClick={handleLeaveAfterHand}>離開</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mj-game">
      {toast && <div className="mj-toast">{toast}</div>}
      {result && (
        <div className="mj-result-overlay">
          {result.draw ? (
            <p>🀄 {result.reason}</p>
          ) : (
            <>
              <p>🏆 {result.winnerName} 胡牌獲勝（{result.info?.zimo ? "自摸" : "榮和"}）</p>
              <p>共 {result.tai?.total ?? 0} 台，贏得 {result.pot} 個{roomConfig.currency_name}</p>
              <p className="mj-tai-list">{(result.tai?.list || []).map(t => `${t.name}×${t.tai}`).join("　")}</p>
            </>
          )}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="mj-canvas"
        onClick={handleCanvasClick}
      />

      {claimAsk && (
        <p className="mj-claim-hint">{claimAsk.fromName} 打出了 {tileLabel(claimAsk.tile).label}</p>
      )}

      {((st?.myOptions && st.turn === st.myIndex && st.turnPhase === "discard" && !claimAsk) || claimAsk) && (
        <div className="mj-actions">
          {!claimAsk && st.myOptions.zimo && <button className="mj-primary" onClick={() => socket.emit("mahjongZimo", { tableId: st.tableId })}>自摸</button>}
          {!claimAsk && st.myOptions.angang.map(t => (
            <button key={"ag" + t} onClick={() => socket.emit("mahjongAnGang", { tableId: st.tableId, tile: t })}>暗槓 {tileLabel(t).label}</button>
          ))}
          {!claimAsk && st.myOptions.jiagang.map(t => (
            <button key={"jg" + t} onClick={() => socket.emit("mahjongJiaGang", { tableId: st.tableId, tile: t })}>加槓 {tileLabel(t).label}</button>
          ))}
          {claimAsk?.options.hu && <button className="mj-primary" onClick={() => claim("hu")}>胡</button>}
          {claimAsk?.options.gang && <button onClick={() => claim("gang")}>槓</button>}
          {claimAsk?.options.peng && <button onClick={() => claim("peng")}>碰</button>}
          {(claimAsk?.options.chi || []).map((combo, i) => (
            <button key={i} onClick={() => claim("chi", combo)}>吃 {combo.map(t => tileLabel(t).label).join("")}</button>
          ))}
          {claimAsk && <button className="mj-ghost" onClick={() => claim("pass")}>過</button>}
        </div>
      )}
    </div>
  );
}
