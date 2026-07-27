// CherryTreeGame.jsx — 櫻桃樹接櫻桃遊戲覆蓋層（new_section 模式專用）
// 大樹上會不斷掉落櫻桃，玩家移動籃子去接，每接到一顆即時提交，時間到統一結算。
// 比照撈金蘋果遊戲一的架構：即時提交撈取，結束後等待伺服器結算結果。
//
// Socket 事件：
//   接收 (in):
//     cherryGameWarn         { secondsLeft }
//     cherryGameStart        { duration, cherryIds, reward, speedLo, speedHi, maxCatchPerUser, cherryCount }
//     cherryGameEnd          (空)
//     cherryGameResult       { catches: { [name]: amount } }
//   發送 (out):
//     caughtCherry           { token, cherryId }
//     submitCherryScore      { token, count }

import { useState, useEffect, useRef, useCallback } from "react";
import "./CherryTreeGame.css";

import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";

const CHERRY_SIZE = 34;
const BASKET_WIDTH = 90;
const BASKET_BOTTOM_OFFSET = 70; // 籃子底部距離螢幕底部
const CATCH_BAND = 28;           // 籃子上緣的接取判定高度
const TREE_Y = 120;               // 櫻桃從樹上掉落的起始高度

export default function CherryTreeGame({ socket, token, name, setApples }) {
  // ── 遊戲階段: idle | playing | result
  const [phase, setPhase] = useState("idle");

  // ── 30 秒預告倒數
  const [warnSeconds, setWarnSeconds] = useState(30);

  // ── 遊戲相關狀態 ────────────────────────────────────────────────────────
  const [visibleCherries, setVisibleCherries] = useState([]); // 畫面上目前顯示的櫻桃 id
  const [reward, setReward] = useState(1);
  const [catchLimit, setCatchLimit] = useState(0);
  const [caughtCount, setCaughtCount] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [basketX, setBasketX] = useState(-200);

  // ── Refs ───────────────────────────────────────────────────────────────
  const containerRef = useRef(null);
  const physicsRef = useRef({});          // id → { id, x, y, vy }
  const domRefs = useRef({});
  const localCaughtRef = useRef(new Set());
  const spdRef = useRef({ lo: 3, hi: 6 });
  const animRef = useRef(null);
  const timerRef = useRef(null);
  const warnTimerRef = useRef(null);
  const spawnTimersRef = useRef([]);
  const phaseRef = useRef("idle");
  const basketXRef = useRef(-200);
  const lastCatchTimeRef = useRef(0);
  const CATCH_COOLDOWN_MS = 120;
  const sizeRef = useRef({ W: window.innerWidth, H: window.innerHeight });
  const tokenRef = useRef(token);
  const catchLimitRef = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { catchLimitRef.current = catchLimit; }, [catchLimit]);

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      sizeRef.current = { W: width, H: height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  const clearSpawnTimers = useCallback(() => {
    spawnTimersRef.current.forEach(t => clearTimeout(t));
    spawnTimersRef.current = [];
  }, []);

  // ─── 動畫迴圈：櫻桃下墜 + 接取判定 ───────────────────────────────────────
  const startAnim = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);

    function loop() {
      if (!containerRef.current || phaseRef.current !== "playing") {
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const { W, H } = sizeRef.current;
      const basketCenterX = basketXRef.current;
      const basketTopY = H - BASKET_BOTTOM_OFFSET;
      const halfBasket = BASKET_WIDTH / 2;

      for (const p of Object.values(physicsRef.current)) {
        p.y += p.vy;
        const dom = domRefs.current[p.id];
        if (dom) dom.style.transform = `translate(${p.x}px, ${p.y}px)`;

        if (localCaughtRef.current.has(p.id)) continue;

        // 接取判定：櫻桃底部進入籃子的接取帶，且水平在籃子範圍內
        if (p.y + CHERRY_SIZE >= basketTopY && p.y <= basketTopY + CATCH_BAND) {
          const cherryCenterX = p.x + CHERRY_SIZE / 2;
          if (Math.abs(cherryCenterX - basketCenterX) <= halfBasket) {
            const now = Date.now();
            if (now - lastCatchTimeRef.current >= CATCH_COOLDOWN_MS) {
              lastCatchTimeRef.current = now;
              localCaughtRef.current.add(p.id);
              delete physicsRef.current[p.id];
              delete domRefs.current[p.id];
              socket.emit("caughtCherry", { token: tokenRef.current, room: RN, cherryId: p.id });
              setCaughtCount(prev => {
                const next = prev + 1;
                return catchLimitRef.current ? Math.min(next, catchLimitRef.current) : next;
              });
              setVisibleCherries(prev => prev.filter(id => id !== p.id));
            }
            continue;
          }
        }

        // 掉出畫面底部：沒接到，移除
        if (p.y > H + CHERRY_SIZE) {
          delete physicsRef.current[p.id];
          delete domRefs.current[p.id];
          setVisibleCherries(prev => prev.filter(id => id !== p.id));
        }
      }

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAnim = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }, []);

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

  // ─── Socket 事件監聽 ──────────────────────────────────────────────────────
  useEffect(() => {
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

    const onStart = ({ duration, cherryIds, reward, speedLo, speedHi, maxCatchPerUser, cherryCount }) => {
      clearInterval(warnTimerRef.current);
      clearSpawnTimers();

      setReward(reward);
      setCatchLimit(Number(maxCatchPerUser || cherryCount || cherryIds?.length || 0));
      setCaughtCount(0);
      setResult(null);
      setSubmitting(false);
      if (speedLo !== undefined) spdRef.current = { lo: speedLo, hi: speedHi };

      localCaughtRef.current.clear();
      physicsRef.current = {};
      domRefs.current = {};
      setVisibleCherries([]);
      setBasketX(window.innerWidth / 2);
      basketXRef.current = window.innerWidth / 2;

      const W = window.innerWidth;
      const treeMinX = W * 0.32;
      const treeMaxX = W * 0.68 - CHERRY_SIZE;
      const totalMs = duration * 1000;
      const ids = cherryIds || [];

      ids.forEach((id, i) => {
        const baseDelay = (totalMs / Math.max(ids.length, 1)) * i;
        const jitter = Math.random() * (totalMs / Math.max(ids.length, 1)) * 0.6;
        const delay = Math.min(baseDelay + jitter, totalMs - 300);
        const t = setTimeout(() => {
          if (phaseRef.current !== "playing") return;
          const x = treeMinX + Math.random() * Math.max(0, treeMaxX - treeMinX);
          const { lo, hi } = spdRef.current;
          const vy = lo + Math.random() * (hi - lo);
          physicsRef.current[id] = { id, x, y: TREE_Y, vy };
          setVisibleCherries(prev => [...prev, id]);
        }, Math.max(0, delay));
        spawnTimersRef.current.push(t);
      });

      setPhase("playing");
      startTimer(duration);
      startAnim();
    };

    const onEnd = () => {
      stopAnim();
      clearInterval(timerRef.current);
      clearSpawnTimers();
      setSubmitting(true);
      // phase 不是 playing 代表這個 client 沒收到本輪的 cherryGameStart（例如斷線重連後才收到 end），
      // localCaughtRef 裡留的是上一輪的舊資料，不能拿來回報，一律回報 0
      const countToSubmit = phaseRef.current === "playing" ? localCaughtRef.current.size : 0;
      socket.emit("submitCherryScore", { token, room: RN, count: countToSubmit });
      physicsRef.current = {};
      domRefs.current = {};
      setVisibleCherries([]);
      setPhase("result");
    };

    const onResult = ({ catches }) => {
      setSubmitting(false);
      setResult(catches || {});
      if ((catches?.[name] || 0) > 0) {
        setTimeout(() => { refreshMyApples(); }, 300);
      }
      setCaughtCount(0);
      setCatchLimit(0);
    };

    socket.on("cherryGameWarn", onWarn);
    socket.on("cherryGameStart", onStart);
    socket.on("cherryGameEnd", onEnd);
    socket.on("cherryGameResult", onResult);

    return () => {
      socket.off("cherryGameWarn", onWarn);
      socket.off("cherryGameStart", onStart);
      socket.off("cherryGameEnd", onEnd);
      socket.off("cherryGameResult", onResult);
    };
  }, [socket, name, token, startAnim, stopAnim, startTimer, refreshMyApples, clearSpawnTimers]);

  useEffect(() => {
    return () => {
      stopAnim();
      clearInterval(timerRef.current);
      clearInterval(warnTimerRef.current);
      clearSpawnTimers();
    };
  }, [stopAnim, clearSpawnTimers]);

  /**
   * 移動籃子（跟隨指針水平位置）
   */
  const handlePointerMove = useCallback((e) => {
    if (phaseRef.current !== "playing") return;
    const { W } = sizeRef.current;
    const half = BASKET_WIDTH / 2;
    const x = Math.max(half, Math.min(W - half, e.clientX));
    basketXRef.current = x;
    setBasketX(x);
  }, []);

  const dismissResult = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setCaughtCount(0);
    setCatchLimit(0);
    setSubmitting(false);
  }, []);

  // ── 30 秒預告說明彈窗 ──────────────────────────────────────────────────
  if (phase === "warn") {
    return (
      <div className="ctg-warn-overlay" onClick={() => { setPhase("idle"); clearInterval(warnTimerRef.current); }}>
        <div className="ctg-warn-card" onClick={e => e.stopPropagation()}>
          <div className="ctg-warn-countdown">{warnSeconds}</div>
          <div className="ctg-warn-unit">秒後開始</div>
          <h2 className="ctg-warn-title">🍒 接櫻桃遊戲</h2>
          <ul className="ctg-warn-rules">
            <li>🌳 大樹上會<strong>不斷掉落櫻桃</strong></li>
            <li>🧺 移動<strong>籃子</strong>去接住掉下來的櫻桃</li>
            <li>👤 每位玩家<strong>各自接自己的櫻桃</strong></li>
            <li>⏱ 時間內<strong>接越多越好</strong></li>
            <li>🏆 每接到一顆獲得 {roomConfig.currency_emoji} {roomConfig.currency_name}獎勵</li>
          </ul>
          <button
            className="ctg-warn-close"
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
    const isSettling = result === null || submitting;
    const entries = Object.entries(result || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);
    return (
      <div className="ctg-overlay" onClick={dismissResult}>
        <div className="ctg-result" onClick={e => e.stopPropagation()}>
          <h2>🍒 遊戲結束！</h2>
          {isSettling ? (
            <>
              <p>正在等待結算結果...</p>
              <p>你接到了 {localCaughtRef.current.size} 顆（最終以伺服器紀錄為準）</p>
            </>
          ) : entries.length > 0 ? (
            <>
              <p>本次接櫻桃得獎名單(前百)：</p>
              <ul>
                {entries.map(([uname, amount]) => (
                  <li key={uname} className={uname === name ? "me" : ""}>
                    {uname}：{amount} 個{roomConfig.currency_name}{uname === name ? " 🎉" : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>本次沒有人接到櫻桃…</p>
          )}
          <p className="ctg-dismiss-hint">點擊任意處關閉</p>
        </div>
      </div>
    );
  }

  // ─── 遊戲進行中畫面 ───────────────────────────────────────────────────
  return (
    <div
      className="ctg-overlay"
      ref={containerRef}
      onPointerMove={handlePointerMove}
      style={{ cursor: "none" }}
    >
      {/* HUD 資訊欄 */}
      <div className="ctg-hud">
        <span className="ctg-timer">{timeLeft}</span>
        <span className="ctg-timer-unit">秒</span>
        <span className="ctg-hint">已接 {caughtCount} / {catchLimit} 顆</span>
        <span className="ctg-hint">每顆 {reward} 個{roomConfig.currency_emoji}</span>
      </div>

      {/* 樹 */}
      <div className="ctg-tree">🌳</div>

      {/* 掉落中的櫻桃 */}
      {visibleCherries.map(id => (
        <div
          key={id}
          className="ctg-cherry-wrap"
          ref={el => {
            if (el) {
              domRefs.current[id] = el;
              const initP = physicsRef.current[id];
              if (initP) el.style.transform = `translate(${initP.x}px, ${initP.y}px)`;
            } else {
              delete domRefs.current[id];
            }
          }}
        >
          🍒
        </div>
      ))}

      {/* 籃子 */}
      <div className="ctg-basket" style={{ left: basketX }}>🧺</div>
    </div>
  );
}
