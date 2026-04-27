// ClawMachineGame.jsx — 夾蘋果機遊戲
// Socket events:
//   in:  clawGameStart  { duration, reward, speed, difficulty }
//   in:  clawDropResult { success, caught }
//   in:  clawGameEnd    { scores: { [name]: count } }
//   out: clawDropClaw   { token, position }   (0–1)
import { useState, useEffect, useRef, useCallback } from "react";
import "./ClawMachineGame.css";

// 基準下爪速度（dropSpeed=100 時的值，已比原版快 1.5 倍）
const BASE_DROP_MS = 600;
const BASE_HOLD_MS = 500;
const BASE_RISE_MS = 533;
const APPLE_IMG = "/gifts/gold_apple.gif";

// 蘋果池（x=中心點%，bot=底部距%，dur/delay=滾動動畫）
// 所有蘋果集中在下半區域（bot: 3–33%），數量越多越重疊堆積。
// x 代表蘋果中心，渲染時 left: calc(x% - 19px) 讓中心對齊 x%。
const FULL_APPLE_INIT = [
  // ── 排 1（貼底） IDs 0-5
  { id: 0,  x: 7,  bot: 4,  dur: 2.4, delay: 0.0 },
  { id: 1,  x: 21, bot: 3,  dur: 2.8, delay: 0.5 },
  { id: 2,  x: 35, bot: 5,  dur: 2.2, delay: 0.9 },
  { id: 3,  x: 49, bot: 4,  dur: 3.1, delay: 0.3 },
  { id: 4,  x: 63, bot: 3,  dur: 2.6, delay: 0.7 },
  { id: 5,  x: 77, bot: 5,  dur: 2.3, delay: 1.1 },
  // ── 排 2 IDs 6-11
  { id: 6,  x: 14, bot: 10, dur: 2.7, delay: 0.4 },
  { id: 7,  x: 28, bot: 9,  dur: 2.5, delay: 0.8 },
  { id: 8,  x: 42, bot: 11, dur: 2.9, delay: 0.1 },
  { id: 9,  x: 56, bot: 10, dur: 2.1, delay: 0.6 },
  { id: 10, x: 70, bot: 9,  dur: 2.6, delay: 1.0 },
  { id: 11, x: 84, bot: 11, dur: 2.4, delay: 0.2 },
  // ── 排 3 IDs 12-17
  { id: 12, x: 7,  bot: 15, dur: 2.5, delay: 0.7 },
  { id: 13, x: 21, bot: 14, dur: 2.3, delay: 0.2 },
  { id: 14, x: 35, bot: 16, dur: 2.8, delay: 1.0 },
  { id: 15, x: 49, bot: 15, dur: 2.2, delay: 0.5 },
  { id: 16, x: 63, bot: 14, dur: 3.0, delay: 0.9 },
  { id: 17, x: 77, bot: 16, dur: 2.6, delay: 0.3 },
  // ── 排 4 IDs 18-23
  { id: 18, x: 14, bot: 20, dur: 2.4, delay: 0.6 },
  { id: 19, x: 28, bot: 19, dur: 2.7, delay: 0.1 },
  { id: 20, x: 42, bot: 21, dur: 2.3, delay: 0.8 },
  { id: 21, x: 56, bot: 20, dur: 2.9, delay: 0.4 },
  { id: 22, x: 70, bot: 19, dur: 2.5, delay: 1.1 },
  { id: 23, x: 84, bot: 21, dur: 2.1, delay: 0.2 },
  // ── 排 5 IDs 24-29
  { id: 24, x: 7,  bot: 25, dur: 2.6, delay: 0.5 },
  { id: 25, x: 21, bot: 24, dur: 2.4, delay: 1.0 },
  { id: 26, x: 35, bot: 26, dur: 2.8, delay: 0.3 },
  { id: 27, x: 49, bot: 25, dur: 2.2, delay: 0.7 },
  { id: 28, x: 63, bot: 24, dur: 3.1, delay: 0.0 },
  { id: 29, x: 77, bot: 26, dur: 2.5, delay: 0.9 },
  // ── 排 6 IDs 30-35
  { id: 30, x: 14, bot: 29, dur: 2.3, delay: 0.4 },
  { id: 31, x: 28, bot: 28, dur: 2.7, delay: 0.8 },
  { id: 32, x: 42, bot: 30, dur: 2.4, delay: 0.1 },
  { id: 33, x: 56, bot: 29, dur: 2.9, delay: 0.6 },
  { id: 34, x: 70, bot: 28, dur: 2.2, delay: 1.1 },
  { id: 35, x: 84, bot: 30, dur: 2.6, delay: 0.3 },
  // ── 排 7（頂堆，4 顆） IDs 36-39
  { id: 36, x: 21, bot: 33, dur: 2.5, delay: 0.9 },
  { id: 37, x: 42, bot: 32, dur: 2.3, delay: 0.2 },
  { id: 38, x: 56, bot: 34, dur: 2.7, delay: 0.7 },
  { id: 39, x: 77, bot: 33, dur: 2.4, delay: 0.4 },
];

