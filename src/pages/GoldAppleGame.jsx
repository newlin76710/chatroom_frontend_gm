// GoldAppleGame.jsx — 撈金蘋果遊戲覆蓋層
// 遊戲一：多顆金蘋果，全場搶，1 分鐘結算
// 遊戲二：一顆大金蘋果，第一個點到獲得全部獎勵
import { useState, useEffect, useRef, useCallback } from "react";
import "./GoldAppleGame.css";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";

// ─── 常數 ─────────────────────────────────────────────────────────────────────
const SIZE1 = 56;   // px — 遊戲一蘋果尺寸（平板放大後以最大值計算邊界）
const SIZE2 = 100;  // px — 遊戲二蘋果尺寸（放大後視覺更清楚）
const SPD_LO = 5;   // 遊戲一最低速度（像素/幀 @60fps）
const SPD_HI = 9;   // 遊戲一最高速度
const SPD2_LO = 40;  // 遊戲二最低速度（放慢，避免殘像）
const SPD2_HI = 60;  // 遊戲二最高速度

function randSpd(lo = SPD_LO, hi = SPD_HI) {
  const s = lo + Math.random() * (hi - lo);
  const a = Math.random() * Math.PI * 2;
  return { vx: Math.cos(a) * s, vy: Math.sin(a) * s };
}

// 反彈後旋轉速度向量 ±angle 度，讓軌跡不規則
function jitterBounce(p, angleDeg = 20) {
  const a = (Math.random() - 0.5) * (angleDeg * Math.PI / 180);
  const cos = Math.cos(a), sin = Math.sin(a);
  const vx = p.vx * cos - p.vy * sin;
  const vy = p.vx * sin + p.vy * cos;
  p.vx = vx;
  p.vy = vy;
}

