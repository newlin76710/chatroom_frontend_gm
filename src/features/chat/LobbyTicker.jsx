// LobbyTicker.jsx — 大廳頂部跑馬燈（橫向捲動的公告條）。
// 後端送 lobbyTicker 事件 { text, kind?, loops? } 就會排隊播放，一則播完（預設捲 2 次）才播下一則。
// 目前用在捕魚 BOSS 擊殺；不受「隱藏遊戲推播」影響（那個只過濾聊天訊息串）。
import { useEffect, useRef, useState } from "react";
import "./LobbyTicker.css";

const MAX_QUEUE = 10;
const SPEED_PX_PER_SEC = 110;

export default function LobbyTicker({ socket }) {
  const [current, setCurrent] = useState(null); // { id, text, kind, loops }
  const queueRef = useRef([]);
  const currentRef = useRef(null);
  const seqRef = useRef(0);
  const trackRef = useRef(null);
  const [duration, setDuration] = useState(12);

  useEffect(() => { currentRef.current = current; }, [current]);

  useEffect(() => {
    const onTicker = (data) => {
      const text = String(data?.text || "").trim();
      if (!text) return;
      const item = {
        id: ++seqRef.current,
        text,
        kind: data?.kind || "default",
        loops: Math.min(5, Math.max(1, Number(data?.loops) || 2)),
      };
      if (!currentRef.current) setCurrent(item);
      else if (queueRef.current.length < MAX_QUEUE) queueRef.current.push(item);
    };
    socket.on("lobbyTicker", onTicker);
    return () => socket.off("lobbyTicker", onTicker);
  }, [socket]);

  // 依文字長度算捲動時間，長訊息不會捲太快
  useEffect(() => {
    if (!current || !trackRef.current) return;
    const bar = trackRef.current.parentElement;
    const distance = trackRef.current.scrollWidth + (bar?.clientWidth || 600);
    setDuration(Math.max(6, distance / SPEED_PX_PER_SEC));
  }, [current]);

  const next = () => setCurrent(queueRef.current.shift() || null);

  // 保險：分頁在背景/關閉動畫（prefers-reduced-motion）時 animationend 可能不會觸發，時間到強制換下一則
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(next, (duration * current.loops + 1) * 1000);
    return () => clearTimeout(t);
  }, [current, duration]);

  if (!current) return null;
  return (
    <div className={`lobby-ticker lobby-ticker--${current.kind}`} role="status" aria-live="polite">
      <span className="lobby-ticker-badge">📣</span>
      <div className="lobby-ticker-viewport">
        <div
          key={current.id}
          ref={trackRef}
          className="lobby-ticker-track"
          style={{ animationDuration: `${duration}s`, animationIterationCount: current.loops }}
          onAnimationEnd={next}
        >
          {current.text}
        </div>
      </div>
      <button className="lobby-ticker-close" onClick={next} title="關閉">✖</button>
    </div>
  );
}
