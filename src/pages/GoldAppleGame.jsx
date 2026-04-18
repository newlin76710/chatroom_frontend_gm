// GoldAppleGame.jsx — 撈金蘋果遊戲覆蓋層
// 遊戲一：多顆金蘋果，全場搶，1 分鐘結算
// 遊戲二：一顆大金蘋果，第一個點到獲得全部獎勵
import { useState, useEffect, useRef, useCallback } from "react";
import "./GoldAppleGame.css";

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
  const activePointerRef = useRef(null); // 多點觸控保護：同時只允許一個 pointer
  // 快取容器尺寸，避免每幀 layout thrashing
  const sizeRef = useRef({ W: window.innerWidth, H: window.innerHeight });
  useEffect(() => { phaseRef.current = phase; }, [phase]);

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
    const onG1Start = ({ duration, appleIds, reward, speedLo, speedHi }) => {
      clearInterval(warnTimerRef.current);
      setWarnType(null);
      setG1Reward(reward);
      setG1Result(null);
      setLateMsg("");
      if (speedLo !== undefined) g1SpdRef.current = { lo: speedLo, hi: speedHi };

      // 清除上場記錄
      localCaughtRef.current.clear();
      activePointerRef.current = null;

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
    const onCaught1 = ({ appleId, newAppleId }) => {
      // 新蘋果物理（先加，避免 React 渲染時 physicsRef 缺項）
      physicsRef.current[newAppleId] = {
        id: newAppleId,
        x: SIZE1 + Math.random() * (window.innerWidth - SIZE1 * 2),
        y: SIZE1 + Math.random() * (window.innerHeight - SIZE1 * 2),
        ...randSpd(g1SpdRef.current.lo, g1SpdRef.current.hi),
      };
      // 明確清除被撈走的蘋果物理資料（ref callback 已不負責清除）
      delete physicsRef.current[appleId];

      setG1AppleIds(prev => {
        const without = prev.filter(id => id !== appleId);
        // 避免重複加入（網路重送保護）
        return without.includes(newAppleId) ? without : [...without, newAppleId];
      });
    };

    // ── 遊戲一結束 ──
    const onG1End = ({ catches }) => {
      stopAnim();
      clearInterval(timerRef.current);
      setG1Result(catches || {});
      setG1AppleIds([]);
      physicsRef.current = {};
      domRefs.current = {};
      setPhase("result1");
    };

    // ── 遊戲二開始（不限時，有人搶到才結束）──
    const onG2Start = ({ reward, speedLo, speedHi }) => {
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
      setG2Result({ winner, reward });
      if (winner === name && typeof setApples === "function") {
        setApples(prev => prev + reward);
      }
    };

    // ── 遊戲二慢了 ──
    const onG2Late = ({ winner, secondsLate }) => {
      setLateMsg(`已被 ${winner} 搶先 ${secondsLate} 秒`);
      setTimeout(() => setLateMsg(""), 3500);
    };

    // ── 遊戲二結束 ──
    const onG2End = () => {
      stopAnim();
      setPhase("result2");
    };

    socket.on("goldGame1Warn",   onGame1Warn);
    socket.on("goldGame2Warn",   onGame2Warn);
    socket.on("goldGame1Start", onG1Start);
    socket.on("goldAppleCaught1", onCaught1);
    socket.on("goldGame1End", onG1End);
    socket.on("goldGame2Start", onG2Start);
    socket.on("goldGame2Won", onG2Won);
    socket.on("goldGame2Late", onG2Late);
    socket.on("goldGame2End", onG2End);

    return () => {
      socket.off("goldGame1Warn",   onGame1Warn);
      socket.off("goldGame2Warn",   onGame2Warn);
      socket.off("goldGame1Start", onG1Start);
      socket.off("goldAppleCaught1", onCaught1);
      socket.off("goldGame1End", onG1End);
      socket.off("goldGame2Start", onG2Start);
      socket.off("goldGame2Won", onG2Won);
      socket.off("goldGame2Late", onG2Late);
      socket.off("goldGame2End", onG2End);
    };
  }, [socket, name, setApples, startAnim, stopAnim, startTimer]);

  // ─── 離開時清理 ───────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopAnim();
      clearInterval(timerRef.current);
      clearInterval(warnTimerRef.current);
    };
  }, [stopAnim]);

  // ─── 撈蘋果動作 ───────────────────────────────────────────────────────────
  const handleCatch1 = useCallback((id, e) => {
    e.stopPropagation();

    // 多點觸控保護：已有其他手指佔用時忽略
    if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = e.pointerId;

    // ① 防止同一顆蘋果在本地被重複點擊
    if (localCaughtRef.current.has(id)) return;
    localCaughtRef.current.add(id);

    // ② 立即從畫面移除（樂觀更新，不等 server 回應）
    delete physicsRef.current[id];
    setG1AppleIds(prev => prev.filter(aid => aid !== id));

    // ③ 通知 server（server 仍有 caught flag + 節流 作為最終防線）
    socket.emit("catchApple1", { token, appleId: id });
  }, [socket, token]);

  const handleCatch2 = useCallback((e) => {
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
    setPhase("idle");
    setG1Result(null);
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
                <li>👆 <strong>點擊金蘋果</strong>即可撈起</li>
                <li>⏱ 60 秒內<strong>撈越多越好</strong></li>
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
    const entries = Object.entries(g1Result || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);
    return (
      <div className="gag-overlay" onClick={dismissResult}>
        <div className="gag-result" onClick={e => e.stopPropagation()}>
          <h2>🍎 遊戲結束！</h2>
          {entries.length > 0 ? (
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
          <p className="gag-dismiss-hint">點擊任意處關閉</p>
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
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
    >

      {/* HUD — 遊戲一顯示倒計時，遊戲二只顯示提示 */}
      <div className="gag-hud">
        {phase === "game1" && (
          <>
            <span className="gag-timer">{timeLeft}</span>
            <span className="gag-timer-unit">秒</span>
            <span className="gag-hint">點擊金蘋果來撈！每顆 {g1Reward} 個🍎</span>
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
          onPointerDown={e => handleCatch1(id, e)}
        >
          <img
            src="/gifts/gold_apple.gif"
            className="gag-apple-img"
            alt="金蘋果"
            draggable={false}
          />
        </div>
      ))}

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
