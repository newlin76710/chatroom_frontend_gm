import { lazy, Suspense, useState } from "react";
import "./LoungePanel.css";
import { useDraggableWindow } from "../../shared/hooks/useDraggableWindow";

const XiangqiGame = lazy(() => import("./XiangqiGame"));
const MahjongGame = lazy(() => import("./MahjongGame"));
const BigTwoGame = lazy(() => import("./BigTwoGame"));

export default function LoungePanel({ socket, room, name, apples, open, onClose }) {
  const [tab, setTab] = useState("xiangqi");
  const { windowRef, onPointerDown } = useDraggableWindow();

  if (!open) return null;

  return (
    <div ref={windowRef} className="lounge-panel">
      <div className="lounge-header" onPointerDown={onPointerDown}>
        <span className="lounge-title">🎲 休閒廳</span>
        <button className="lounge-close-btn" onClick={onClose}>✖</button>
      </div>

      <div className="lounge-tabs">
        <button className={`lounge-tab ${tab === "mahjong" ? "active" : ""}`} onClick={() => setTab("mahjong")}>🀄 麻將</button>
        <button className={`lounge-tab ${tab === "bigtwo" ? "active" : ""}`} onClick={() => setTab("bigtwo")}>🃏 大老二</button>
        <button className={`lounge-tab ${tab === "xiangqi" ? "active" : ""}`} onClick={() => setTab("xiangqi")}>♟️ 象棋</button>
      </div>

      <div className="lounge-body">
        {tab === "mahjong" && (
          <Suspense fallback={null}>
            <MahjongGame socket={socket} room={room} name={name} apples={apples} />
          </Suspense>
        )}
        {tab === "bigtwo" && (
          <Suspense fallback={null}>
            <BigTwoGame socket={socket} room={room} name={name} apples={apples} />
          </Suspense>
        )}
        {tab === "xiangqi" && (
          <Suspense fallback={null}>
            <XiangqiGame socket={socket} room={room} name={name} apples={apples} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
