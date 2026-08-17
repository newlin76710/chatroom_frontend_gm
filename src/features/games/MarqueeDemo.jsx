import { useRef, useState } from "react";
import MarqueeGame from "./MarqueeGame";

// 最簡單的假 socket：只需要 on/off/emit 供 MarqueeGame 監聽用，不連真的後端
function createFakeSocket() {
  const listeners = {};
  return {
    on(event, cb) { (listeners[event] ||= []).push(cb); },
    off(event, cb) { listeners[event] = (listeners[event] || []).filter((f) => f !== cb); },
    _fire(event, payload) { (listeners[event] || []).forEach((cb) => cb(payload)); },
  };
}

const DEMO_USERS = [
  { name: "路過人間", type: "account", invisible: false },
  { name: "隱身站長", type: "account", invisible: true },
  { name: "小明", type: "account", invisible: false },
  { name: "AI助手", type: "AI", invisible: false },
  { name: "小華", type: "account", invisible: false },
  { name: "夜貓子", type: "account", invisible: false },
  { name: "旅人甲", type: "guest", invisible: false },
];

export default function MarqueeDemo() {
  const socketRef = useRef(createFakeSocket());
  const [myName, setMyName] = useState("小明");
  const [running, setRunning] = useState(false);

  const start = () => {
    if (running) return;
    setRunning(true);
    const eligible = DEMO_USERS.filter((u) => u.type !== "AI" && !u.invisible);
    const winner = eligible[Math.floor(Math.random() * eligible.length)]?.name || null;
    socketRef.current._fire("marqueeStart", { durationMs: 4000, tickMs: 150, reward: 10 });
    setTimeout(() => {
      socketRef.current._fire("marqueeEnd", { winner, reward: 10 });
      setRunning(false);
    }, 4000);
  };

  return (
    <main style={{
      minHeight: "100vh",
      padding: 24,
      background: "linear-gradient(180deg, #101010, #1a1a1a)",
      color: "#eee",
      fontFamily: "Arial, sans-serif",
    }}>
      <h1 style={{ marginTop: 0 }}>🎰 跑馬燈抽獎 Demo</h1>
      <p style={{ opacity: 0.75, maxWidth: 560 }}>
        右下角小卡片版本的展示頁，不連真的後端，用假的 socket 事件模擬「開始跑馬燈」跟「抽獎結束」。
        名單裡故意放了一個隱身使用者（隱身站長）跟一個 AI（AI助手），跑動動畫跟抽獎結果都應該完全看不到這兩個名字。
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <label>
          我的名字（決定「恭喜你中獎了」會不會出現）：
          <select value={myName} onChange={(e) => setMyName(e.target.value)} style={{ marginLeft: 6 }}>
            {DEMO_USERS.filter((u) => u.type !== "AI" && !u.invisible).map((u) => (
              <option key={u.name} value={u.name}>{u.name}</option>
            ))}
          </select>
        </label>
        <button onClick={start} disabled={running} style={{ padding: "8px 16px" }}>
          {running ? "抽獎中…" : "🎰 開始跑馬燈"}
        </button>
      </div>

      <div style={{ marginTop: 24, fontSize: 13, opacity: 0.6 }}>
        參與名單：{DEMO_USERS.map((u) => `${u.name}${u.invisible ? "（隱身）" : ""}${u.type === "AI" ? "（AI）" : ""}`).join("、")}
      </div>

      <MarqueeGame socket={socketRef.current} name={myName} userList={DEMO_USERS} />
    </main>
  );
}
