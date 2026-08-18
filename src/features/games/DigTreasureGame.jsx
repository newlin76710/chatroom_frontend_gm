// DigTreasureGame.jsx — 挖寶遊戲覆蓋層（new_section 模式專用，遊樂場關閉時取代接櫻桃）
// 玩法：畫面上有 15 個地洞，每人整場只有固定次數的挖寶機會（maxDigs）。
// 點擊任一個還沒挖過的地洞＝用掉一次機會，伺服器立刻擲出隨機金幣獎勵直接入帳，
// 該地洞就地顯示挖到的金額；機會用完後其他地洞就不能再挖。
//
// Socket 事件：
//   接收 (in):
//     digGameWarn            { secondsLeft }
//     digGameStart           { duration, maxDigs, rewardMin, rewardMax }
//     digGameEnd             (空)
//     digGameResult          { rewards: { [name]: amount } }
//     digTreasureResult      { reward, digsUsed, digsLeft, totalReward }
//     digTreasureRejected    { reason }
//   發送 (out):
//     digTreasure            { token }   // 每次挖地洞時發送

import { useState, useEffect, useRef, useCallback } from "react";
import "./DigTreasureGame.css";

import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";

// 地洞總數（5x3 排列）
const HOLE_COUNT = 15;

function emptyHoles() {
  return Array.from({ length: HOLE_COUNT }, () => ({ dug: false, pending: false, reward: null }));
}

