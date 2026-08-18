import { useRef, useState } from "react";
import DigTreasureGame from "./DigTreasureGame";

// 最簡單的假 socket：模擬伺服器的挖寶邏輯（隨機獎勵、次數上限），不連真的後端
function createFakeSocket(state) {
  const listeners = {};
  return {
    on(event, cb) { (listeners[event] ||= []).push(cb); },
    off(event, cb) { listeners[event] = (listeners[event] || []).filter((f) => f !== cb); },
    emit(event) {
      if (event === "digTreasure") state.handleDig();
    },
    _fire(event, payload) { (listeners[event] || []).forEach((cb) => cb(payload)); },
  };
}

const OTHER_PLAYERS = ["路過人間", "夜貓子", "旅人甲"];

export default function DigTreasureDemo() {
  const [running, setRunning] = useState(false);
  const [maxDigs, setMaxDigs] = useState(5);
  const [rewardMin, setRewardMin] = useState(1);
  const [rewardMax, setRewardMax] = useState(20);
  const [duration, setDuration] = useState(15);

  const digsUsedRef = useRef(0);
  const totalRewardRef = useRef(0);
  const socketRef = useRef(createFakeSocket({
    handleDig: () => {
      if (digsUsedRef.current >= maxDigs) {
        socketRef.current._fire("digTreasureRejected", { reason: "已達本回合挖寶次數上限" });
        return;
      }
      const reward = rewardMin + Math.floor(Math.random() * (rewardMax - rewardMin + 1));
      digsUsedRef.current += 1;
      totalRewardRef.current += reward;
      socketRef.current._fire("digTreasureResult", {
        reward,
        digsUsed: digsUsedRef.current,
        digsLeft: maxDigs - digsUsedRef.current,
        totalReward: totalRewardRef.current,
      });
    },
  }));

  const start = () => {
    if (running) return;
    setRunning(true);
    digsUsedRef.current = 0;
    totalRewardRef.current = 0;

    socketRef.current._fire("digGameWarn", { secondsLeft: 5 });
    setTimeout(() => {
      socketRef.current._fire("digGameStart", { duration, maxDigs, rewardMin, rewardMax });
      setTimeout(() => {
        socketRef.current._fire("digGameEnd");
        setTimeout(() => {
          const rewards = {};
          if (totalRewardRef.current > 0) rewards["小明"] = totalRewardRef.current;
          OTHER_PLAYERS.forEach((n) => {
            if (Math.random() < 0.7) {
              rewards[n] = 0;
              for (let i = 0; i < maxDigs; i++) {
                if (Math.random() < 0.8) rewards[n] += rewardMin + Math.floor(Math.random() * (rewardMax - rewardMin + 1));
              }
            }
          });
          socketRef.current._fire("digGameResult", { rewards });
          setRunning(false);
        }, 600);
      }, duration * 1000);
    }, 5000);
  };

  return (
    <main style={{
      minHeight: "100vh",
      padding: 24,
      background: "linear-gradient(180deg, #101010, #1a1a1a)",
      color: "#eee",
      fontFamily: "Arial, sans-serif",
    }}>
      <h1 style={{ marginTop: 0 }}>⛏️ 挖寶遊戲 Demo</h1>
      <p style={{ opacity: 0.75, maxWidth: 560 }}>
        全螢幕覆蓋層版本的展示頁，不連真的後端，用假的 socket 事件模擬「開始前 30 秒預告（demo 縮短成 5 秒）」「開始挖寶」「每次挖寶伺服器即時擲出隨機獎勵」「時間到統一結算」整個流程。
        我的名字固定是「小明」，另外模擬了 3 位其他玩家的挖寶成績用來看結算畫面的排行榜。
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <label>
          持續時間(秒)：
          <input type="number" min={5} max={60} value={duration}
            onChange={(e) => setDuration(Number(e.target.value) || 15)}
            disabled={running} style={{ width: 60, marginLeft: 6 }} />
        </label>
        <label>
          挖寶次數：
          <input type="number" min={1} max={20} value={maxDigs}
            onChange={(e) => setMaxDigs(Number(e.target.value) || 5)}
            disabled={running} style={{ width: 60, marginLeft: 6 }} />
        </label>
        <label>
          隨機獎勵範圍：
          <input type="number" min={1} value={rewardMin}
            onChange={(e) => setRewardMin(Number(e.target.value) || 1)}
            disabled={running} style={{ width: 60, marginLeft: 6 }} />
          ～
          <input type="number" min={1} value={rewardMax}
            onChange={(e) => setRewardMax(Number(e.target.value) || 20)}
            disabled={running} style={{ width: 60, marginLeft: 6 }} />
        </label>
        <button onClick={start} disabled={running} style={{ padding: "8px 16px" }}>
          {running ? "進行中…" : "⛏️ 開始挖寶"}
        </button>
      </div>

      <DigTreasureGame socket={socketRef.current} token="demo" name="小明" setApples={() => {}} />
    </main>
  );
}
