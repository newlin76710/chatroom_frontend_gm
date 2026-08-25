// GameHallPanel.jsx
// 統一入口：整合原本娛樂城（21點/輪盤/骰寶/老虎機/百家樂）+ 遊樂場（推幣機/賽車/殭屍生存戰）
// + 休閒廳（麻將/大老二/象棋）共 11 個遊戲成一個可拖曳浮動視窗，取代原本三個各自獨立、
// 娛樂城/遊樂場又是全螢幕遮罩擋住聊天畫面的入口。
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import "./GameHallPanel.css";
import { useDraggableWindow } from "../../shared/hooks/useDraggableWindow";
import { roomConfig } from "../../shared/roomConfig";

const BlackjackGame = lazy(() => import("../casino/BlackjackGame"));
const RouletteGame = lazy(() => import("../casino/RouletteGame"));
const SicBoGame = lazy(() => import("../casino/SicBoGame"));
const SlotMachine = lazy(() => import("../casino/SlotMachine"));
const BaccaratGame = lazy(() => import("../casino/BaccaratGame"));
const PusherMachine = lazy(() => import("../casino/PusherMachine"));
const RacingGame = lazy(() => import("../casino/RacingGame"));
const ZombieSurvivalGame = lazy(() => import("../casino/ZombieSurvivalGame"));
const MahjongGame = lazy(() => import("../lounge/MahjongGame"));
const BigTwoGame = lazy(() => import("../lounge/BigTwoGame"));
const XiangqiGame = lazy(() => import("../lounge/XiangqiGame"));

const TABS = [
  { key: "pusher",  label: "🎰 推幣機" },
  { key: "blackjack", label: "🃏 21點" },
  { key: "roulette", label: "🎡 輪盤" },
  { key: "sicbo",   label: "🎲 骰寶" },
  { key: "slot",    label: "🎰 老虎機" },
  { key: "baccarat", label: "🀄 百家樂" },
  { key: "race",    label: "🏎️ 賽車" },
  { key: "zombie",  label: "🧟 殭屍生存戰" },
  { key: "mahjong", label: "🀄 麻將" },
  { key: "bigtwo",  label: "🃏 大老二" },
  { key: "xiangqi", label: "♟️ 象棋" },
];

// 麻將/大老二/象棋是「佔用一桌」型遊戲，切換分頁前要跟休閒廳原本的邏輯一樣跳確認，
// 避免正在對局中被不小心切走造成中離損失；其餘 8 個遊戲各自獨立，不需要這個確認。
const TABLE_GAME_LABEL = { mahjong: "麻將", bigtwo: "大老二", xiangqi: "象棋" };

export default function GameHallPanel({ token, apples, onApplesChange, socket, room, name, open, onClose }) {
  const [tab, setTab] = useState("pusher");
  const { windowRef, onPointerDown } = useDraggableWindow();

  const mahjongRef = useRef(null);
  const bigtwoRef = useRef(null);
  const xiangqiRef = useRef(null);
  const tableGameRefs = { mahjong: mahjongRef, bigtwo: bigtwoRef, xiangqi: xiangqiRef };
  const [activeMap, setActiveMap] = useState({ mahjong: null, bigtwo: null, xiangqi: null });

  const onMahjongActiveChange = useCallback((v) => setActiveMap(m => (m.mahjong === v ? m : { ...m, mahjong: v })), []);
  const onBigtwoActiveChange = useCallback((v) => setActiveMap(m => (m.bigtwo === v ? m : { ...m, bigtwo: v })), []);
  const onXiangqiActiveChange = useCallback((v) => setActiveMap(m => (m.xiangqi === v ? m : { ...m, xiangqi: v })), []);

  function confirmLeaveActiveTableGame() {
    const mode = activeMap[tab];
    if (!mode) return true;
    const msg = mode === "playing"
      ? `您正在${TABLE_GAME_LABEL[tab]}中，確定要中離嗎？會直接損失入場費`
      : `您已在${TABLE_GAME_LABEL[tab]}開桌等待中，請確認離開該遊戲加入新遊戲嗎`;
    const ok = window.confirm(msg);
    if (!ok) return false;
    tableGameRefs[tab].current?.leaveCurrent();
    return true;
  }

  function handleTabClick(next) {
    if (next === tab) return;
    if (TABLE_GAME_LABEL[tab] && !confirmLeaveActiveTableGame()) return;
    setTab(next);
  }

  return (
    <div
      ref={windowRef}
      className="gamehall-panel"
      style={open ? undefined : { display: "none" }}
    >
      <div className="gamehall-header" onPointerDown={onPointerDown}>
        <span className="gamehall-title">🎮 遊戲廳</span>
        <div className="gamehall-apples">
          <img src={`/gifts/${roomConfig.currency_icon}`} alt={roomConfig.currency_name} style={{ width: 16, height: 16, verticalAlign: "middle" }} />
          {" "}{apples != null ? apples : "–"}
        </div>
        <button className="gamehall-close-btn" onClick={onClose}>✖</button>
      </div>

      <div className="gamehall-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`gamehall-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => handleTabClick(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 每個 tab 都常駐掛載、只用 display:none 隱藏，不卸載——推幣機物理狀態跟棋牌桌
          對局狀態才不會因為切分頁或關閉遊戲廳而消失 */}
      <div className="gamehall-body">
        <Suspense fallback={null}>
          <div style={{ display: tab === "pusher" ? "contents" : "none" }}>
            <PusherMachine token={token} apples={apples} onApplesChange={onApplesChange} visible={open && tab === "pusher"} />
          </div>
          <div style={{ display: tab === "blackjack" ? "block" : "none" }}>
            <BlackjackGame token={token} apples={apples} onApplesChange={onApplesChange} />
          </div>
          <div style={{ display: tab === "roulette" ? "block" : "none" }}>
            <RouletteGame token={token} apples={apples} onApplesChange={onApplesChange} />
          </div>
          <div style={{ display: tab === "sicbo" ? "block" : "none" }}>
            <SicBoGame token={token} apples={apples} onApplesChange={onApplesChange} />
          </div>
          <div style={{ display: tab === "slot" ? "block" : "none" }}>
            <SlotMachine token={token} apples={apples} onApplesChange={onApplesChange} />
          </div>
          <div style={{ display: tab === "baccarat" ? "block" : "none" }}>
            <BaccaratGame token={token} apples={apples} onApplesChange={onApplesChange} />
          </div>
          <div style={{ display: tab === "race" ? "block" : "none" }}>
            <RacingGame token={token} apples={apples} onApplesChange={onApplesChange} />
          </div>
          <div style={{ display: tab === "zombie" ? "block" : "none" }}>
            <ZombieSurvivalGame token={token} apples={apples} onApplesChange={onApplesChange} />
          </div>
          <div style={{ display: tab === "mahjong" ? "block" : "none" }}>
            <MahjongGame ref={mahjongRef} socket={socket} room={room} name={name} apples={apples} onActiveChange={onMahjongActiveChange} />
          </div>
          <div style={{ display: tab === "bigtwo" ? "block" : "none" }}>
            <BigTwoGame ref={bigtwoRef} socket={socket} room={room} name={name} apples={apples} onActiveChange={onBigtwoActiveChange} />
          </div>
          <div style={{ display: tab === "xiangqi" ? "block" : "none" }}>
            <XiangqiGame ref={xiangqiRef} socket={socket} room={room} name={name} apples={apples} onActiveChange={onXiangqiActiveChange} />
          </div>
        </Suspense>
      </div>
    </div>
  );
}
