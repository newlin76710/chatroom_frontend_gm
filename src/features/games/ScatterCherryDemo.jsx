import { useEffect, useRef, useState } from "react";
import ScatterCherryGame from "./ScatterCherryGame";
import "../chat/MessageList.css";
import { roomConfig } from "../../shared/roomConfig";
import { getCherryTitle, getCherryLevelIcon } from "../../shared/cherryLevel";

// /scatter-cherry-demo：純前端假資料展示「撒櫻桃」與櫻桃房等級圖案/進場歡呼（不連後端）。
// 假 socket 在前端模擬後端 scatterCherryGame.js：產生整批櫻桃、先點先得、假人也會搶、時間到結算。
Object.assign(roomConfig, { currency_name: "紅櫻桃", currency_emoji: "🍒" });

const ME = "我自己";
const BOTS = ["小櫻", "阿明", "櫻桃控", "路人甲"];

function createFakeServer() {
  const listeners = {};
  const fire = (ev, p) => (listeners[ev] || []).forEach((cb) => cb(p));
  let game = null;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const start = ({ count, duration, reward, warn }) => {
    timers.splice(0).forEach(clearTimeout);
    game = null;
    const run = () => {
      const now = Date.now();
      const spawnWindow = Math.max(1000, duration * 1000 - 5000);
      const cherries = Array.from({ length: count }, (_, i) => ({
        id: `sc-${now}-${i}`,
        x: Math.round((0.04 + Math.random() * 0.88) * 1000) / 1000,
        delay: Math.round(Math.random() * spawnWindow),
        fall: Math.round(3500 + Math.random() * 3000),
        size: Math.round(30 + Math.random() * 16),
      })).sort((a, b) => a.delay - b.delay);
      game = { taken: new Map(), counts: new Map(), reward };
      fire("scatterCherryStart", { duration, cherries, reward, maxPerUser: 0, total: count });
      // 假人：每顆有 35% 機率在飄到一半時被假人搶走
      for (const c of cherries) {
        if (Math.random() < 0.35) {
          later(() => take(c.id, BOTS[Math.floor(Math.random() * BOTS.length)]), c.delay + c.fall * (0.3 + Math.random() * 0.5));
        }
      }
      later(() => {
        const catches = {};
        for (const [n, k] of game.counts) catches[n] = k * reward;
        fire("scatterCherryEnd");
        later(() => fire("scatterCherryResult", { catches }), 400);
      }, duration * 1000);
    };
    if (warn) {
      fire("scatterCherryWarn", { secondsLeft: 5 });
      later(run, 5000);
    } else run();
  };

  const take = (id, who) => {
    if (!game || game.taken.has(id)) return false;
    game.taken.set(id, who);
    game.counts.set(who, (game.counts.get(who) || 0) + 1);
    fire("scatterCherryTaken", { id, name: who });
    return true;
  };

  const socket = {
    on: (ev, cb) => { (listeners[ev] ||= []).push(cb); },
    off: (ev, cb) => { listeners[ev] = (listeners[ev] || []).filter((x) => x !== cb); },
    emit: (ev, p) => {
      if (ev !== "scatterCherryClick" || !game) return;
      setTimeout(() => { // 模擬網路延遲
        if (take(p.id, ME)) fire("scatterCherryAck", { id: p.id, count: game.counts.get(ME) });
        else fire("scatterCherryMiss", { id: p.id, by: game.taken.get(p.id) });
      }, 60);
    },
  };
  return { socket, start, stop: () => timers.splice(0).forEach(clearTimeout) };
}

const LEVEL_SAMPLES = [1, 11, 21, 31, 41, 50, 60, 61, 71, 81, 91, 96, 97, 98, 99];

export default function ScatterCherryDemo() {
  const serverRef = useRef(null);
  if (!serverRef.current) serverRef.current = createFakeServer();
  const [count, setCount] = useState(50);
  const [duration, setDuration] = useState(20);

  useEffect(() => () => serverRef.current.stop(), []);

  const box = { background: "#1d1d26", borderRadius: 12, padding: 16, marginBottom: 16 };
  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "#eee", padding: 16, fontFamily: "sans-serif" }}>
      <h2>🍒 撒櫻桃 / 櫻桃房等級展示（假資料，不連後端）</h2>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>撒櫻桃</h3>
        <p style={{ color: "#aaa" }}>用滑鼠點掉下來的櫻桃；假人（{BOTS.join("、")}）也會一起搶，被搶走的會直接消失。</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label>數量 <input type="number" value={count} min={1} max={500} style={{ width: 70 }} onChange={(e) => setCount(Number(e.target.value) || 1)} /></label>
          <label>秒數 <input type="number" value={duration} min={10} max={300} style={{ width: 70 }} onChange={(e) => setDuration(Number(e.target.value) || 10)} /></label>
          <button onClick={() => serverRef.current.start({ count, duration, reward: 1, warn: false })}>▶ 立即開始</button>
          <button onClick={() => serverRef.current.start({ count, duration, reward: 1, warn: true })}>⏱ 含預告開始（5 秒）</button>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>等級圖案（線上名單）</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {LEVEL_SAMPLES.map((lv) => (
            <span key={lv} style={{ background: "#2a2a36", padding: "4px 10px", borderRadius: 8 }}>
              {getCherryLevelIcon(lv)} Lv.{lv}{getCherryTitle(lv) ? ` ${getCherryTitle(lv).title}` : ""}
            </span>
          ))}
        </div>
      </div>

      <div style={box}>
        <h3 style={{ marginTop: 0 }}>進場歡呼（61 級以上）</h3>
        {[65, 75, 85, 93, 96, 97, 98, 99].map((lv) => {
          const t = getCherryTitle(lv);
          return (
            <div key={lv} className="message-row cherry-enter-message">
              <div className={`cherry-enter-banner cherry-enter-${t.tone}`}>
                <span className="cherry-enter-burst">🎉</span>
                <span className="cherry-enter-text">
                  熱烈歡迎
                  <span className="cherry-enter-title">{getCherryLevelIcon(lv)} {t.title}</span>
                  <span className="cherry-enter-name" style={{ color: "#F8C8DC" }}>測試{lv}級</span>
                  駕到！
                </span>
                <span className="cherry-enter-burst">🎉</span>
              </div>
            </div>
          );
        })}
      </div>

      <ScatterCherryGame socket={serverRef.current.socket} token="demo" name={ME} setApples={() => {}} />
    </div>
  );
}