export default function ClawMachineGame({ socket, token, name, setApples }) {
  const [phase,        setPhase]        = useState("idle");
  const [warnVisible,  setWarnVisible]  = useState(false); // 30秒預告說明彈窗
  const [warnSeconds,  setWarnSeconds]  = useState(30);    // 說明彈窗倒數
  // appleList: [{ id, x, dur, delay, posIdx, isCaught }]
  // posIdx 決定 bot 高度（FULL_APPLE_INIT[posIdx].bot），夾走後上方蘋果 posIdx-- 往下補位
  const [appleList,    setAppleList]    = useState([]);
  const [timeLeft,     setTimeLeft]     = useState(0);
  const [reward,       setReward]       = useState(1);
  const [myScore,      setMyScore]      = useState(0);
  const [result,       setResult]       = useState(null);
  const [clawX,        setClawX]        = useState(50);  // 12–88 %
  const [clawY,        setClawY]        = useState(0);   // 0=頂 1=最低
  const [prongsOpen,   setProngsOpen]   = useState(true);
  const [hasCatch,     setHasCatch]     = useState(false);
  const [dropping,     setDropping]     = useState(false);
  const [effects,      setEffects]      = useState([]);

  // ── refs ──────────────────────────────────────────────────────────────────────
  const phaseRef        = useRef("idle");
  const clawXRef        = useRef(50);
  const dirRef          = useRef(1);
  const speedRef        = useRef(0.5);
  const dropSpeedRef    = useRef(100);  // 50–300，影響下爪動畫時長
  const droppingRef     = useRef(false);
  const myScoreRef      = useRef(0);
  const rewardRef       = useRef(1);
  const timerRef        = useRef(null);
  const closeTimerRef   = useRef(null);  // closing → result 延遲計時器
  const warnTimerRef    = useRef(null);  // 說明彈窗倒數計時器
  const inputLockedRef  = useRef(true);
  const slideTimerRef   = useRef(null);  // 補位動畫延遲計時器
  const appleListRef    = useRef([]);    // appleList 的 ref 鏡像（給 RAF 讀）
  const oscAnimRef      = useRef(null);
  const dropAnimRef     = useRef(null);
  const catchResultRef  = useRef(null);
  const effectIdRef     = useRef(0);
  const windowRef       = useRef(null);

  useEffect(() => { phaseRef.current  = phase;  }, [phase]);
  useEffect(() => { rewardRef.current = reward; }, [reward]);

  // ── 重置蘋果堆 ────────────────────────────────────────────────────────────────
  const resetApples = useCallback(() => {
    appleListRef.current = [];
    setAppleList([]);
  }, []);

  // ── 找最近的未被夾蘋果（比較中心點 x，從 ref 讀取避免 stale closure） ──────
  const findNearestApple = useCallback(() => {
    const cx = clawXRef.current;
    let best = null, bestDist = Infinity;
    for (const a of appleListRef.current) {
      if (a.isCaught) continue;
      const dist = Math.abs(a.x - cx);
      if (dist < bestDist) { bestDist = dist; best = a; }
    }
    return best;
  }, []);

  // ── 搖擺 ──────────────────────────────────────────────────────────────────────
  const stopOscillation = useCallback(() => {
    if (oscAnimRef.current) cancelAnimationFrame(oscAnimRef.current);
  }, []);

  const startOscillation = useCallback(() => {
    const tick = () => {
      if (phaseRef.current !== "playing" || droppingRef.current) return;
      clawXRef.current += dirRef.current * speedRef.current;
      if (clawXRef.current >= 88) { clawXRef.current = 88; dirRef.current = -1; }
      if (clawXRef.current <= 12) { clawXRef.current = 12; dirRef.current =  1; }
      setClawX(clawXRef.current);
      oscAnimRef.current = requestAnimationFrame(tick);
    };
    oscAnimRef.current = requestAnimationFrame(tick);
  }, []);

  // ── 下爪動畫（JS RAF 控制，讓爪子位置和蘋果消失時序精確對齊） ─────────────────
  const runDropAnimation = useCallback(() => {
    const start      = performance.now();
    const windowEl   = windowRef.current;
    const maxExtend  = Math.max(140, (windowEl?.clientHeight ?? 300) - 80);
    if (windowEl) windowEl.style.setProperty("--clw-max-extend", `${maxExtend}px`);

    // 依 dropSpeed 計算本次動畫時長
    const ds      = dropSpeedRef.current;
    const DROP_MS = Math.round(BASE_DROP_MS * 100 / ds);
    const HOLD_MS = Math.max(400, Math.round(BASE_HOLD_MS * 100 / ds));
    const RISE_MS = Math.round(BASE_RISE_MS * 100 / ds);

    let resultApplied = false;

    const tick = (now) => {
      const t = now - start;

      if (t < DROP_MS) {
        // ─── 下降
        setClawY(t / DROP_MS);
        dropAnimRef.current = requestAnimationFrame(tick);

      } else if (t < DROP_MS + HOLD_MS) {
        // ─── 停在底部，等 server 結果
        setClawY(1);

        if (!resultApplied && t > DROP_MS + 230 && catchResultRef.current !== null) {
          resultApplied = true;
          const { success } = catchResultRef.current;
          setProngsOpen(false); // 爪子夾合

          if (success) {
            // 找最近蘋果，標記消失並啟動補位
            const apple = findNearestApple();
            if (apple) {
              // 立即標記 caught（ref + state 同步）
              const withCaught = appleListRef.current.map(a =>
                a.id === apple.id ? { ...a, isCaught: true } : a
              );
              appleListRef.current = withCaught;
              setAppleList([...withCaught]);

              // 消失動畫結束後移除並補位
              clearTimeout(slideTimerRef.current);
              slideTimerRef.current = setTimeout(() => {
                const caughtPosIdx = apple.posIdx;
                const next = appleListRef.current
                  .filter(a => !a.isCaught)
                  .map(a => a.posIdx > caughtPosIdx
                    ? { ...a, posIdx: a.posIdx - 1 }
                    : a
                  );
                appleListRef.current = next;
                setAppleList([...next]);
              }, 450);
            }
            setHasCatch(true); // 爪子上顯示金蘋果
          }
        }
        dropAnimRef.current = requestAnimationFrame(tick);

      } else if (t < DROP_MS + HOLD_MS + RISE_MS) {
        // ─── 上升
        setClawY(1 - (t - DROP_MS - HOLD_MS) / RISE_MS);
        dropAnimRef.current = requestAnimationFrame(tick);

      } else {
        // ─── 完成
        setClawY(0);
        setProngsOpen(true);
        setHasCatch(false);

        const res = catchResultRef.current;
        if (res?.success) {
          const earned = res.earned ?? rewardRef.current;
          myScoreRef.current += earned;
          setMyScore(myScoreRef.current);
          setApples(prev => prev + earned);
          const id = effectIdRef.current++;
          setEffects(prev => [...prev, { id, earned }]);
          setTimeout(() => setEffects(prev => prev.filter(e => e.id !== id)), 1400);
        }

        catchResultRef.current = null;
        droppingRef.current    = false;
        setDropping(false);
        if (phaseRef.current === "playing") startOscillation();
      }
    };

    dropAnimRef.current = requestAnimationFrame(tick);
  }, [setApples, startOscillation, findNearestApple]);

  // ── Socket ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onWarn = ({ secondsLeft }) => {
      setWarnSeconds(secondsLeft || 30);
      setWarnVisible(true);
      clearInterval(warnTimerRef.current);
      let s = secondsLeft || 30;
      warnTimerRef.current = setInterval(() => {
        s -= 1;
        setWarnSeconds(s);
        if (s <= 0) clearInterval(warnTimerRef.current);
      }, 1000);
    };

    const onStart = ({ duration, reward: r, speed, dropSpeed, appleCount }) => {
      inputLockedRef.current = false;
      // 遊戲開始，關閉說明彈窗
      clearInterval(warnTimerRef.current);
      setWarnVisible(false);

      clearInterval(timerRef.current);
      stopOscillation();
      if (dropAnimRef.current) cancelAnimationFrame(dropAnimRef.current);

      // 設定本局蘋果（新形狀：{ id, x, dur, delay, posIdx, isCaught }）
      const count = Math.max(1, Math.min(appleCount ?? 12, FULL_APPLE_INIT.length));
      const activeApples = FULL_APPLE_INIT.slice(0, count).map((a, i) => ({
        id: a.id, x: a.x, dur: a.dur, delay: a.delay,
        posIdx: i, isCaught: false,
      }));
      appleListRef.current = activeApples;
      clearTimeout(slideTimerRef.current);

      resetApples(); // 清空舊狀態
      // resetApples 會 setAppleList([])，再設定新的
      appleListRef.current = activeApples;
      setAppleList(activeApples);
      setPhase("playing");
      phaseRef.current       = "playing";
      setTimeLeft(duration || 30);
      setReward(r || 1);
      rewardRef.current      = r || 1;
      setMyScore(0);
      myScoreRef.current     = 0;
      setResult(null);
      setDropping(false);
      droppingRef.current    = false;
      setClawX(50);
      setClawY(0);
      setProngsOpen(true);
      setHasCatch(false);
      setEffects([]);
      clawXRef.current       = 50;
      dirRef.current         = 1;
      speedRef.current       = speed || 0.5;
      dropSpeedRef.current   = dropSpeed || 100;
      catchResultRef.current = null;

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);

      startOscillation();
    };

    const onDropResult = ({ success, caught }) => {
      if (inputLockedRef.current) return;
      catchResultRef.current = { success, earned: caught ?? rewardRef.current };
    };

    const onEnd = ({ scores }) => {
      inputLockedRef.current = true;
      clearInterval(timerRef.current);
      stopOscillation();
      if (dropAnimRef.current) cancelAnimationFrame(dropAnimRef.current);
      clearTimeout(closeTimerRef.current);
      clearTimeout(slideTimerRef.current);

      // 先進入 closing 相位讓遊戲畫面淡出，再顯示結果
      setPhase("closing");
      phaseRef.current    = "closing";
      setDropping(false);
      droppingRef.current = false;
      setClawY(0);
      setProngsOpen(true);
      setHasCatch(false);
      setResult(scores);

      closeTimerRef.current = setTimeout(() => {
        setPhase("result");
        phaseRef.current = "result";
      }, 450);
    };

    socket.on("clawGameWarn",   onWarn);
    socket.on("clawGameStart",  onStart);
    socket.on("clawDropResult", onDropResult);
    socket.on("clawGameEnd",    onEnd);

    return () => {
      socket.off("clawGameWarn",   onWarn);
      socket.off("clawGameStart",  onStart);
      socket.off("clawDropResult", onDropResult);
      socket.off("clawGameEnd",    onEnd);
      clearInterval(timerRef.current);
      clearInterval(warnTimerRef.current);
      clearTimeout(closeTimerRef.current);
      clearTimeout(slideTimerRef.current);
      stopOscillation();
      if (dropAnimRef.current) cancelAnimationFrame(dropAnimRef.current);
    };
  }, [socket, startOscillation, stopOscillation, resetApples]);

  // ── 玩家按下落爪 ──────────────────────────────────────────────────────────────
  const handleDrop = useCallback(() => {
    if (inputLockedRef.current) return;
    if (phaseRef.current !== "playing" || droppingRef.current) return;
    droppingRef.current    = true;
    catchResultRef.current = null;
    setDropping(true);
    stopOscillation();
    socket.emit("clawDropClaw", { token, position: +(clawXRef.current / 100).toFixed(2) });
    runDropAnimation();
  }, [socket, token, stopOscillation, runDropAnimation]);

  // 鍵盤
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); handleDrop(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDrop]);

  // ── 30 秒預告說明彈窗（遊戲尚未開始時） ──────────────────────────────────────
  if (phase === "idle" && warnVisible) {
    return (
      <div className="clw-warn-overlay" onClick={() => setWarnVisible(false)}>
        <div className="clw-warn-card" onClick={e => e.stopPropagation()}>
          <div className="clw-warn-countdown">{warnSeconds}</div>
          <div className="clw-warn-unit">秒後開始</div>
          <h2 className="clw-warn-title">🎰 夾蘋果機</h2>
          <ul className="clw-warn-rules">
            <li>🔄 爪子會自動<strong>左右搖擺</strong></li>
            <li>👇 看準時機按「<strong>抓！</strong>」讓爪子下降</li>
            <li>🍎 爪子夾中時蘋果<strong>消失</strong>，獲得金蘋果</li>
            <li>⏱ 時間內盡可能多夾！</li>
          </ul>
          <button
            className="clw-warn-close"
            onClick={() => setWarnVisible(false)}
          >
            我知道了！
          </button>
        </div>
      </div>
    );
  }

  if (phase === "idle") return null;

  const sortedScores = result ? Object.entries(result).sort(([, a], [, b]) => b - a) : [];
  const ropeH = 20 + clawY * 9999;
  const isClosing = phase === "closing";

  // ── 結果畫面（點任意處關閉） ──────────────────────────────────────────────────
  if (phase === "result") {
    return (
      <div
        className="clw-overlay clw-result-screen"
        onClick={() => { inputLockedRef.current = true; setPhase("idle"); phaseRef.current = "idle"; }}
      >
        <div className="clw-result">
          <h2>🎉 遊戲結束</h2>
          <p className="clw-my-rank">
            你夾了 <strong>{myScore}</strong> 顆金蘋果
          </p>
          <ul>
            {sortedScores.map(([n, s], i) => (
              <li key={n} className={n === name ? "me" : ""}>
                {i + 1}. {n}：{s} 顆
              </li>
            ))}
          </ul>
          <div className="clw-dismiss-hint">點擊任意處關閉</div>
        </div>
      </div>
    );
  }

  // ── 遊戲畫面（playing / closing） ────────────────────────────────────────────
  return (
    <div className={`clw-overlay${isClosing ? " closing" : ""}`}>

      {/* HUD */}
      <div className="clw-hud">
        <span className={`clw-timer${timeLeft <= 10 ? " urgent" : timeLeft <= 20 ? " warning" : ""}`}>
          {timeLeft}<span className="clw-timer-unit">秒</span>
        </span>
        <span className="clw-score">
          <img src={APPLE_IMG} className="clw-score-icon" alt="" /> {myScore} 顆
        </span>
        <span className="clw-hint">按「抓！」或空白鍵落下爪子</span>
      </div>

      {/* Field */}
      <div className="clw-field">
        <div className="clw-machine">

          <div className="clw-top-bar">
            <span className="clw-neon-text">🎰 夾蘋果機</span>
          </div>

          <div className="clw-window" ref={windowRef}>
            <div className="clw-rail" />

            <div className="clw-claw-system" style={{ left: `${clawX}%` }}>
              <div
                className="clw-rope"
                style={{ height: `min(${ropeH}px, calc(var(--clw-max-extend, 210px) + 20px))` }}
              />
              <div className="clw-claw-head">
                <div className={`clw-prong clw-prong-l${prongsOpen ? "" : " closed"}`} />
                <div className={`clw-prong clw-prong-c${prongsOpen ? "" : " closed"}`} />
                <div className={`clw-prong clw-prong-r${prongsOpen ? "" : " closed"}`} />
                {hasCatch && (
                  <div className="clw-held-apple">
                    <img src={APPLE_IMG} alt="金蘋果" />
                  </div>
                )}
              </div>
            </div>

            {appleList.map(a => (
              <div
                key={a.id}
                className="clw-pile-pos"
                style={{
                  left:   `calc(${a.x}% - 19px)`,
                  bottom: `${FULL_APPLE_INIT[a.posIdx].bot}%`,
                }}
              >
                <div
                  className={`clw-pile-apple${a.isCaught ? " caught" : ""}`}
                  style={{ "--dur": `${a.dur}s`, "--delay": `${a.delay}s` }}
                >
                  <img src={APPLE_IMG} alt="金蘋果" />
                </div>
              </div>
            ))}

            {effects.map(e => (
              <div key={e.id} className="clw-effect">
                +{e.earned} <img src={APPLE_IMG} alt="" />
              </div>
            ))}
          </div>

          <div className="clw-slot">
            <span className="clw-slot-label">出口</span>
          </div>
        </div>

        <button
          className={`clw-grab-btn${dropping ? " disabled" : ""}`}
          onClick={handleDrop}
          disabled={dropping || phase !== "playing"}
        >
          {dropping ? "⋯" : "抓！"}
        </button>
      </div>
    </div>
  );
}