function randPos(W, H, size) {
  return {
    x: size + Math.random() * (W - size * 2),
    y: size + Math.random() * (H - size * 2),
  };
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────
export default function GoldAppleGame({ socket, token, name, setApples }) {
  // ── 遊戲階段: idle | game1 | game2 | result1 | result2
  const [phase, setPhase] = useState("idle");

  // ── 30 秒預告
  const [warnType, setWarnType] = useState(null); // null | 'game1' | 'game2'
  const [warnSeconds, setWarnSeconds] = useState(30);

  // ── 遊戲一
  const [g1AppleIds, setG1AppleIds] = useState([]); // React 控制 DOM 渲染
  const [g1Reward, setG1Reward] = useState(1);
  const [g1CatchLimit, setG1CatchLimit] = useState(0);
  const [g1CaughtCount, setG1CaughtCount] = useState(0);
  const [g1Result, setG1Result] = useState(null); // catches map 結束時

  // ── 遊戲二
  const [g2Reward, setG2Reward] = useState(25);
  const [g2Result, setG2Result] = useState(null); // { winner, reward }

  // ── 共用
  const [timeLeft, setTimeLeft] = useState(0);
  const [lateMsg, setLateMsg] = useState("");

  // ── Refs（避免 re-render）
  const containerRef = useRef(null);
  const physicsRef = useRef({});         // id → { id, x, y, vx, vy }
  const domRefs = useRef({});         // id → DOM element（遊戲一）
  const localCaughtRef = useRef(new Set()); // 已在本地點過的蘋果 ID（防重複點擊）
  const apple2WrapRef = useRef(null);       // 遊戲二蘋果的包裝 div
  const apple2Physics = useRef({ x: 200, y: 200, vx: 7, vy: 6 });
  // 速度設定（從 server 取得，預設值僅在 server 未送時使用）
  const g1SpdRef = useRef({ lo: SPD_LO,  hi: SPD_HI  });
  const g2SpdRef = useRef({ lo: SPD2_LO, hi: SPD2_HI });
  const animRef = useRef(null);
  const timerRef = useRef(null);
  const warnTimerRef = useRef(null); // 說明彈窗倒數計時器
  const phaseRef = useRef("idle");
  const inputLockedRef = useRef(true);
  const activePointerRef = useRef(null); // 多點觸控保護：同時只允許一個 pointer
  const lastCatchTimeRef = useRef(0);   // 連點冷卻：避免快速連續點擊搶多顆
  const CATCH_COOLDOWN_MS = 400;        // 每次撈蘋果後冷卻時間（ms）
  // 快取容器尺寸，避免每幀 layout thrashing
  const sizeRef = useRef({ W: window.innerWidth, H: window.innerHeight });
  const [netPos, setNetPos]           = useState({ x: -300, y: -300 });
  const [netScooping, setNetScooping] = useState(false);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const refreshMyApples = useCallback(async () => {
    if (!token || typeof setApples !== "function") return;
    try {
      const res = await fetch(`${BACKEND}/auth/me`, {
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

  // 容器尺寸只在 resize 時更新
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      sizeRef.current = { W: width, H: height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]); // phase 改變時容器可能重新 mount

  // ─── 動畫迴圈 ──────────────────────────────────────────────────────────────
  const startAnim = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);

    function loop() {
      if (!containerRef.current) {
        // container 尚未掛載，下一幀再試（不可直接 return 否則迴圈永久停止）
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const { W, H } = sizeRef.current;

      if (phaseRef.current === "game1") {
        // 更新所有蘋果位置
        for (const p of Object.values(physicsRef.current)) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx); }
          if (p.x > W - SIZE1) { p.x = W - SIZE1; p.vx = -Math.abs(p.vx); }
          if (p.y < 0) { p.y = 0; p.vy = Math.abs(p.vy); }
          if (p.y > H - SIZE1) { p.y = H - SIZE1; p.vy = -Math.abs(p.vy); }
          const dom = domRefs.current[p.id];
          if (dom) dom.style.transform = `translate(${p.x}px, ${p.y}px)`;
        }

      } else if (phaseRef.current === "game2") {
        const p = apple2Physics.current;
        p.x += p.vx;
        p.y += p.vy;
        let bounced = false;
        if (p.x < 0)         { p.x = 0;         p.vx =  Math.abs(p.vx); bounced = true; }
        if (p.x > W - SIZE2) { p.x = W - SIZE2; p.vx = -Math.abs(p.vx); bounced = true; }
        if (p.y < 0)         { p.y = 0;         p.vy =  Math.abs(p.vy); bounced = true; }
        if (p.y > H - SIZE2) { p.y = H - SIZE2; p.vy = -Math.abs(p.vy); bounced = true; }
        if (bounced) jitterBounce(p, 25);
        if (apple2WrapRef.current) {
          apple2WrapRef.current.style.transform = `translate(${p.x}px, ${p.y}px)`;
        }
      }

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
  }, []);

  const stopAnim = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }, []);

  // ─── 倒計時 ────────────────────────────────────────────────────────────────
  const startTimer = useCallback((secs) => {
    clearInterval(timerRef.current);
    setTimeLeft(secs);
    let left = secs;
    timerRef.current = setInterval(() => {
      left--;
      setTimeLeft(left);
      if (left <= 0) clearInterval(timerRef.current);
    }, 1000);
  }, []);

  // ─── Socket 事件 ──────────────────────────────────────────────────────────
  useEffect(() => {
    // ── 30 秒預告 ──
    const startWarnCountdown = (type, secondsLeft) => {
      setWarnType(type);
      setWarnSeconds(secondsLeft || 30);
      clearInterval(warnTimerRef.current);
      let s = secondsLeft || 30;
      warnTimerRef.current = setInterval(() => {
        s -= 1;
        setWarnSeconds(s);
        if (s <= 0) clearInterval(warnTimerRef.current);
      }, 1000);
    };
    const onGame1Warn = ({ secondsLeft }) => startWarnCountdown('game1', secondsLeft);
    const onGame2Warn = ({ secondsLeft }) => startWarnCountdown('game2', secondsLeft);

    // ── 遊戲一開始 ──
    const onG1Start = ({ duration, appleIds, reward, speedLo, speedHi, maxCatchPerUser, appleCount }) => {
      inputLockedRef.current = false;
      clearInterval(warnTimerRef.current);
      setWarnType(null);
      setG1Reward(reward);
      setG1CatchLimit(Number(maxCatchPerUser || appleCount || appleIds?.length || 0));
      setG1CaughtCount(0);
      setG1Result(null);
      setLateMsg("");
      if (speedLo !== undefined) g1SpdRef.current = { lo: speedLo, hi: speedHi };

      // 清除上場記錄
      localCaughtRef.current.clear();
      activePointerRef.current = null;
      lastCatchTimeRef.current = 0;
      setNetPos({ x: -300, y: -300 });
      setNetScooping(false);

      const W = window.innerWidth;
      const H = window.innerHeight;
      physicsRef.current = {};
      appleIds.forEach(id => {
        const { x, y } = randPos(W, H, SIZE1);
        physicsRef.current[id] = { id, ...randSpd(g1SpdRef.current.lo, g1SpdRef.current.hi), x, y };
      });

      setG1AppleIds(appleIds);
      setPhase("game1");
      startTimer(duration);
      startAnim();
    };

    // ── 遊戲一有人撈到（server 確認）──
    const onG1End = () => {
      inputLockedRef.current = true;
      stopAnim();
      clearInterval(timerRef.current);
      activePointerRef.current = null;
      setNetScooping(false);
      setG1Result(null);
      socket.emit("submitGoldGame1Result", {
        token,
        caughtIds: Array.from(localCaughtRef.current),
      });
      setG1AppleIds([]);
      physicsRef.current = {};
      domRefs.current = {};
      setPhase("result1");
    };

    const onG1Result = ({ catches }) => {
      setG1Result(catches || {});
      if ((catches?.[name] || 0) > 0) {
        setTimeout(() => { refreshMyApples(); }, 300);
      }
      setG1CaughtCount(0);
      setG1CatchLimit(0);
    };

    // ── 遊戲二開始（不限時，有人搶到才結束）──
    const onG2Start = ({ reward, speedLo, speedHi }) => {
      inputLockedRef.current = false;
      clearInterval(warnTimerRef.current);
      setWarnType(null);
      setG2Reward(reward);
      setG2Result(null);
      setLateMsg("");
      if (speedLo !== undefined) g2SpdRef.current = { lo: speedLo, hi: speedHi };

      const W = window.innerWidth;
      const H = window.innerHeight;
      const { x, y } = randPos(W, H, SIZE2);
      apple2Physics.current = { x, y, ...randSpd(g2SpdRef.current.lo, g2SpdRef.current.hi) };

      setPhase("game2");
      // 不限時，不呼叫 startTimer
      startAnim();
    };

    // ── 遊戲二有人贏 ──
    const onG2Won = ({ winner, reward }) => {
      inputLockedRef.current = true;
      setG2Result({ winner, reward });
      if (winner === name) {
        setTimeout(() => { refreshMyApples(); }, 300);
      }
    };

    // ── 遊戲二慢了 ──
    const onG2Late = ({ winner, secondsLate }) => {
      setLateMsg(`已被 ${winner} 搶先 ${secondsLate} 秒`);
      setTimeout(() => setLateMsg(""), 3500);
    };

    // ── 遊戲二結束 ──
    const onG2End = () => {
      inputLockedRef.current = true;
      stopAnim();
      activePointerRef.current = null;
      setPhase("result2");
    };

    socket.on("goldGame1Warn",   onGame1Warn);
    socket.on("goldGame2Warn",   onGame2Warn);
    socket.on("goldGame1Start", onG1Start);
    socket.on("goldGame1End", onG1End);
    socket.on("goldGame1Result", onG1Result);
    socket.on("goldGame2Start", onG2Start);
    socket.on("goldGame2Won", onG2Won);
    socket.on("goldGame2Late", onG2Late);
    socket.on("goldGame2End", onG2End);

    return () => {
      socket.off("goldGame1Warn",   onGame1Warn);
      socket.off("goldGame2Warn",   onGame2Warn);
      socket.off("goldGame1Start", onG1Start);
      socket.off("goldGame1End", onG1End);
      socket.off("goldGame1Result", onG1Result);
      socket.off("goldGame2Start", onG2Start);
      socket.off("goldGame2Won", onG2Won);
      socket.off("goldGame2Late", onG2Late);
      socket.off("goldGame2End", onG2End);
    };
  }, [socket, name, token, setApples, startAnim, stopAnim, startTimer, refreshMyApples]);

  // ─── 離開時清理 ───────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopAnim();
      clearInterval(timerRef.current);
      clearInterval(warnTimerRef.current);
    };
  }, [stopAnim]);

  // ─── 撈蘋果動作 ───────────────────────────────────────────────────────────
  const handleNetCast = useCallback((e) => {
    if (inputLockedRef.current) return;
    if (phaseRef.current !== "game1") return;
    if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) return;
    const now = Date.now();
    if (now - lastCatchTimeRef.current < CATCH_COOLDOWN_MS) return;

    activePointerRef.current = e.pointerId;
    setNetPos({ x: e.clientX, y: e.clientY });

    const NET_RADIUS = 55; // px — matches the net SVG visual size
    let bestId = null;
    let bestDist = Infinity;

    for (const p of Object.values(physicsRef.current)) {
      if (localCaughtRef.current.has(p.id)) continue;
      const cx = p.x + SIZE1 / 2;
      const cy = p.y + SIZE1 / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist <= NET_RADIUS && dist < bestDist) {
        bestDist = dist;
        bestId = p.id;
      }
    }

    setNetScooping(true);
    setTimeout(() => setNetScooping(false), 420);

    if (!bestId) return;

    lastCatchTimeRef.current = now;
    localCaughtRef.current.add(bestId);
    delete physicsRef.current[bestId];
    setG1CaughtCount(prev => {
      const next = prev + 1;
      return g1CatchLimit ? Math.min(next, g1CatchLimit) : next;
    });
    setG1AppleIds(prev => prev.filter(id => id !== bestId));
  }, [g1CatchLimit]);

  const handlePointerMove = useCallback((e) => {
    if (inputLockedRef.current) return;
    if (phaseRef.current !== "game1") return;
    setNetPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCatch2 = useCallback((e) => {
    if (inputLockedRef.current) return;
    e.stopPropagation();
    // 多點觸控保護
    if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = e.pointerId;
    socket.emit("catchApple2", { token });
  }, [socket, token]);

  const handlePointerRelease = useCallback((e) => {
    if (activePointerRef.current === e.pointerId) {
      activePointerRef.current = null;
    }
  }, []);

  // 點擊結果卡片可提前關閉
  const dismissResult = useCallback(() => {
    inputLockedRef.current = true;
    setPhase("idle");
    setG1Result(null);
    setG1CaughtCount(0);
    setG1CatchLimit(0);
    setG2Result(null);
    setLateMsg("");
  }, []);

  // ── 30 秒預告說明彈窗 ──────────────────────────────────────────────────────
  if (phase === "idle" && warnType) {
    const isGame1 = warnType === 'game1';
    return (
      <div className="gag-warn-overlay" onClick={() => { setWarnType(null); clearInterval(warnTimerRef.current); }}>
        <div className="gag-warn-card" onClick={e => e.stopPropagation()}>
          <div className="gag-warn-countdown">{warnSeconds}</div>
          <div className="gag-warn-unit">秒後開始</div>
          <h2 className="gag-warn-title">{isGame1 ? '🍎 撈金蘋果' : '🍎 搶大金蘋果'}</h2>
          <ul className="gag-warn-rules">
            {isGame1 ? (
              <>
                <li>🍎 多顆金蘋果在畫面中<strong>飛來飛去</strong></li>
                <li>🕸 將網子<strong>移到金蘋果上方</strong>按下撈起</li>
                <li>👤 每位玩家<strong>各自撈自己的金蘋果</strong></li>
                <li>⏱ 60 秒內<strong>撈越多越好</strong>，上限依當場設定顆數</li>
                <li>🏆 每顆蘋果獲得固定金蘋果獎勵</li>
              </>
            ) : (
              <>
                <li>🍎 一顆<strong>大金蘋果</strong>在畫面中彈跳</li>
                <li>👆 <strong>第一個點到</strong>的人獲得全部獎勵</li>
                <li>⚡ 手速決定勝負，全力搶！</li>
              </>
            )}
          </ul>
          <button
            className="gag-warn-close"
            onClick={() => { setWarnType(null); clearInterval(warnTimerRef.current); }}
          >
            我知道了！
          </button>
        </div>
      </div>
    );
  }

  // ─── 沒有遊戲時不渲染 ────────────────────────────────────────────────────
  if (phase === "idle") return null;

  // ─── 結果畫面 ─────────────────────────────────────────────────────────────
  if (phase === "result1") {
    const isSettling = g1Result === null;
    const entries = Object.entries(g1Result || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);
    return (
      <div className="gag-overlay" onClick={dismissResult}>
        <div className="gag-result" onClick={e => e.stopPropagation()}>
          <h2>🍎 遊戲結束！</h2>
          {isSettling ? (
            <p>正在結算中，請稍候...</p>
          ) : entries.length > 0 ? (
            <>
              <p>本次撈金蘋果得獎名單(前百)：</p>
              <ul>
                {entries.map(([uname, count]) => (
                  <li key={uname} className={uname === name ? "me" : ""}>
                    {uname}：{count} 顆{uname === name ? " 🎉" : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>本次沒有人撈到金蘋果…</p>
          )}
          <p className="gag-dismiss-hint">
            {isSettling ? "點擊任意處可先關閉，結算完成後請看聊天室廣播" : "點擊任意處關閉"}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "result2") {
    const won = g2Result?.winner;
    return (
      <div className="gag-overlay" onClick={dismissResult}>
        <div className="gag-result" onClick={e => e.stopPropagation()}>
          {won ? (
            <>
              <h2>🎉 有人撈到大金蘋果！</h2>
              <p>
                <span className="gag-winner-name">{won}</span>
                {" "}獲得 <strong style={{ color: "gold" }}>{g2Result.reward ?? g2Reward}</strong> 顆金蘋果！
                {won === name && <span style={{ display: "block", marginTop: 8, color: "#7fff7f" }}>恭喜你！</span>}
              </p>
            </>
          ) : (
            <>
              <h2>😢 無人撈到大金蘋果</h2>
              <p>金蘋果趁亂逃走了…</p>
            </>
          )}
          <p className="gag-dismiss-hint">點擊任意處關閉</p>
        </div>
      </div>
    );
  }

  // ─── 遊戲進行中畫面 ───────────────────────────────────────────────────────
  return (
    <div className="gag-overlay" ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerDown={phase === "game1" ? handleNetCast : undefined}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      style={phase === "game1" ? { cursor: "none" } : undefined}
    >

      {/* HUD — 遊戲一顯示倒計時，遊戲二只顯示提示 */}
      <div className="gag-hud">
        {phase === "game1" && (
          <>
            <span className="gag-timer">{timeLeft}</span>
            <span className="gag-timer-unit">秒</span>
            <span className="gag-hint">已撈 {g1CaughtCount} / {g1CatchLimit || g1AppleIds.length} 顆</span>
            <span className="gag-hint">移動網子靠近金蘋果來撈！每顆 {g1Reward} 個🍎</span>
          </>
        )}
        {phase === "game2" && (
          <span className="gag-hint">🔥 搶金蘋果！第一個點到得 {g2Reward} 個🍎！</span>
        )}
      </div>

      {/* 「慢了 N 秒」浮層 */}
      {lateMsg && <div className="gag-late">{lateMsg}</div>}

      {/* 遊戲一：多顆蘋果 */}
      {phase === "game1" && g1AppleIds.map(id => (
        <div
          key={id}
          className="gag-apple-wrap"
          ref={el => {
            if (el) {
              domRefs.current[id] = el;
              // 掛載時立即設定初始位置（參考大金蘋果做法）
              // 不用 style prop，避免 setTimeLeft 重渲染時 React 覆蓋動畫迴圈的 transform
              const initP = physicsRef.current[id];
              if (initP) el.style.transform = `translate(${initP.x}px, ${initP.y}px)`;
            } else {
              delete domRefs.current[id];
            }
          }}
        >
          <img
            src="/gifts/gold_apple.gif"
            className="gag-apple-img"
            alt="金蘋果"
            draggable={false}
          />
        </div>
      ))}

      {/* 遊戲一：撈網游標 */}
      {phase === "game1" && (
        <div
          className={`gag-net${netScooping ? " scooping" : ""}`}
          style={{ left: netPos.x, top: netPos.y }}
        >
          <svg width="100" height="120" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
            <line x1="50" y1="86" x2="62" y2="118" stroke="#6B3A1F" strokeWidth="6" strokeLinecap="round"/>
            <circle cx="50" cy="46" r="42" fill="none" stroke="#8B5E3C" strokeWidth="3"/>
            <clipPath id="gag-nc">
              <circle cx="50" cy="46" r="41"/>
            </clipPath>
            <g clipPath="url(#gag-nc)" stroke="#8B5E3C" strokeWidth="1.2" opacity="0.75">
              <line x1="8" y1="26" x2="92" y2="26"/>
              <line x1="8" y1="36" x2="92" y2="36"/>
              <line x1="8" y1="46" x2="92" y2="46"/>
              <line x1="8" y1="56" x2="92" y2="56"/>
              <line x1="8" y1="66" x2="92" y2="66"/>
              <line x1="8" y1="76" x2="92" y2="76"/>
              <line x1="26" y1="5" x2="26" y2="87"/>
              <line x1="36" y1="5" x2="36" y2="87"/>
              <line x1="46" y1="5" x2="46" y2="87"/>
              <line x1="56" y1="5" x2="56" y2="87"/>
              <line x1="66" y1="5" x2="66" y2="87"/>
              <line x1="76" y1="5" x2="76" y2="87"/>
            </g>
            <circle cx="50" cy="46" r="41" fill="rgba(200,160,80,0.12)"/>
          </svg>
        </div>
      )}

      {/* 遊戲二：一顆大蘋果 */}
      {phase === "game2" && (() => {
        const p = apple2Physics.current;
        return (
          <div
            className="gag-apple-wrap"
            ref={apple2WrapRef}
            onPointerDown={handleCatch2}
            style={p ? { transform: `translate(${p.x}px, ${p.y}px)` } : undefined}
          >
            <img
              src="/gifts/gold_apple.gif"
              className="gag-apple-img big"
              alt="大金蘋果"
              draggable={false}
            />
          </div>
        );
      })()}
    </div>
  );
}
