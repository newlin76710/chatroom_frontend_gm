// ScatterCherryGame.jsx — 撒櫻桃遊戲覆蓋層（房間貨幣名稱含「櫻桃」時啟用）
// 天空撒下一整批櫻桃，全房間共用同一批：必須用滑鼠（或手指）點到才算撿到，先點先得。
// 每一次點擊都由伺服器即時判定歸屬，畫面上的「已撿」數字以伺服器回覆為準。
//
// Socket 事件：
//   接收 (in):
//     scatterCherryWarn    { secondsLeft }
//     scatterCherryStart   { duration, cherries: [{ id, x, delay, fall, size }], reward, maxPerUser, total }
//     scatterCherryTaken   { id, name }
//     scatterCherryAck     { id, count }
//     scatterCherryMiss    { id, by?, reason? }
//     scatterCherryEnd     (空)
//     scatterCherryResult  { catches: { [name]: amount } }
//   發送 (out):
//     scatterCherryClick   { token, room, id }

import { useState, useEffect, useRef, useCallback } from "react";
import "./CherryTreeGame.css";
import "./ScatterCherryGame.css";

import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";

let popSeq = 0;

export default function ScatterCherryGame({ socket, token, name, setApples }) {
  // 遊戲階段: idle | warn | playing | result
  const [phase, setPhase] = useState("idle");
  const [warnSeconds, setWarnSeconds] = useState(30);
  const [cherries, setCherries] = useState([]);   // 本輪整批櫻桃
  const [gone, setGone] = useState(() => new Set()); // 已被撿走/已掉出畫面的 id
  const [pops, setPops] = useState([]);            // 點擊後的飄字特效
  const [reward, setReward] = useState(1);
  const [maxPerUser, setMaxPerUser] = useState(0);
  const [myCount, setMyCount] = useState(0);
  const [takenTotal, setTakenTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState(null);

  const tokenRef = useRef(token);
  const timerRef = useRef(null);
  const warnTimerRef = useRef(null);
  const pendingRef = useRef(new Map()); // id → { x, y } 我點了、等伺服器回覆的櫻桃

  useEffect(() => { tokenRef.current = token; }, [token]);

  const refreshMyApples = useCallback(async () => {
    if (!token || typeof setApples !== "function") return;
    try {
      const res = await fetch(`${BACKEND}/auth/me?room=${RN}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.gold_apples === "number") {
        setApples(data.gold_apples);
        sessionStorage.setItem("apples", data.gold_apples);
      }
    } catch {}
  }, [token, setApples]);

  const addPop = useCallback((x, y, text, kind) => {
    const id = ++popSeq;
    setPops((prev) => [...prev, { id, x, y, text, kind }]);
    setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 900);
  }, []);

  const markGone = useCallback((id) => {
    setGone((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // ─── Socket 事件 ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onWarn = ({ secondsLeft }) => {
      let s = secondsLeft || 30;
      setWarnSeconds(s);
      clearInterval(warnTimerRef.current);
      warnTimerRef.current = setInterval(() => {
        s -= 1;
        setWarnSeconds(s);
        if (s <= 0) clearInterval(warnTimerRef.current);
      }, 1000);
      setPhase("warn");
    };

    const onStart = ({ duration, cherries: list, reward: r, maxPerUser: cap, total: t }) => {
      clearInterval(warnTimerRef.current);
      pendingRef.current.clear();
      setCherries(list || []);
      setGone(new Set());
      setPops([]);
      setReward(r || 1);
      setMaxPerUser(cap || 0);
      setTotal(t || (list || []).length);
      setMyCount(0);
      setTakenTotal(0);
      setResult(null);
      setPhase("playing");

      clearInterval(timerRef.current);
      let left = duration;
      setTimeLeft(left);
      timerRef.current = setInterval(() => {
        left -= 1;
        setTimeLeft(Math.max(0, left));
        if (left <= 0) clearInterval(timerRef.current);
      }, 1000);
    };

    const onTaken = ({ id, name: taker }) => {
      setTakenTotal((n) => n + 1);
      markGone(id);
      if (taker !== name) pendingRef.current.delete(id);
    };

    const onAck = ({ id, count }) => {
      setMyCount(count);
      const pos = pendingRef.current.get(id);
      pendingRef.current.delete(id);
      if (pos) addPop(pos.x, pos.y, `+${reward}`, "ok");
    };

    const onMiss = ({ id, by, reason }) => {
      const pos = pendingRef.current.get(id);
      pendingRef.current.delete(id);
      if (pos) addPop(pos.x, pos.y, reason === "limit" ? "已達上限" : by ? `被 ${by} 搶走` : "沒搶到", "miss");
    };

    const onEnd = () => {
      clearInterval(timerRef.current);
      setPhase((p) => (p === "playing" || p === "warn" ? "result" : p));
    };

    const onResult = ({ catches }) => {
      setResult(catches || {});
      setPhase((p) => (p === "idle" ? p : "result"));
      if ((catches?.[name] || 0) > 0) setTimeout(() => { refreshMyApples(); }, 300);
    };

    socket.on("scatterCherryWarn", onWarn);
    socket.on("scatterCherryStart", onStart);
    socket.on("scatterCherryTaken", onTaken);
    socket.on("scatterCherryAck", onAck);
    socket.on("scatterCherryMiss", onMiss);
    socket.on("scatterCherryEnd", onEnd);
    socket.on("scatterCherryResult", onResult);
    return () => {
      socket.off("scatterCherryWarn", onWarn);
      socket.off("scatterCherryStart", onStart);
      socket.off("scatterCherryTaken", onTaken);
      socket.off("scatterCherryAck", onAck);
      socket.off("scatterCherryMiss", onMiss);
      socket.off("scatterCherryEnd", onEnd);
      socket.off("scatterCherryResult", onResult);
    };
  }, [socket, name, reward, addPop, markGone, refreshMyApples]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(warnTimerRef.current);
  }, []);

  // 只能用點的：按下去的瞬間才算
  const handleCherryDown = useCallback((e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (pendingRef.current.has(id)) return;
    pendingRef.current.set(id, { x: e.clientX, y: e.clientY });
    markGone(id); // 先在自己畫面上收起來，結果以伺服器回覆為準
    socket.emit("scatterCherryClick", { token: tokenRef.current, room: RN, id });
  }, [socket, markGone]);

  const closeWarn = () => { setPhase("idle"); clearInterval(warnTimerRef.current); };
  const dismissResult = () => { setPhase("idle"); setResult(null); setCherries([]); };

  if (phase === "idle") return null;

  if (phase === "warn") {
    return (
      <div className="ctg-warn-overlay" onClick={closeWarn}>
        <div className="ctg-warn-card" onClick={(e) => e.stopPropagation()}>
          <div className="ctg-warn-countdown">{warnSeconds}</div>
          <div className="ctg-warn-unit">秒後開始</div>
          <h2 className="ctg-warn-title">🍒 撒櫻桃</h2>
          <ul className="ctg-warn-rules">
            <li>☁️ 天空會<strong>撒下一大把櫻桃</strong></li>
            <li>🖱️ 必須用<strong>滑鼠點</strong>（手機用手指點）才撿得到</li>
            <li>⚡ 全房間搶同一批，<strong>先點先得</strong></li>
            <li>🏆 每撿到一顆獲得 {roomConfig.currency_emoji} {roomConfig.currency_name}獎勵</li>
          </ul>
          <button className="ctg-warn-close" onClick={closeWarn}>我知道了！</button>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const entries = Object.entries(result || {}).sort((a, b) => b[1] - a[1]).slice(0, 100);
    return (
      <div className="ctg-overlay" onClick={dismissResult}>
        <div className="ctg-result" onClick={(e) => e.stopPropagation()}>
          <h2>🍒 撒櫻桃結束！</h2>
          {result === null ? (
            <p>正在結算…（你撿到 {myCount} 顆）</p>
          ) : entries.length > 0 ? (
            <>
              <p>本次得獎名單(前百)：</p>
              <ul>
                {entries.map(([uname, amount]) => (
                  <li key={uname} className={uname === name ? "me" : ""}>
                    {uname}：{amount} 個{roomConfig.currency_name}{uname === name ? " 🎉" : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>這次沒有人撿到櫻桃…</p>
          )}
          <p className="ctg-dismiss-hint">點擊任意處關閉</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ctg-overlay scg-overlay">
      <div className="ctg-hud">
        <span className="ctg-timer">{timeLeft}</span>
        <span className="ctg-timer-unit">秒</span>
        <span className="ctg-hint">我撿到 {myCount}{maxPerUser > 0 ? ` / ${maxPerUser}` : ""} 顆</span>
        <span className="ctg-hint">全場 {takenTotal} / {total}</span>
        <span className="ctg-hint">每顆 {reward} 個{roomConfig.currency_emoji}</span>
      </div>
      <div className="scg-cloud">☁️🍒☁️</div>

      {cherries.map((c) =>
        gone.has(c.id) ? null : (
          <div
            key={c.id}
            className="scg-cherry"
            style={{
              left: `${c.x * 100}%`,
              fontSize: c.size,
              animationDuration: `${c.fall}ms`,
              animationDelay: `${c.delay}ms`,
              "--scg-drift": `${((c.size * 7) % 60) - 30}px`,
            }}
            onPointerDown={(e) => handleCherryDown(e, c.id)}
            onAnimationEnd={() => markGone(c.id)}
          >
            🍒
          </div>
        )
      )}

      {pops.map((p) => (
        <div key={p.id} className={`scg-pop scg-pop-${p.kind}`} style={{ left: p.x, top: p.y }}>
          {p.text}
        </div>
      ))}
    </div>
  );
}
