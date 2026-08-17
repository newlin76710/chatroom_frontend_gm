import { lazy, Suspense, useCallback, useRef, useState } from "react";
import "./LoungePanel.css";
import { useDraggableWindow } from "../../shared/hooks/useDraggableWindow";

const XiangqiGame = lazy(() => import("./XiangqiGame"));
const MahjongGame = lazy(() => import("./MahjongGame"));
const BigTwoGame = lazy(() => import("./BigTwoGame"));

const TAB_LABEL = { mahjong: "麻將", bigtwo: "大老二", xiangqi: "象棋" };

export default function LoungePanel({ socket, room, name, apples, open, onClose }) {
  const [tab, setTab] = useState("xiangqi");
  const { windowRef, onPointerDown } = useDraggableWindow();

  // 三個遊戲都用同一套機制回報「我現在佔用這個遊戲到什麼程度」：
  // "playing" = 對局進行中，"waiting" = 已開桌/加入等湊人數或等重賽，null/false = 沒佔用
  const mahjongRef = useRef(null);
  const bigtwoRef = useRef(null);
  const xiangqiRef = useRef(null);
  const gameRefs = { mahjong: mahjongRef, bigtwo: bigtwoRef, xiangqi: xiangqiRef };
  const [activeMap, setActiveMap] = useState({ mahjong: null, bigtwo: null, xiangqi: null });

  // 用 useCallback 固定參考，避免每次 render 都產生新函式，導致遊戲元件裡
  // 依賴 onActiveChange 的 useEffect 無限重新觸發（setState → re-render → 新函式 → 再觸發…）
  const onMahjongActiveChange = useCallback((v) => setActiveMap(m => (m.mahjong === v ? m : { ...m, mahjong: v })), []);
  const onBigtwoActiveChange = useCallback((v) => setActiveMap(m => (m.bigtwo === v ? m : { ...m, bigtwo: v })), []);
  const onXiangqiActiveChange = useCallback((v) => setActiveMap(m => (m.xiangqi === v ? m : { ...m, xiangqi: v })), []);

  function confirmLeaveActiveGame() {
    const mode = activeMap[tab];
    if (!mode) return true;
    const msg = mode === "playing"
      ? `您正在${TAB_LABEL[tab]}中，確定要中離嗎？會直接損失入場費`
      : `您已在${TAB_LABEL[tab]}開桌等待中，請確認離開該遊戲加入新遊戲嗎`;
    const ok = window.confirm(msg);
    if (!ok) return false;
    gameRefs[tab].current?.leaveCurrent();
    return true;
  }

  function handleTabClick(next) {
    if (next === tab) return;
    if (!confirmLeaveActiveGame()) return;
    setTab(next);
  }

  // 關閉整個休閒廳視窗（❌）也會整個卸載掛載中的遊戲元件，效果等同切分頁離開，
  // 所以要用同一套「進行中要跳確認」的邏輯，不能讓人不小心點一下就白白中離
  function handleClose() {
    if (!confirmLeaveActiveGame()) return;
    onClose();
  }

  if (!open) return null;

  return (
    <div ref={windowRef} className="lounge-panel">
      <div className="lounge-header" onPointerDown={onPointerDown}>
        <span className="lounge-title">🎲 休閒廳</span>
        <button className="lounge-close-btn" onClick={handleClose}>✖</button>
      </div>

      <div className="lounge-tabs">
        <button className={`lounge-tab ${tab === "mahjong" ? "active" : ""}`} onClick={() => handleTabClick("mahjong")}>🀄 麻將</button>
        <button className={`lounge-tab ${tab === "bigtwo" ? "active" : ""}`} onClick={() => handleTabClick("bigtwo")}>🃏 大老二</button>
        <button className={`lounge-tab ${tab === "xiangqi" ? "active" : ""}`} onClick={() => handleTabClick("xiangqi")}>♟️ 象棋</button>
      </div>

      {/* 三個遊戲都常駐掛載，切分頁只是用 display:none 隱藏，不會卸載——
          避免切走再切回來時遺失對局狀態（棋盤消失、「再來一局」按鈕失效等問題） */}
      <div className="lounge-body" style={{ display: tab === "mahjong" ? "block" : "none" }}>
        <Suspense fallback={null}>
          <MahjongGame
            ref={gameRefs.mahjong}
            socket={socket} room={room} name={name} apples={apples}
            onActiveChange={onMahjongActiveChange}
          />
        </Suspense>
      </div>
      <div className="lounge-body" style={{ display: tab === "bigtwo" ? "block" : "none" }}>
        <Suspense fallback={null}>
          <BigTwoGame
            ref={gameRefs.bigtwo}
            socket={socket} room={room} name={name} apples={apples}
            onActiveChange={onBigtwoActiveChange}
          />
        </Suspense>
      </div>
      <div className="lounge-body" style={{ display: tab === "xiangqi" ? "block" : "none" }}>
        <Suspense fallback={null}>
          <XiangqiGame
            ref={gameRefs.xiangqi}
            socket={socket} room={room} name={name} apples={apples}
            onActiveChange={onXiangqiActiveChange}
          />
        </Suspense>
      </div>
    </div>
  );
}