export default function DigTreasureGame({ socket, token, name, setApples }) {
  // ── 遊戲階段: idle | warn | playing | result
  const [phase, setPhase] = useState("idle");

  // ── 30 秒預告倒數
  const [warnSeconds, setWarnSeconds] = useState(30);

  // ── 遊戲相關狀態 ────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(0);
  const [maxDigs, setMaxDigs] = useState(0);
  const [digsLeft, setDigsLeft] = useState(0);
  const [rewardMin, setRewardMin] = useState(1);
  const [rewardMax, setRewardMax] = useState(10);
  const [myTotal, setMyTotal] = useState(0);
  const [holes, setHoles] = useState(emptyHoles);
  const [result, setResult] = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────────
  const phaseRef = useRef("idle");
  const timerRef = useRef(null);
  const warnTimerRef = useRef(null);
  const digsLeftRef = useRef(0);
  const pendingQueueRef = useRef([]); // 依點擊順序排隊的地洞 index，跟伺服器回應一一對應
  const tokenRef = useRef(token);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { digsLeftRef.current = digsLeft; }, [digsLeft]);

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

  const startTimer = useCallback((secs) => {
    clearInterval(timerRef.current);
    let left = secs;
    setTimeLeft(left);
    timerRef.current = setInterval(() => {
      left--;
      setTimeLeft(left);
      if (left <= 0) clearInterval(timerRef.current);
    }, 1000);
  }, []);

  // ─── Socket 事件監聽 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onWarn = ({ secondsLeft }) => {
      setWarnSeconds(secondsLeft || 30);
      clearInterval(warnTimerRef.current);
      let s = secondsLeft || 30;
      warnTimerRef.current = setInterval(() => {
        s -= 1;
        setWarnSeconds(s);
        if (s <= 0) clearInterval(warnTimerRef.current);
      }, 1000);
      setPhase("warn");
    };

    const onStart = ({ duration, maxDigs: md, rewardMin: rmn, rewardMax: rmx }) => {
      clearInterval(warnTimerRef.current);

      setMaxDigs(md || 0);
      setDigsLeft(md || 0);
      digsLeftRef.current = md || 0;
      setRewardMin(rmn ?? 1);
      setRewardMax(rmx ?? 10);
      setMyTotal(0);
      setResult(null);
      setHoles(emptyHoles());
      pendingQueueRef.current = [];

      setPhase("playing");
      startTimer(duration);
    };

    const onEnd = () => {
      clearInterval(timerRef.current);
      setPhase("result");
    };

    const onResult = ({ rewards }) => {
      setResult(rewards || {});
      if ((rewards?.[name] || 0) > 0) {
        setTimeout(() => { refreshMyApples(); }, 300);
      }
    };

    const onDigResult = ({ reward, digsLeft: left, totalReward }) => {
      const idx = pendingQueueRef.current.shift();
      if (typeof left === "number") { setDigsLeft(left); digsLeftRef.current = left; }
      if (typeof totalReward === "number") setMyTotal(totalReward);
      if (idx !== undefined) {
        setHoles(prev => prev.map((h, i) => i === idx ? { dug: true, pending: false, reward } : h));
      }
    };

    const onDigRejected = () => {
      const idx = pendingQueueRef.current.shift();
      if (idx !== undefined) {
        setHoles(prev => prev.map((h, i) => i === idx ? { dug: false, pending: false, reward: null } : h));
      }
      setDigsLeft(0);
      digsLeftRef.current = 0;
    };

    socket.on("digGameWarn", onWarn);
    socket.on("digGameStart", onStart);
    socket.on("digGameEnd", onEnd);
    socket.on("digGameResult", onResult);
    socket.on("digTreasureResult", onDigResult);
    socket.on("digTreasureRejected", onDigRejected);

    return () => {
      socket.off("digGameWarn", onWarn);
      socket.off("digGameStart", onStart);
      socket.off("digGameEnd", onEnd);
      socket.off("digGameResult", onResult);
      socket.off("digTreasureResult", onDigResult);
      socket.off("digTreasureRejected", onDigRejected);
    };
  }, [socket, name, startTimer, refreshMyApples]);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(warnTimerRef.current);
    };
  }, []);

  const handleDigHole = useCallback((idx) => {
    if (phaseRef.current !== "playing") return;
    if (digsLeftRef.current <= 0) return;
    setHoles(prev => {
      const h = prev[idx];
      if (h.dug || h.pending) return prev;
      const next = [...prev];
      next[idx] = { dug: false, pending: true, reward: null };
      return next;
    });
    digsLeftRef.current -= 1;
    setDigsLeft(digsLeftRef.current);
    pendingQueueRef.current.push(idx);
    socket.emit("digTreasure", { token: tokenRef.current, room: RN });
  }, [socket]);

  const dismissResult = useCallback(() => {
    setPhase("idle");
    setResult(null);
  }, []);

  // ── 30 秒預告說明彈窗 ──────────────────────────────────────────────────
  if (phase === "warn") {
    return (
      <div className="dtg-warn-overlay" onClick={() => { setPhase("idle"); clearInterval(warnTimerRef.current); }}>
        <div className="dtg-warn-card" onClick={e => e.stopPropagation()}>
          <div className="dtg-warn-countdown">{warnSeconds}</div>
          <div className="dtg-warn-unit">秒後開始</div>
          <h2 className="dtg-warn-title">⛏️ 挖寶遊戲</h2>
          <ul className="dtg-warn-rules">
            <li>🕳️ 畫面上有 <strong>15 個地洞</strong></li>
            <li>⛏️ 每人整場只有<strong>固定挖寶次數</strong></li>
            <li>👆 點擊任一地洞就能挖，<strong>隨機獲得</strong>{roomConfig.currency_emoji} {roomConfig.currency_name}</li>
            <li>⏱ 機會用完，或時間到就結束這一輪</li>
          </ul>
          <button
            className="dtg-warn-close"
            onClick={() => { setPhase("idle"); clearInterval(warnTimerRef.current); }}
          >
            我知道了！
          </button>
        </div>
      </div>
    );
  }

  if (phase === "idle") return null;

  // ─── 結果畫面 ─────────────────────────────────────────────────────────
  if (phase === "result") {
    const isSettling = result === null;
    const entries = Object.entries(result || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);
    const myRank = entries.findIndex(([n]) => n === name) + 1;
    return (
      <div className="dtg-overlay-result" onClick={dismissResult}>
        <div className="dtg-result" onClick={e => e.stopPropagation()}>
          <h2>⛏️ 挖寶遊戲結束！</h2>
          {isSettling ? (
            <p>正在等待結算結果...</p>
          ) : entries.length > 0 ? (
            <>
              {myRank > 0 && (
                <p className="dtg-my-rank">
                  你排第 <strong>{myRank}</strong> 名，共挖到{" "}
                  <strong style={{ color: "#ffd166" }}>{myTotal}</strong> 個{roomConfig.currency_name}
                </p>
              )}
              <ul>
                {entries.map(([uname, amount], idx) => (
                  <li key={uname} className={uname === name ? "me" : ""}>
                    {idx + 1}. {uname}：{amount} 個{roomConfig.currency_name}{uname === name ? " 🎉" : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>本次沒有人挖到寶…</p>
          )}
          <p className="dtg-dismiss-hint">點擊任意處關閉</p>
        </div>
      </div>
    );
  }

  // ─── 遊戲進行中畫面 ───────────────────────────────────────────────────
  return (
    <div className="dtg-overlay">
      {/* 上方 HUD */}
      <div className="dtg-hud">
        <span className="dtg-timer">{timeLeft}</span>
        <span className="dtg-timer-unit">秒</span>
        <span className="dtg-score">剩餘 {digsLeft} / {maxDigs} 次</span>
        <span className="dtg-hint">每次隨機獲得 {rewardMin}~{rewardMax} 個{roomConfig.currency_name}</span>
        <span className="dtg-hint">已挖到 {myTotal} 個{roomConfig.currency_name}</span>
      </div>

      {/* 遊戲場地（15 個地洞） */}
      <div className="dtg-field">
        <div className="dtg-holes-grid">
          {holes.map((hole, i) => {
            const disabled = hole.dug || hole.pending || digsLeft <= 0;
            return (
              <button
                key={i}
                type="button"
                className={`dtg-hole-cell${hole.dug ? " dug" : ""}${hole.pending ? " pending" : ""}${digsLeft <= 0 && !hole.dug ? " locked" : ""}`}
                onClick={() => handleDigHole(i)}
                disabled={disabled}
              >
                {hole.dug ? (
                  <span className="dtg-hole-reward">+{hole.reward}<br />{roomConfig.currency_emoji}</span>
                ) : hole.pending ? (
                  <span className="dtg-hole-pending">…</span>
                ) : (
                  <span className="dtg-hole-icon">⛏️</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
