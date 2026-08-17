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

  // 三個遊戲都用同一套機制回報「這一局還在打嗎」，並在確認中離時觸發強制中離
  // （中離者座位轉代打，其他玩家繼續，入場費算輸掉——跟斷線時的處理完全一樣）
  const mahjongRef = useRef(null);
  const bigtwoRef = useRef(null);
  const xiangqiRef = useRef(null);
  const gameRefs = { mahjong: mahjongRef, bigtwo: bigtwoRef, xiangqi: xiangqiRef };
  const [activeMap, setActiveMap] = useState({ mahjong: false, bigtwo: false, xiangqi: false });

  // 用 useCallback 固定參考，避免每次 render 都產生新函式，導致遊戲元件裡
  // 依賴 onActiveChange 的 useEffect 無限重新觸發（setState → re-render → 新函式 → 再觸發…）
  const onMahjongActiveChange = useCallback((v) => setActiveMap(m => (m.mahjong === v ? m : { ...m, mahjong: v })), []);
  const onBigtwoActiveChange = useCallback((v) => setActiveMap(m => (m.bigtwo === v ? m : { ...m, bigtwo: v })), []);
  const onXiangqiActiveChange = useCallback((v) => setActiveMap(m => (m.xiangqi === v ? m : { ...m, xiangqi: v })), []);

  function confirmLeaveActiveGame() {
    if (!activeMap[tab]) return true;
    const ok = window.confirm(`您正在${TAB_LABEL[tab]}中，確定要中離嗎？會直接損失入場費`);
    if (!ok) return false;
    gameRefs[tab].current?.forfeitIfPlaying();
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
