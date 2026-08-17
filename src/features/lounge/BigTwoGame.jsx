import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { roomConfig } from "../../shared/roomConfig";
import "./BigTwoGame.css";

const ENTRY_FEE = 10;
const SUIT_GLYPH = { d: "♦", c: "♣", h: "♥", s: "♠" };
const RANK_LABEL = { 11: "J", 12: "Q", 13: "K", 14: "A" };
const rankLabel = r => RANK_LABEL[r] || String(r);
const cardColor = suit => (suit === "d" || suit === "h") ? "#c0392b" : "#232323";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCard(ctx, x, y, w, h, cardId, opts = {}) {
  const { selected = false } = opts;
  const suit = cardId[0], rank = +cardId.slice(1);
  const drawY = selected ? y - 14 : y;
  ctx.save();
  ctx.fillStyle = "#f7f5ee";
  roundRect(ctx, x, drawY, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = selected ? "#ffd76a" : "#7a6a4a";
  ctx.lineWidth = selected ? 2.5 : 1;
  ctx.stroke();
  const color = cardColor(suit);
  ctx.fillStyle = color;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.font = `bold ${Math.floor(w * 0.3)}px sans-serif`;
  ctx.fillText(rankLabel(rank), x + 4, drawY + 3);
  ctx.font = `${Math.floor(w * 0.26)}px sans-serif`;
  ctx.fillText(SUIT_GLYPH[suit], x + 4, drawY + 4 + Math.floor(w * 0.32));
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.floor(h * 0.38)}px sans-serif`;
  ctx.fillText(SUIT_GLYPH[suit], x + w / 2, drawY + h / 2 + 4);
  ctx.restore();
}

const CANVAS_W = 700, CANVAS_H = 420;
const HAND_W = 42, HAND_H = 60;
const SMALL_W = 30, SMALL_H = 42;
const HAND_MARGIN = 16;

// Cards overlap (step shrinks below card width) once a full-width fan would run past the
// canvas, so a 17-18 card starting hand always fits instead of running off the edge.
function computeFanLayout(n, cardW) {
  const fullStep = cardW + 4;
  const maxWidth = CANVAS_W - HAND_MARGIN * 2;
  const step = n > 1 ? Math.min(fullStep, (maxWidth - cardW) / (n - 1)) : fullStep;
  const totalW = (n - 1) * step + cardW;
  const startX = Math.max(HAND_MARGIN, (CANVAS_W - totalW) / 2);
  return { step, startX };
}

function draw(ctx, st, selected, now) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#0e2818";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (!st) return;

  const secondsLeft = st.turnDeadline ? Math.max(0, Math.ceil((st.turnDeadline - now) / 1000)) : null;
  const timerSuffix = active => active && secondsLeft !== null ? `　⏱${secondsLeft}s` : "";

  const others = st.seats.map((s, i) => ({ ...s, idx: i })).filter(s => s.idx !== st.myIndex);
  others.forEach((s, i) => {
    const x = i === 0 ? 20 : CANVAS_W - 220;
    const active = st.turn === s.idx;
    ctx.fillStyle = active ? "#ffd76a" : "#cfe9d2";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`${s.name}　剩 ${s.count} 張${timerSuffix(active)}`, x, 16);
  });

  ctx.fillStyle = "#9fc7a4";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  if (st.lastPlay) {
    ctx.fillText(`${st.lastPlay.byName} 出了 ${st.lastPlay.typeName}`, CANVAS_W / 2, 70);
    const totalW = st.lastPlay.cards.length * (SMALL_W + 4);
    let cx = CANVAS_W / 2 - totalW / 2;
    st.lastPlay.cards.forEach(c => { drawCard(ctx, cx, 90, SMALL_W, SMALL_H, c); cx += SMALL_W + 4; });
  } else {
    ctx.fillText(st.firstTrick ? "請先出含梅花3的牌型" : "上一輪全部過牌，本輪自由出牌", CANVAS_W / 2, 70);
  }

  const me = st.seats[st.myIndex];
  const meActive = st.turn === st.myIndex;
  ctx.fillStyle = meActive ? "#ffd76a" : "#cfe9d2";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(`我（${me.name}）${timerSuffix(meActive)}`, 16, 280);

  const handY = 310;
  const { step, startX } = computeFanLayout(st.hand.length, HAND_W);
  st.hand.forEach((c, i) => {
    drawCard(ctx, startX + i * step, handY, HAND_W, HAND_H, c, { selected: selected.has(c) });
  });
}

function BigTwoGame({ socket, room, name, apples, onActiveChange }, ref) {
  const canvasRef = useRef(null);
  const [view, setView] = useState("lobby");
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [st, setSt] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [postHand, setPostHand] = useState(null); // {seats, confirmed, everPlayed, mySeatIndex}

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(t => (t === msg ? null : t)), 3500);
  }, []);

  // 讓父層（休閒廳）在切分頁前可以判斷「這一局還在打」，以及在使用者確認要中離時強制中離
  useEffect(() => {
    onActiveChange?.(view === "game" && st?.status === "playing");
  }, [view, st?.status, onActiveChange]);

  useImperativeHandle(ref, () => ({
    forfeitIfPlaying() {
      if (view !== "game" || st?.status !== "playing" || !tableId) return;
      socket.emit("bigTwoForfeit", { tableId });
      // 座位已經轉代打，伺服器之後不會再對這個座位送任何狀態更新，這裡直接樂觀地
      // 把本地畫面收回大廳，不然元件會停在剛剛那手牌的畫面，切分頁回來時像卡住
      setView("lobby");
      setTableId(null);
      setSt(null);
      setPostHand(null);
      socket.emit("bigTwoGetTables");
    },
  }), [view, st?.status, tableId, socket]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("bigTwoGetTables");

    const onTableList = (list) => setTables(list);
    const onState = (payload) => { setSt(payload); setSelected(new Set()); setPostHand(null); setView("game"); };
    const onResult = (payload) => {
      setResult(payload);
      setTimeout(() => setResult(r => (r === payload ? null : r)), 6000);
    };
    const onTableWaiting = (payload) => { setPostHand(payload); setView("postHand"); };
    const onCancelled = () => { showToast("房主已取消此桌"); setView("lobby"); setTableId(null); };
    const onError = ({ reason }) => showToast(reason || "發生錯誤");
    const onToastMsg = ({ msg }) => showToast(msg);

    socket.on("bigTwoTableList", onTableList);
    socket.on("bigTwoState", onState);
    socket.on("bigTwoResult", onResult);
    socket.on("bigTwoTableWaiting", onTableWaiting);
    socket.on("bigTwoTableCancelled", onCancelled);
    socket.on("bigTwoError", onError);
    socket.on("bigTwoToast", onToastMsg);

    return () => {
      socket.off("bigTwoTableList", onTableList);
      socket.off("bigTwoState", onState);
      socket.off("bigTwoResult", onResult);
      socket.off("bigTwoTableWaiting", onTableWaiting);
      socket.off("bigTwoTableCancelled", onCancelled);
      socket.off("bigTwoError", onError);
      socket.off("bigTwoToast", onToastMsg);
    };
  }, [socket, showToast]);

  useEffect(() => {
    if (view !== "game" || !canvasRef.current) return;
    draw(canvasRef.current.getContext("2d"), st, selected, now);
  }, [view, st, selected, now]);

  useEffect(() => {
    if (view !== "game" || st?.status !== "playing" || !st?.turnDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [view, st?.status, st?.turnDeadline]);

  function handleCreateTable() {
    if (apples != null && apples < ENTRY_FEE) { showToast(`${roomConfig.currency_name}不足，需要 ${ENTRY_FEE} 個才能建桌`); return; }
    socket.emit("bigTwoCreateTable");
    setView("waiting");
  }
  function handleJoinTable(id) {
    if (apples != null && apples < ENTRY_FEE) { showToast(`${roomConfig.currency_name}不足，需要 ${ENTRY_FEE} 個才能加入`); return; }
    socket.emit("bigTwoJoinTable", { tableId: id });
    setTableId(id);
    setView("waiting");
  }
  function handleCancelOrLeave(id, isHost) {
    socket.emit(isHost ? "bigTwoCancelTable" : "bigTwoLeaveTable", { tableId: id });
    setView("lobby"); setTableId(null);
  }

  function handleLeaveAfterHand() {
    socket.emit("bigTwoLeaveTable", { tableId });
    setView("lobby"); setTableId(null); setSt(null); setPostHand(null);
    socket.emit("bigTwoGetTables");
  }

  function handleCanvasClick(e) {
    if (!st) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width, scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX, y = (e.clientY - rect.top) * scaleY;
    if (y < 296 || y > 296 + HAND_H + 14) return;
    const { step, startX } = computeFanLayout(st.hand.length, HAND_W);
    // Cards overlap, so scan back-to-front: later (rightmost/frontmost) cards are drawn
    // on top and should win a click over an earlier card whose tail they cover.
    let idx = -1;
    for (let i = st.hand.length - 1; i >= 0; i--) {
      const cx = startX + i * step;
      if (x >= cx && x <= cx + HAND_W) { idx = i; break; }
    }
    if (idx < 0) return;
    const card = st.hand[idx];
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(card)) next.delete(card); else next.add(card);
      return next;
    });
  }

  function handlePlay() {
    if (!selected.size) return;
    socket.emit("bigTwoPlay", { tableId: st.tableId, cards: Array.from(selected) });
  }
  function handlePass() {
    socket.emit("bigTwoPass", { tableId: st.tableId });
  }

  if (view === "lobby") {
    return (
      <div className="bt-lobby">
        {toast && <div className="bt-toast">{toast}</div>}
        <p className="bt-hint">進場費 {ENTRY_FEE} 個{roomConfig.currency_name}，3 人到齊自動開局，先出完牌者拿走全部彩池（30 個）；中途離線則三家各退回進場費。</p>
        <button className="bt-create-btn" onClick={handleCreateTable}>➕ 建立新桌</button>
        <div className="bt-table-list">
          {tables.length === 0 && <div className="bt-empty">目前沒有等待中的桌子</div>}
          {tables.map(t => {
            const seated = t.seats.filter(Boolean).length;
            const isMine = t.seats.includes(name);
            return (
              <div key={t.id} className="bt-table-row">
                <span>{t.hostName} 的桌子（{seated}/3）</span>
                {isMine ? (
                  <button className="bt-cancel-btn" onClick={() => handleCancelOrLeave(t.id, t.hostName === name)}>
                    {t.hostName === name ? "取消" : "離開"}
                  </button>
                ) : (
                  <button className="bt-join-btn" disabled={seated >= 3} onClick={() => handleJoinTable(t.id)}>加入</button>
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
      <div className="bt-lobby">
        {toast && <div className="bt-toast">{toast}</div>}
        <p className="bt-hint">等待其他玩家加入…（{seated}/3）</p>
        {t && (
          <ul className="bt-waiting-seats">
            {t.seats.map((s, i) => <li key={i}>{s || "（空位）"}</li>)}
          </ul>
        )}
        <button className="bt-cancel-btn" onClick={() => handleCancelOrLeave(tableId ?? t?.id, t?.hostName === name)}>
          {t?.hostName === name ? "取消建桌" : "離開等待"}
        </button>
      </div>
    );
  }

  if (view === "postHand") {
    const seats = postHand?.seats || [null, null, null];
    const confirmed = postHand?.confirmed || [false, false, false];
    const mySeatIndex = postHand?.mySeatIndex;
    return (
      <div className="bt-lobby">
        {toast && <div className="bt-toast">{toast}</div>}
        {result && (
          <div className="bt-result-overlay">
            {result.draw ? (
              <p>🃏 {result.reason}</p>
            ) : (
              <p>🏆 {result.winnerName} 出完牌獲勝，贏得 {result.pot} 個{roomConfig.currency_name}</p>
            )}
          </div>
        )}
        <p className="bt-hint">本局結束，等待全員確認「再來一局」（空位可讓其他人加入補位）</p>
        <ul className="bt-waiting-seats">
          {seats.map((s, i) => <li key={i}>{s || "（空位，等待補位）"}{s && confirmed[i] ? " ✅ 已準備" : ""}</li>)}
        </ul>
        {mySeatIndex != null && (
          <div className="bt-actions">
            <button
              className="bt-primary"
              disabled={confirmed[mySeatIndex]}
              onClick={() => socket.emit("bigTwoPlayAgain", { tableId })}
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
    <div className="bt-game">
      {toast && <div className="bt-toast">{toast}</div>}
      {result && (
        <div className="bt-result-overlay">
          {result.draw ? (
            <p>🃏 {result.reason}</p>
          ) : (
            <>
              <p>🏆 {result.winnerName} 出完牌獲勝，贏得 {result.pot} 個{roomConfig.currency_name}</p>
              <p className="bt-remain-list">{(result.remain || []).map((n, i) => `第${i + 1}家剩${n}張`).join("　")}</p>
            </>
          )}
        </div>
      )}

      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="bt-canvas" onClick={handleCanvasClick} />

      {st?.turn === st?.myIndex && (
        <div className="bt-actions">
          <button className="bt-primary" disabled={!selected.size} onClick={handlePlay}>出牌</button>
          <button disabled={!st?.lastPlay} onClick={handlePass}>過</button>
        </div>
      )}
    </div>
  );
}

export default forwardRef(BigTwoGame);
