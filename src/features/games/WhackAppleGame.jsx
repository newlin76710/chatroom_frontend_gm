// WhackAppleGame.jsx — 打金蘋果遊戲（打地鼠風格）
// Socket events:
//   in:  whackGameStart { duration, reward }
//   in:  whackGameEnd   { scores: { [name]: count } }
//   out: catchWhackApple { token }
import { useState, useEffect, useRef, useCallback } from "react";
import "./WhackAppleGame.css";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";

const HOLE_COUNT = 9; // 3×3 grid

function rand(min, max) { return min + Math.random() * (max - min); }

// ─── 主元件 ──────────────────────────────────────────────────────────────────
export default function WhackAppleGame({ socket, token, name, setApples }) {
  const [phase, setPhase]         = useState("idle"); // idle | playing | result
  const [warnVisible, setWarnVisible] = useState(false); // 30秒預告
  const [warnSeconds, setWarnSeconds] = useState(30);
  const [timeLeft, setTimeLeft]   = useState(0);
  const [reward, setReward]       = useState(1);
  const [holes, setHoles]         = useState(() =>
    Array.from({ length: HOLE_COUNT }, () => ({ up: false, whacked: false }))
  );
  const [myScore, setMyScore]     = useState(0);
  const [combo, setCombo]         = useState(0);
  const [hitEffects, setHitEffects] = useState([]); // [{ id, x, y }]
  const [result, setResult]       = useState(null);  // { [name]: count }

  const [hammerPos, setHammerPos]           = useState({ x: -200, y: -200 });
  const [hammerSwinging, setHammerSwinging] = useState(false);

  // ── refs ──────────────────────────────────────────────────────────────────
  const phaseRef    = useRef("idle");
  const timerRef    = useRef(null);
  const warnTimerRef = useRef(null); // 說明彈窗倒數計時器
  const inputLockedRef = useRef(true);
  const holeTimers  = useRef([]);
  const myScoreRef  = useRef(0);
  const comboRef    = useRef(0);
  const comboTimer  = useRef(null);
  const hitIdRef           = useRef(0);
  const upCountRef         = useRef(0);   // 目前彈出中的蘋果數
  const activePointerRef   = useRef(null); // 多點觸控保護：同時只允許一個 pointer
  const lastWhackTimeRef   = useRef(0);   // 連點冷卻
  const WHACK_COOLDOWN_MS  = 250;         // 打完後冷卻時間（ms）
  const maxConcurrentRef   = useRef(4);   // 目前上限（隨難度遞增）
  const initConcurrentRef  = useRef(4);   // 開場同時蘋果數（from server）
  const finalConcurrentRef = useRef(7);   // 最高同時蘋果數（from server）
  const appleMsLoRef       = useRef(350); // 蘋果最短可見 ms（from server）
  const appleMsHiRef       = useRef(700); // 蘋果最長可見 ms（from server）
  // Ref-based hole state — authoritative for collision detection; avoids stale closures
  const holeStateRef = useRef(
    Array.from({ length: HOLE_COUNT }, () => ({ up: false, whacked: false }))
  );
  const holeRefs = useRef([]); // DOM refs for each wag-hole-wrap

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

  // ─── Helpers ──────────────────────────────────────────────────────────────
  // Sync ref + React state atomically
  const setHoleState = useCallback((updater) => {
    holeStateRef.current = updater(holeStateRef.current);
    setHoles([...holeStateRef.current]);
  }, []);

  const resetHoles = useCallback(() => {
    holeStateRef.current = Array.from({ length: HOLE_COUNT }, () => ({ up: false, whacked: false }));
    setHoles([...holeStateRef.current]);
  }, []);

  const clearHoleTimers = useCallback(() => {
    holeTimers.current.forEach(clearTimeout);
    holeTimers.current = [];
  }, []);

  // ─── 集中調度（控制同時出現上限） ────────────────────────────────────────
  // 所有 deps 皆透過 ref 存取 → stable callback，safe for recursive call
  const scheduleNextHole = useCallback((delay = rand(300, 700)) => {
    if (phaseRef.current !== "playing") return;
    if (upCountRef.current >= maxConcurrentRef.current) return;

    const t = setTimeout(() => {
      if (phaseRef.current !== "playing") return;
      if (upCountRef.current >= maxConcurrentRef.current) return;

      // 找出所有目前沒有彈出的洞，隨機選一個
      const idleIndices = holeStateRef.current
        .map((h, i) => i)
        .filter(i => !holeStateRef.current[i].up);
      if (idleIndices.length === 0) return;

      const i = idleIndices[Math.floor(Math.random() * idleIndices.length)];
      upCountRef.current++;

      holeStateRef.current = holeStateRef.current.map((h, idx) =>
        idx === i ? { up: true, whacked: false } : h
      );
      setHoles([...holeStateRef.current]);

      // 停留一段時間後自動縮回（若未被打到）
      const upDuration = rand(appleMsLoRef.current, appleMsHiRef.current);
      const t2 = setTimeout(() => {
        if (phaseRef.current !== "playing") return;
        const h = holeStateRef.current[i];
        if (h.up && !h.whacked) {
          upCountRef.current = Math.max(0, upCountRef.current - 1);
          holeStateRef.current = holeStateRef.current.map((hole, idx) =>
            idx === i ? { up: false, whacked: false } : hole
          );
          setHoles([...holeStateRef.current]);
          scheduleNextHole(rand(100, 350));
        }
      }, upDuration);

      holeTimers.current.push(t2);
    }, delay);

    holeTimers.current.push(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startHoles = useCallback(() => {
    clearHoleTimers();
    resetHoles();
    upCountRef.current = 0;

    const initN  = initConcurrentRef.current;
    const finalN = finalConcurrentRef.current;
    const midN   = Math.round((initN + finalN) / 2);
    maxConcurrentRef.current = initN;

    // 開始時錯開啟動
    for (let k = 0; k < initN; k++) {
      scheduleNextHole(rand(k * 120, k * 120 + 250));
    }

    // 10 秒後升至中間值
    const ramp1 = setTimeout(() => {
      if (phaseRef.current === "playing" && midN > initN) {
        maxConcurrentRef.current = midN;
        for (let k = 0; k < midN - initN; k++) scheduleNextHole(rand(50 + k * 100, 200 + k * 100));
      }
    }, 10000);

    // 20 秒後升至最高值
    const ramp2 = setTimeout(() => {
      if (phaseRef.current === "playing" && finalN > midN) {
        maxConcurrentRef.current = finalN;
        for (let k = 0; k < finalN - midN; k++) scheduleNextHole(rand(50 + k * 80, 200 + k * 80));
      }
    }, 20000);

    holeTimers.current.push(ramp1, ramp2);
  }, [clearHoleTimers, resetHoles, scheduleNextHole]);

  const stopHoles = useCallback(() => {
    clearHoleTimers();
    resetHoles();
  }, [clearHoleTimers, resetHoles]);

  // ─── Socket events ────────────────────────────────────────────────────────
  useEffect(() => {
    const onWarn = ({ secondsLeft }) => {
      setWarnVisible(true);
      setWarnSeconds(secondsLeft || 30);
      clearInterval(warnTimerRef.current);
      let s = secondsLeft || 30;
      warnTimerRef.current = setInterval(() => {
        s -= 1;
        setWarnSeconds(s);
        if (s <= 0) clearInterval(warnTimerRef.current);
      }, 1000);
    };

    const onStart = ({ duration, reward: r, msLo, msHi, minApples, maxApples }) => {
      inputLockedRef.current = false;
      clearInterval(warnTimerRef.current);
      setWarnVisible(false);
      setReward(r ?? 1);
      setMyScore(0); myScoreRef.current = 0;
      setCombo(0);   comboRef.current   = 0;
      setResult(null);
      setHitEffects([]);
      activePointerRef.current = null;
      lastWhackTimeRef.current = 0;
      setHammerPos({ x: -200, y: -200 });
      setHammerSwinging(false);
      if (msLo       !== undefined) appleMsLoRef.current       = msLo;
      if (msHi       !== undefined) appleMsHiRef.current       = msHi;
      if (minApples  !== undefined) initConcurrentRef.current  = minApples;
      if (maxApples  !== undefined) finalConcurrentRef.current = maxApples;
      phaseRef.current = "playing";
      setPhase("playing");

      clearInterval(timerRef.current);
      let left = duration;
      setTimeLeft(left);
      timerRef.current = setInterval(() => {
        left--;
        setTimeLeft(left);
        if (left <= 0) clearInterval(timerRef.current);
      }, 1000);

      startHoles();
    };

    const onEnd = ({ scores }) => {
      inputLockedRef.current = true;
      clearInterval(timerRef.current);
      stopHoles();
      activePointerRef.current = null;
      setHammerSwinging(false);
      setResult(scores || {});
      phaseRef.current = "result";
      setPhase("result");
      if (scores?.[name] && typeof setApples === "function") {
        setApples(prev => prev + scores[name]);
        setTimeout(() => { refreshMyApples(); }, 300);
      }
    };

    socket.on("whackGameWarn",  onWarn);
    socket.on("whackGameStart", onStart);
    socket.on("whackGameEnd",   onEnd);
    return () => {
      socket.off("whackGameWarn",  onWarn);
      socket.off("whackGameStart", onStart);
      socket.off("whackGameEnd",   onEnd);
    };
  }, [socket, name, setApples, startHoles, stopHoles, refreshMyApples]);

  // Cleanup on unmount
  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(warnTimerRef.current);
    clearHoleTimers();
    clearTimeout(comboTimer.current);
  }, [clearHoleTimers]);

  // ─── Whack! ───────────────────────────────────────────────────────────────
  const handlePointerRelease = useCallback((e) => {
    if (activePointerRef.current === e.pointerId) {
      activePointerRef.current = null;
    }
  }, []);

  const handleHammerMove = useCallback((e) => {
    if (inputLockedRef.current) return;
    if (phaseRef.current !== "playing") return;
    setHammerPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleHammerStrike = useCallback((e) => {
    if (inputLockedRef.current) return;
    if (phaseRef.current !== "playing") return;
    if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) return;

    const now = Date.now();
    if (now - lastWhackTimeRef.current < WHACK_COOLDOWN_MS) return;

    const STRIKE_RADIUS = 80;
    let bestIdx = -1;
    let bestDist = Infinity;

    holeRefs.current.forEach((el, i) => {
      if (!el) return;
      const h = holeStateRef.current[i];
      if (!h.up || h.whacked) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      if (dist <= STRIKE_RADIUS && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    });

    // Always animate swing
    setHammerSwinging(true);
    setTimeout(() => setHammerSwinging(false), 280);

    if (bestIdx < 0) return; // missed

    activePointerRef.current = e.pointerId;
    lastWhackTimeRef.current = now;

    holeStateRef.current = holeStateRef.current.map((hole, idx) =>
      idx === bestIdx ? { up: true, whacked: true } : hole
    );
    setHoles([...holeStateRef.current]);

    myScoreRef.current++;
    setMyScore(myScoreRef.current);

    comboRef.current++;
    setCombo(comboRef.current);
    clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
    }, 1500);

    const rect2 = holeRefs.current[bestIdx]?.getBoundingClientRect();
    const fx_x = rect2 ? rect2.left + rect2.width / 2 : e.clientX;
    const fx_y = rect2 ? rect2.top : e.clientY;
    const id = ++hitIdRef.current;
    setHitEffects(fx => [...fx, { id, x: fx_x, y: fx_y }]);
    setTimeout(() => setHitEffects(fx => fx.filter(f => f.id !== id)), 700);

    socket.emit("catchWhackApple", { token });

    setTimeout(() => {
      holeStateRef.current = holeStateRef.current.map((hole, idx) =>
        idx === bestIdx ? { up: false, whacked: false } : hole
      );
      setHoles([...holeStateRef.current]);
      upCountRef.current = Math.max(0, upCountRef.current - 1);
      if (activePointerRef.current !== null) activePointerRef.current = null;
      if (phaseRef.current === "playing") scheduleNextHole(rand(80, 250));
    }, 380);
  }, [socket, token, scheduleNextHole]);

  const dismissResult = useCallback(() => {
    inputLockedRef.current = true;
    setPhase("idle");
    setResult(null);
  }, []);

  // ── 30 秒預告說明彈窗 ──────────────────────────────────────────────────────
  if (phase === "idle" && warnVisible) {
    return (
      <div className="wag-warn-overlay" onClick={() => { setWarnVisible(false); clearInterval(warnTimerRef.current); }}>
        <div className="wag-warn-card" onClick={e => e.stopPropagation()}>
          <div className="wag-warn-countdown">{warnSeconds}</div>
          <div className="wag-warn-unit">秒後開始</div>
          <h2 className="wag-warn-title">🔨 打金蘋果（打地鼠）</h2>
          <ul className="wag-warn-rules">
            <li>🍎 金蘋果會從 <strong>9 個洞</strong>隨機冒出</li>
            <li>🔨 移動<strong>槌子</strong>到金蘋果上方，按下打擊！</li>
            <li>⚡ 連續打中有<strong>Combo</strong>加成！</li>
            <li>⏱ 遊戲進行中蘋果<strong>越來越快</strong>，撐住！</li>
          </ul>
          <button
            className="wag-warn-close"
            onClick={() => { setWarnVisible(false); clearInterval(warnTimerRef.current); }}
          >
            我知道了！
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: idle ─────────────────────────────────────────────────────────
  if (phase === "idle") return null;

  // ─── Render: result ───────────────────────────────────────────────────────
  if (phase === "result") {
    const entries  = Object.entries(result || {}).sort((a, b) => b[1] - a[1]).slice(0, 50);
    const myRank   = entries.findIndex(([n]) => n === name) + 1;
    const myCount  = result?.[name] ?? 0;
    return (
      <div className="wag-overlay" onClick={dismissResult}>
        <div className="wag-result" onClick={e => e.stopPropagation()}>
          <h2>🍎 打金蘋果結束！</h2>
          {entries.length > 0 ? (
            <>
              {myRank > 0 && (
                <p className="wag-my-rank">
                  你排第 <strong>{myRank}</strong> 名，打到{" "}
                  <strong style={{ color: "gold" }}>{myCount}</strong> 顆🍎
                  {myCount > 0 && <span style={{ color: "#7fff7f" }}> 已入帳！</span>}
                </p>
              )}
              <ul>
                {entries.map(([uname, count], idx) => (
                  <li key={uname} className={uname === name ? "me" : ""}>
                    {idx + 1}. {uname}：{count} 顆{uname === name ? " 🎉" : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>本次沒有人打到金蘋果…</p>
          )}
          <p className="wag-dismiss-hint">點擊任意處關閉</p>
        </div>
      </div>
    );
  }

  // ─── Render: playing ──────────────────────────────────────────────────────
  const urgency = timeLeft <= 10 ? "urgent" : timeLeft <= 20 ? "warning" : "";

  return (
    <div className="wag-overlay"
      onPointerMove={handleHammerMove}
      onPointerDown={handleHammerStrike}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      style={{ cursor: "none" }}
    >
      {/* 槌子游標 */}
      <div
        className={`wag-hammer${hammerSwinging ? " swinging" : ""}`}
        style={{ left: hammerPos.x, top: hammerPos.y }}
      >
        🔨
      </div>

      {/* HUD */}
      <div className="wag-hud">
        <span className={`wag-timer ${urgency}`}>{timeLeft}</span>
        <span className="wag-timer-unit">秒</span>
        <span className="wag-score">🍎 ×{myScore}</span>
        <span className="wag-hint">移動槌子打金蘋果！每顆得 {reward} 個🍎</span>
      </div>

      {/* Combo counter */}
      {combo >= 2 && (
        <div key={combo} className={`wag-combo ${combo >= 5 ? "fire" : combo >= 3 ? "hot" : ""}`}>
          {combo >= 7 ? "🔥🔥" : combo >= 5 ? "🔥" : "⚡"} COMBO ×{combo}!
        </div>
      )}

      {/* Floating +1 effects */}
      {hitEffects.map(fx => (
        <div key={fx.id} className="wag-hit-effect" style={{ left: fx.x, top: fx.y }}>
          +1 🍎
        </div>
      ))}

      {/* Game field */}
      <div className="wag-field">
        {/* Stars in background */}
        <div className="wag-stars-bg" aria-hidden="true" />

        <div className="wag-holes-grid">
          {holes.map((hole, i) => (
            <div key={i} className="wag-hole-wrap" ref={el => holeRefs.current[i] = el}>
              {/* Clip area — apple slides up inside this */}
              <div className="wag-mole-area">
                <div
                  className={`wag-apple-slot${hole.up ? " up" : ""}${hole.whacked ? " whacked" : ""}`}
                >
                  <img
                    src="/gifts/gold_apple.gif"
                    className="wag-apple-img"
                    alt="金蘋果"
                    draggable={false}
                  />
                  {hole.whacked && (
                    <div className="wag-whack-fx" aria-hidden="true">
                      {comboRef.current >= 5 ? "💥🌟" : "💥"}
                    </div>
                  )}
                </div>
              </div>
              {/* Oval hole */}
              <div className="wag-hole" />
            </div>
          ))}
        </div>

        {/* Ground strip */}
        <div className="wag-ground" />
      </div>
    </div>
  );
}
