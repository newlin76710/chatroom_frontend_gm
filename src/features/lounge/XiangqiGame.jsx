import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { roomConfig } from "../../shared/roomConfig";
import "./XiangqiGame.css";

const ENTRY_FEE = 10;
const CELL = 48;
const MARGIN = 28;
const BOARD_W = MARGIN * 2 + 8 * CELL;
const BOARD_H = MARGIN * 2 + 9 * CELL;

const GLYPH = {
  red: { general: "帥", advisor: "仕", elephant: "相", horse: "傌", rook: "俥", cannon: "炮", soldier: "兵" },
  black: { general: "將", advisor: "士", elephant: "象", horse: "馬", rook: "車", cannon: "砲", soldier: "卒" },
};

function drawBoard(ctx, { board, selected, lastMove, check, flip }) {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);
  ctx.fillStyle = "#e8c98a";
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  const toX = c => MARGIN + (flip ? 8 - c : c) * CELL;
  const toY = r => MARGIN + (flip ? 9 - r : r) * CELL;

  ctx.strokeStyle = "#5b3a1a";
  ctx.lineWidth = 1.5;
  for (let r = 0; r <= 9; r++) {
    ctx.beginPath();
    ctx.moveTo(MARGIN, MARGIN + r * CELL);
    ctx.lineTo(MARGIN + 8 * CELL, MARGIN + r * CELL);
    ctx.stroke();
  }
  for (let c = 0; c <= 8; c++) {
    const x = MARGIN + c * CELL;
    if (c === 0 || c === 8) {
      ctx.beginPath();
      ctx.moveTo(x, MARGIN);
      ctx.lineTo(x, MARGIN + 9 * CELL);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, MARGIN);
      ctx.lineTo(x, MARGIN + 4 * CELL);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, MARGIN + 5 * CELL);
      ctx.lineTo(x, MARGIN + 9 * CELL);
      ctx.stroke();
    }
  }

  const palaceDiagonals = [
    [[0, 3], [2, 5]], [[0, 5], [2, 3]],
    [[7, 3], [9, 5]], [[7, 5], [9, 3]],
  ];
  for (const [[r1, c1], [r2, c2]] of palaceDiagonals) {
    ctx.beginPath();
    ctx.moveTo(toX(c1), toY(r1));
    ctx.lineTo(toX(c2), toY(r2));
    ctx.stroke();
  }

  ctx.fillStyle = "#5b3a1a";
  ctx.font = "bold 18px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("楚 河          漢 界", MARGIN + 4 * CELL, MARGIN + 4.5 * CELL);

  if (lastMove) {
    for (const pos of [lastMove.from, lastMove.to]) {
      ctx.beginPath();
      ctx.arc(toX(pos.col), toY(pos.row), CELL * 0.46, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(230, 60, 60, 0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  if (selected) {
    ctx.beginPath();
    ctx.arc(toX(selected.col), toY(selected.row), CELL * 0.44, 0, Math.PI * 2);
    ctx.strokeStyle = "#2277dd";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const piece = board?.[r]?.[c];
      if (!piece) continue;
      const x = toX(c), y = toY(r);
      const isCheckedGeneral = check && piece.type === "general";

      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = "#f2e2b8";
      ctx.fill();
      ctx.lineWidth = isCheckedGeneral ? 3 : 2;
      ctx.strokeStyle = isCheckedGeneral ? "#e63c3c" : (piece.side === "red" ? "#b3271e" : "#232323");
      ctx.stroke();

      ctx.fillStyle = piece.side === "red" ? "#b3271e" : "#232323";
      ctx.font = "bold 22px serif";
      ctx.fillText(GLYPH[piece.side][piece.type] || "?", x, y + 1);
    }
  }
}

function XiangqiGame({ socket, room, name, apples, onActiveChange }, ref) {
  const canvasRef = useRef(null);
  const [view, setView] = useState("lobby");
  const [tables, setTables] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [board, setBoard] = useState(null);
  const [turn, setTurn] = useState(null);
  const [status, setStatus] = useState(null);
  const [checkFlag, setCheckFlag] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [redName, setRedName] = useState(null);
  const [blackName, setBlackName] = useState(null);
  const [selected, setSelected] = useState(null);
  const [drawOfferIncoming, setDrawOfferIncoming] = useState(false);
  const [undoRequestIncoming, setUndoRequestIncoming] = useState(false);
  const [toast, setToast] = useState(null);
  const [resultToast, setResultToast] = useState(null);
  const [turnDeadline, setTurnDeadline] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [postHand, setPostHand] = useState(null); // {seats, confirmed, everPlayed, mySeatIndex}
  const [pendingConfirm, setPendingConfirm] = useState(null); // {from, to, pendingOutcome}

  const mySide = name === redName ? "red" : (name === blackName ? "black" : null);
  const flip = mySide === "black";

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(t => (t === msg ? null : t)), 3500);
  }, []);

  // 象棋沒有獨立的「等待中」畫面——建桌後仍留在 lobby，只是桌子列表裡多了自己的名字，
  // 要靠這個推算「我是不是正在某張桌子等對手」，這裡不分是不是房主，反正象棋建桌者就是唯一在場的人
  const myWaitingTable = tables.find(t => t.hostName === name || (t.seats || []).includes(name));

  // 讓父層（休閒廳）在切分頁/開新桌前可以判斷「我現在佔用象棋到什麼程度」：
  // "playing" = 對局進行中（中離要跳警告會損失入場費）
  // "waiting" = 已經開桌等對手，或上一局打完等重賽（中離沒有損失，只是要先離開才能做別的事）
  // null      = 沒有佔用，可以自由切走
  useEffect(() => {
    const mode = (view === "game" && status === "playing") ? "playing"
      : (view === "postHand" || (view === "lobby" && myWaitingTable)) ? "waiting"
      : null;
    onActiveChange?.(mode);
  }, [view, status, myWaitingTable, onActiveChange]);

  useImperativeHandle(ref, () => ({
    leaveCurrent() {
      if (view === "game" && status === "playing" && tableId) {
        socket.emit("xiangqiForfeit", { tableId });
        // 座位在後端已經整個空出來了（跟斷線同一條路徑），這裡直接樂觀地把本地畫面
        // 收回大廳，不然元件會停在剛剛那盤棋的畫面，等分頁被切回來時看起來像卡住
        setView("lobby");
        setTableId(null);
        setBoard(null);
        setRedName(null);
        setBlackName(null);
        setPostHand(null);
        socket.emit("xiangqiGetTables");
        return;
      }
      if (view === "postHand") {
        handleLeaveAfterHand();
        return;
      }
      if (view === "lobby" && myWaitingTable) {
        socket.emit("xiangqiCancelTable", { tableId: myWaitingTable.id });
        socket.emit("xiangqiGetTables");
      }
    },
  }), [view, status, tableId, myWaitingTable, socket]);

  useEffect(() => {
    if (!socket) return;
    socket.emit("xiangqiGetTables");

    const onTableList = (list) => setTables(list);
    const onTableStart = (payload) => {
      setTableId(payload.tableId);
      setBoard(payload.board);
      setTurn(payload.turn);
      setRedName(payload.red);
      setBlackName(payload.black);
      setStatus("playing");
      setCheckFlag(false);
      setLastMove(null);
      setSelected(null);
      setDrawOfferIncoming(false);
      setUndoRequestIncoming(false);
      setTurnDeadline(payload.turnDeadline || null);
      setPostHand(null);
      setPendingConfirm(null);
      setView("game");
    };
    const onState = (payload) => {
      setBoard(payload.board);
      setTurn(payload.turn);
      setStatus(payload.status);
      setCheckFlag(!!payload.check);
      setLastMove(payload.lastMove || null);
      setSelected(null);
      setDrawOfferIncoming(false);
      setUndoRequestIncoming(false);
      setTurnDeadline(payload.turnDeadline || null);
      setPendingConfirm(null);
    };
    const onConfirmMove = (payload) => setPendingConfirm(payload);
    const onGameDone = (result) => {
      setResultToast(result);
      setTimeout(() => setResultToast(r => (r === result ? null : r)), 6000);
    };
    const onTableWaiting = (payload) => {
      setPostHand(payload);
      setView("postHand");
    };
    const onError = ({ reason }) => showToast(reason || "發生錯誤");
    const onDrawOffered = () => setDrawOfferIncoming(true);
    const onDrawDeclined = () => showToast("對方拒絕了求和請求");
    const onUndoRequested = () => setUndoRequestIncoming(true);
    const onUndoDeclined = () => showToast("對方拒絕了悔棋請求");

    socket.on("xiangqiTableList", onTableList);
    socket.on("xiangqiTableStart", onTableStart);
    socket.on("xiangqiState", onState);
    socket.on("xiangqiGameDone", onGameDone);
    socket.on("xiangqiTableWaiting", onTableWaiting);
    socket.on("xiangqiConfirmMove", onConfirmMove);
    socket.on("xiangqiError", onError);
    socket.on("xiangqiDrawOffered", onDrawOffered);
    socket.on("xiangqiDrawDeclined", onDrawDeclined);
    socket.on("xiangqiUndoRequested", onUndoRequested);
    socket.on("xiangqiUndoDeclined", onUndoDeclined);

    return () => {
      socket.off("xiangqiTableList", onTableList);
      socket.off("xiangqiTableStart", onTableStart);
      socket.off("xiangqiState", onState);
      socket.off("xiangqiGameDone", onGameDone);
      socket.off("xiangqiTableWaiting", onTableWaiting);
      socket.off("xiangqiConfirmMove", onConfirmMove);
      socket.off("xiangqiError", onError);
      socket.off("xiangqiDrawOffered", onDrawOffered);
      socket.off("xiangqiDrawDeclined", onDrawDeclined);
      socket.off("xiangqiUndoRequested", onUndoRequested);
      socket.off("xiangqiUndoDeclined", onUndoDeclined);
    };
  }, [socket, showToast]);

  useEffect(() => {
    if (view !== "game" || !canvasRef.current || !board) return;
    const ctx = canvasRef.current.getContext("2d");
    drawBoard(ctx, { board, selected, lastMove, check: checkFlag, flip });
  }, [view, board, selected, lastMove, checkFlag, flip]);

  useEffect(() => {
    if (view !== "game" || status !== "playing" || !turnDeadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [view, status, turnDeadline]);

  const secondsLeft = turnDeadline ? Math.max(0, Math.ceil((turnDeadline - now) / 1000)) : null;

  function handleCreateTable() {
    if (apples != null && apples < ENTRY_FEE) {
      showToast(`${roomConfig.currency_name}不足，需要 ${ENTRY_FEE} 個才能建桌`);
      return;
    }
    socket.emit("xiangqiCreateTable");
  }

  function handleJoinTable(id) {
    if (apples != null && apples < ENTRY_FEE) {
      showToast(`${roomConfig.currency_name}不足，需要 ${ENTRY_FEE} 個才能加入`);
      return;
    }
    socket.emit("xiangqiJoinTable", { tableId: id });
  }

  function handleCancelTable(id) {
    socket.emit("xiangqiCancelTable", { tableId: id });
  }

  function handleLeaveAfterHand() {
    socket.emit("xiangqiLeaveTable", { tableId });
    setView("lobby");
    setTableId(null);
    setBoard(null);
    setRedName(null);
    setBlackName(null);
    setPostHand(null);
    socket.emit("xiangqiGetTables");
  }

  function handleConfirmMove() {
    if (!pendingConfirm) return;
    socket.emit("xiangqiMove", { tableId, from: pendingConfirm.from, to: pendingConfirm.to, confirmed: true });
    setPendingConfirm(null);
  }
  function handleCancelMove() {
    if (!pendingConfirm) return;
    socket.emit("xiangqiCancelMove", { tableId });
    setPendingConfirm(null);
  }

  function handleCanvasClick(e) {
    if (status !== "playing" || turn !== mySide || pendingConfirm) return;
    const rect = canvasRef.current.getBoundingClientRect();
    // 手機上 .xq-canvas 會被 CSS 縮小（max-width: 100%），顯示尺寸跟畫布內部座標
    // （BOARD_W/BOARD_H）不一致，點擊座標要先換算回內部座標系，不然點的格子會對不上
    const scaleX = BOARD_W / rect.width, scaleY = BOARD_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX, y = (e.clientY - rect.top) * scaleY;
    let col = Math.round((x - MARGIN) / CELL);
    let row = Math.round((y - MARGIN) / CELL);
    if (flip) { col = 8 - col; row = 9 - row; }
    if (row < 0 || row > 9 || col < 0 || col > 8) return;

    const piece = board?.[row]?.[col];
    if (!selected) {
      if (piece && piece.side === mySide) setSelected({ row, col });
      return;
    }
    if (selected.row === row && selected.col === col) { setSelected(null); return; }
    if (piece && piece.side === mySide) { setSelected({ row, col }); return; }
    socket.emit("xiangqiMove", { tableId, from: selected, to: { row, col } });
    setSelected(null);
  }

  if (view === "lobby") {
    return (
      <div className="xq-lobby">
        {toast && <div className="xq-toast">{toast}</div>}
        <p className="xq-hint">進場費 {ENTRY_FEE} 個{roomConfig.currency_name}，贏家獲得全部彩池；和棋各退回自己的進場費。</p>
        <button className="xq-create-btn" onClick={handleCreateTable}>➕ 建立新桌</button>
        <div className="xq-table-list">
          {tables.length === 0 && <div className="xq-empty">目前沒有等待中的桌子</div>}
          {tables.map(t => (
            <div key={t.id} className="xq-table-row">
              <span>{t.hostName} 的桌子</span>
              {t.hostName === name ? (
                <button className="xq-cancel-btn" onClick={() => handleCancelTable(t.id)}>取消</button>
              ) : (
                <button className="xq-join-btn" onClick={() => handleJoinTable(t.id)}>加入</button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "postHand") {
    const seats = postHand?.seats || [null, null];
    const confirmed = postHand?.confirmed || [false, false];
    const mySeatIndex = postHand?.mySeatIndex;
    const labels = ["紅方", "黑方"];
    return (
      <div className="xq-lobby">
        {toast && <div className="xq-toast">{toast}</div>}
        {resultToast && (
          <div className="xq-result-toast">
            {resultToast.result === "win" && (
              <>{resultToast.winner === name ? "🎉 你贏了！" : "😢 你輸了"}（{resultToast.reason}）
                {resultToast.winner === name ? ` 獲得 ${resultToast.pot} 個${roomConfig.currency_name}` : ""}</>
            )}
            {resultToast.result === "draw" && <>🤝 和棋（{resultToast.reason}），退回 {resultToast.refund} 個{roomConfig.currency_name}</>}
          </div>
        )}
        <p className="xq-hint">本局結束，等待雙方確認「再來一局」（空位可讓其他人加入補位）</p>
        <ul className="xq-waiting-seats">
          {seats.map((s, i) => (
            <li key={i}>{labels[i]}：{s || "（空位，等待補位）"}{s && confirmed[i] ? " ✅ 已準備" : ""}</li>
          ))}
        </ul>
        {mySeatIndex != null && (
          <div className="xq-actions">
            <button
              className="xq-create-btn"
              disabled={confirmed[mySeatIndex]}
              onClick={() => socket.emit("xiangqiPlayAgain", { tableId })}
            >
              {confirmed[mySeatIndex] ? "已準備，等待對方" : "🔁 再來一局"}
            </button>
            <button className="xq-cancel-btn" onClick={handleLeaveAfterHand}>離開</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="xq-game">
      {toast && <div className="xq-toast">{toast}</div>}
      {resultToast && (
        <div className="xq-result-toast">
          {resultToast.result === "win" && (
            <>{resultToast.winner === name ? "🎉 你贏了！" : "😢 你輸了"}（{resultToast.reason}）
              {resultToast.winner === name ? ` 獲得 ${resultToast.pot} 個${roomConfig.currency_name}` : ""}</>
          )}
          {resultToast.result === "draw" && <>🤝 和棋（{resultToast.reason}），退回 {resultToast.refund} 個{roomConfig.currency_name}</>}
        </div>
      )}

      <div className="xq-players">
        <span className={turn === "black" ? "xq-turn-active" : ""}>⚫ 黑方：{blackName}</span>
        <span className={turn === "red" ? "xq-turn-active" : ""}>🔴 紅方：{redName}</span>
        {status === "playing" && secondsLeft !== null && (
          <span className="xq-timer">⏱ {secondsLeft}s</span>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={BOARD_W}
        height={BOARD_H}
        className="xq-canvas"
        onClick={handleCanvasClick}
      />

      {checkFlag && status === "playing" && <div className="xq-check-banner">將軍！</div>}

      <div className="xq-actions">
        <button disabled={status !== "playing" || !!pendingConfirm} onClick={() => socket.emit("xiangqiUndoRequest", { tableId })}>悔棋</button>
        <button disabled={status !== "playing" || !!pendingConfirm} onClick={() => socket.emit("xiangqiDrawOffer", { tableId })}>求和</button>
        <button disabled={status !== "playing" || !!pendingConfirm} onClick={() => socket.emit("xiangqiResign", { tableId })}>投降</button>
      </div>

      {pendingConfirm && (
        <div className="xq-request-modal">
          <p>
            {pendingConfirm.pendingOutcome.type === "draw"
              ? `這步棋會造成重複局面和棋（${pendingConfirm.pendingOutcome.reason}），確定要這樣走嗎？`
              : `這步棋會構成犯規判負（${pendingConfirm.pendingOutcome.reason}），確定要這樣走嗎？`}
          </p>
          <button onClick={handleConfirmMove}>確認</button>
          <button onClick={handleCancelMove}>取消，重新選棋</button>
        </div>
      )}

      {drawOfferIncoming && (
        <div className="xq-request-modal">
          <p>對方請求求和，是否同意？</p>
          <button onClick={() => { socket.emit("xiangqiDrawAccept", { tableId }); setDrawOfferIncoming(false); }}>同意</button>
          <button onClick={() => { socket.emit("xiangqiDrawDecline", { tableId }); setDrawOfferIncoming(false); }}>拒絕</button>
        </div>
      )}
      {undoRequestIncoming && (
        <div className="xq-request-modal">
          <p>對方請求悔棋，是否同意？</p>
          <button onClick={() => { socket.emit("xiangqiUndoAccept", { tableId }); setUndoRequestIncoming(false); }}>同意</button>
          <button onClick={() => { socket.emit("xiangqiUndoDecline", { tableId }); setUndoRequestIncoming(false); }}>拒絕</button>
        </div>
      )}
    </div>
  );
}

export default forwardRef(XiangqiGame);
