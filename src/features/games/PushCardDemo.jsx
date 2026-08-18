import { useRef, useState } from "react";
import PushCardGame from "./PushCardGame";

// 最簡單的假 socket：只需要 on/off/emit 供 PushCardGame 監聽用，不連真的後端
function createFakeSocket(state) {
  const listeners = {};
  return {
    on(event, cb) { (listeners[event] ||= []).push(cb); },
    off(event, cb) { listeners[event] = (listeners[event] || []).filter((f) => f !== cb); },
    emit(event) {
      if (event === "joinPushCard") state.onJoin();
    },
    _fire(event, payload) { (listeners[event] || []).forEach((cb) => cb(payload)); },
  };
}

const HOST_NAME = "站長";
const MY_NAME = "小明";

export default function PushCardDemo() {
  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState(10);
  const [reward, setReward] = useState(10);

  const joinedRef = useRef(false);
  const socketRef = useRef(createFakeSocket({
    onJoin: () => { joinedRef.current = true; },
  }));

  const start = () => {
    if (running) return;
    setRunning(true);
    joinedRef.current = false;

    socketRef.current._fire("pushCardStart", { durationMs: duration * 1000, hostName: HOST_NAME });

    setTimeout(() => {
      const hostCard = 1 + Math.floor(Math.random() * 10);
      const results = [];
      if (joinedRef.current) {
        const myCard = 1 + Math.floor(Math.random() * 10);
        results.push({ username: MY_NAME, card: myCard, win: myCard > hostCard });
      }
      socketRef.current._fire("pushCardEnd", { hostName: HOST_NAME, hostCard, reward, results });
      setRunning(false);
    }, duration * 1000);
  };

  return (
    <main style={{
      minHeight: "100vh",
      padding: 24,
      background: "linear-gradient(180deg, #101010, #1a1a1a)",
      color: "#eee",
      fontFamily: "Arial, sans-serif",
    }}>
      <h1 style={{ marginTop: 0 }}>🃏 推牌遊戲 Demo</h1>
      <p style={{ opacity: 0.75, maxWidth: 560 }}>
        右下角小卡片版本的展示頁，不連真的後端，用假的 socket 事件模擬「站長開局」「玩家選擇參加/不參加」「時間到發牌比大小」整個流程。
        我的名字固定是「小明」，站長固定是「站長」（跟自己不同名，所以會看到參加/不參加的選擇卡片）。
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <label>
          秒數：
          <input type="number" min={5} max={60} value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 10)}
            disabled={running} style={{ width: 60, marginLeft: 6 }} />
        </label>
        <label>
          獎勵金幣：
          <input type="number" min={1} value={reward}
            onChange={(e) => setReward(Number(e.target.value) || 10)}
            disabled={running} style={{ width: 60, marginLeft: 6 }} />
        </label>
        <button onClick={start} disabled={running} style={{ padding: "8px 16px" }}>
          {running ? "進行中…" : "🃏 站長開始推牌"}
        </button>
      </div>

      <div style={{ marginTop: 24, fontSize: 13, opacity: 0.6 }}>
        開局後右下角會跳出卡片：點「參加」會進入等待狀態，時間到後跟站長比大小；點「不參加」則直接關閉，不會有後續畫面。
      </div>

      <PushCardGame socket={socketRef.current} token="demo" name={MY_NAME} />
    </main>
  );
}
