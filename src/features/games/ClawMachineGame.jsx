// ClawMachineGame.jsx — 夾蘋果機遊戲
// 這是一個類似夾娃娃機的互動遊戲組件，玩家控制左右搖擺的爪子，在時間內盡可能夾取金蘋果。
// 
// Socket 事件：
//   接收 (in):
//     clawGameStart  { duration, reward, speed, dropSpeed }
//     clawDropResult { success, caught }
//     clawGameEnd    { scores: { [username]: count } }
//     clawGameWarn   { secondsLeft }
//   發送 (out):
//     clawDropClaw   { token, position }   (position 為 0~1 的比例值)
//
// 主要遊戲邏輯：
//   - 爪子會自動左右擺動 (requestAnimationFrame)
//   - 玩家按下「抓！」按鈕或空白鍵時，爪子下降並停留在底部等待伺服器結果
//   - 伺服器回傳結果後，若成功，爪子夾起最近的蘋果，蘋果消失並觸發補位動畫
//   - 時間到後顯示排行榜
//   - 遊戲開始前有 30 秒預告彈窗說明規則

import { useState, useEffect, useRef, useCallback } from "react";
import "./ClawMachineGame.css";

import { BACKEND, RN } from "../../shared/roomConfig";

// 動畫基準時間 (毫秒)，這些值會根據 dropSpeed 進行縮放
const BASE_DROP_MS = 600;   // 爪子下降所需時間
const BASE_HOLD_MS = 500;   // 爪子停在底部的時間
const BASE_RISE_MS = 533;   // 爪子上升所需時間
const APPLE_IMG = "/gifts/gold_apple.gif";

// 蘋果池初始配置 (40顆蘋果)
// 每個物件定義了蘋果的中心位置(x%)、底部距離(bot%)、水平搖擺動畫的時長(dur)與延遲(delay)
// 位置設計讓蘋果集中在下半區域，形成堆疊感
const FULL_APPLE_INIT = [
  // 排 1 (最底層) IDs 0-5
  { id: 0,  x: 7,  bot: 4,  dur: 2.4, delay: 0.0 },
  { id: 1,  x: 21, bot: 3,  dur: 2.8, delay: 0.5 },
  { id: 2,  x: 35, bot: 5,  dur: 2.2, delay: 0.9 },
  { id: 3,  x: 49, bot: 4,  dur: 3.1, delay: 0.3 },
  { id: 4,  x: 63, bot: 3,  dur: 2.6, delay: 0.7 },
  { id: 5,  x: 77, bot: 5,  dur: 2.3, delay: 1.1 },
  // 排 2 IDs 6-11
  { id: 6,  x: 14, bot: 10, dur: 2.7, delay: 0.4 },
  { id: 7,  x: 28, bot: 9,  dur: 2.5, delay: 0.8 },
  { id: 8,  x: 42, bot: 11, dur: 2.9, delay: 0.1 },
  { id: 9,  x: 56, bot: 10, dur: 2.1, delay: 0.6 },
  { id: 10, x: 70, bot: 9,  dur: 2.6, delay: 1.0 },
  { id: 11, x: 84, bot: 11, dur: 2.4, delay: 0.2 },
  // 排 3 IDs 12-17
  { id: 12, x: 7,  bot: 15, dur: 2.5, delay: 0.7 },
  { id: 13, x: 21, bot: 14, dur: 2.3, delay: 0.2 },
  { id: 14, x: 35, bot: 16, dur: 2.8, delay: 1.0 },
  { id: 15, x: 49, bot: 15, dur: 2.2, delay: 0.5 },
  { id: 16, x: 63, bot: 14, dur: 3.0, delay: 0.9 },
  { id: 17, x: 77, bot: 16, dur: 2.6, delay: 0.3 },
  // 排 4 IDs 18-23
  { id: 18, x: 14, bot: 20, dur: 2.4, delay: 0.6 },
  { id: 19, x: 28, bot: 19, dur: 2.7, delay: 0.1 },
  { id: 20, x: 42, bot: 21, dur: 2.3, delay: 0.8 },
  { id: 21, x: 56, bot: 20, dur: 2.9, delay: 0.4 },
  { id: 22, x: 70, bot: 19, dur: 2.5, delay: 1.1 },
  { id: 23, x: 84, bot: 21, dur: 2.1, delay: 0.2 },
  // 排 5 IDs 24-29
  { id: 24, x: 7,  bot: 25, dur: 2.6, delay: 0.5 },
  { id: 25, x: 21, bot: 24, dur: 2.4, delay: 1.0 },
  { id: 26, x: 35, bot: 26, dur: 2.8, delay: 0.3 },
  { id: 27, x: 49, bot: 25, dur: 2.2, delay: 0.7 },
  { id: 28, x: 63, bot: 24, dur: 3.1, delay: 0.0 },
  { id: 29, x: 77, bot: 26, dur: 2.5, delay: 0.9 },
  // 排 6 IDs 30-35
  { id: 30, x: 14, bot: 29, dur: 2.3, delay: 0.4 },
  { id: 31, x: 28, bot: 28, dur: 2.7, delay: 0.8 },
  { id: 32, x: 42, bot: 30, dur: 2.4, delay: 0.1 },
  { id: 33, x: 56, bot: 29, dur: 2.9, delay: 0.6 },
  { id: 34, x: 70, bot: 28, dur: 2.2, delay: 1.1 },
  { id: 35, x: 84, bot: 30, dur: 2.6, delay: 0.3 },
  // 排 7 (最上層，只有4顆) IDs 36-39
  { id: 36, x: 21, bot: 33, dur: 2.5, delay: 0.9 },
  { id: 37, x: 42, bot: 32, dur: 2.3, delay: 0.2 },
  { id: 38, x: 56, bot: 34, dur: 2.7, delay: 0.7 },
  { id: 39, x: 77, bot: 33, dur: 2.4, delay: 0.4 },
];

/**
 * 夾蘋果機遊戲組件
 * @param {object}   socket    - Socket.IO 客戶端實例
 * @param {string}   token     - 用戶認證 token
 * @param {string}   name      - 玩家暱稱
 * @param {function} setApples - 更新金蘋果數量的回調 (從父層傳入)
 */
export default function ClawMachineGame({ socket, token, name, setApples }) {
  // ===== 遊戲狀態 =====
  const [phase,        setPhase]        = useState("idle");    // idle | playing | closing | result
  const [warnVisible,  setWarnVisible]  = useState(false);    // 30秒預告說明彈窗是否顯示
  const [warnSeconds,  setWarnSeconds]  = useState(30);       // 說明彈窗倒數秒數

  // 蘋果列表：每個物件包含 { id, x, dur, delay, posIdx, isCaught }
  const [appleList,    setAppleList]    = useState([]);

  const [timeLeft,     setTimeLeft]     = useState(0);        // 剩餘遊戲時間 (秒)
  const [reward,       setReward]       = useState(1);        // 每顆蘋果可獲得的金蘋果數
  const [myScore,      setMyScore]      = useState(0);        // 本場已獲得金蘋果數
  const [result,       setResult]       = useState(null);     // 遊戲結束時的排行榜 { [name]: count }

  // 爪子相關狀態
  const [clawX,        setClawX]        = useState(50);       // 爪子水平位置 (百分比 12~88)
  const [clawY,        setClawY]        = useState(0);        // 爪子垂直位置 (0=頂，1=最低)
  const [prongsOpen,   setProngsOpen]   = useState(true);     // 爪子是否張開
  const [hasCatch,     setHasCatch]     = useState(false);    // 爪子上是否夾著蘋果
  const [dropping,     setDropping]     = useState(false);    // 爪子是否正在下降/上升動畫中

  // 特效：每次夾到時顯示 "+N" 的文字飛出效果
  const [effects,      setEffects]      = useState([]);

  // ===== Refs (用於避免閉包捕獲過舊的值，並讓 RAF 直接讀取最新值) =====
  const phaseRef        = useRef("idle");
  const clawXRef        = useRef(50);
  const dirRef          = useRef(1);        // 爪子移動方向 (+1 右, -1 左)
  const speedRef        = useRef(0.5);      // 爪子左右搖擺速度
  const dropSpeedRef    = useRef(100);      // 下爪速度因子 (50~300，影響動畫時長)
  const droppingRef     = useRef(false);
  const myScoreRef      = useRef(0);
  const rewardRef       = useRef(1);
  const timerRef        = useRef(null);     // 遊戲倒計時 interval
  const closeTimerRef   = useRef(null);     // closing 到 result 的延遲計時器
  const warnTimerRef    = useRef(null);     // 預告彈窗倒數 interval
  const inputLockedRef  = useRef(true);     // 輸入鎖 (遊戲未進行或正在下爪時鎖定)
  const slideTimerRef   = useRef(null);     // 蘋果補位動畫結束後的延遲計時器
  const appleListRef    = useRef([]);       // appleList 的同步鏡像 (供 RAF 讀取)
  const oscAnimRef      = useRef(null);     // 搖擺動畫的 RAF ID
  const dropAnimRef     = useRef(null);     // 下爪動畫的 RAF ID
  const catchResultRef  = useRef(null);     // 存放伺服器回傳的下爪結果 { success, earned }
  const effectIdRef     = useRef(0);        // 特效遞增 ID
  const windowRef       = useRef(null);     // 遊戲視窗 DOM 參考

  // 同步 state 到 ref
  useEffect(() => { phaseRef.current  = phase;  }, [phase]);
  useEffect(() => { rewardRef.current = reward; }, [reward]);

  /**
   * 重新查詢並更新使用者的金蘋果數量 (呼叫父層 setApples)
   */
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

  // ===== 遊戲初始化 / 重置 =====

  /**
   * 重置蘋果列表 (清空)
   */
  const resetApples = useCallback(() => {
    appleListRef.current = [];
    setAppleList([]);
  }, []);

  /**
   * 從 appleListRef 中找出距離爪子當前位置 (clawX) 最近且未被夾走的蘋果
   * @returns {object|null} 最近的蘋果物件，若無則回傳 null
   */
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

  // ===== 爪子動畫控制 =====

  /**
   * 停止爪子搖擺動畫
   */
  const stopOscillation = useCallback(() => {
    if (oscAnimRef.current) cancelAnimationFrame(oscAnimRef.current);
  }, []);

  /**
   * 開始爪子左右搖擺動畫 (RAF 迴圈)
   */
  const startOscillation = useCallback(() => {
    const tick = () => {
      if (phaseRef.current !== "playing" || droppingRef.current) return;
      // 更新爪子位置
      clawXRef.current += dirRef.current * speedRef.current;
      // 邊界反彈
      if (clawXRef.current >= 88) { clawXRef.current = 88; dirRef.current = -1; }
      if (clawXRef.current <= 12) { clawXRef.current = 12; dirRef.current =  1; }
      setClawX(clawXRef.current);
      oscAnimRef.current = requestAnimationFrame(tick);
    };
    oscAnimRef.current = requestAnimationFrame(tick);
  }, []);

  /**
   * 執行整個下爪動畫 (下降 → 停留 → 上升)
   * 使用 requestAnimationFrame 精確控制動畫時間點與伺服器結果回傳的對齊
   */
  const runDropAnimation = useCallback(() => {
    const start      = performance.now();
    const windowEl   = windowRef.current;
    // 根據視窗高度計算最大延伸長度 (CSS 變數)
    const maxExtend  = Math.max(140, (windowEl?.clientHeight ?? 300) - 80);
    if (windowEl) windowEl.style.setProperty("--clw-max-extend", `${maxExtend}px`);

    // 根據 dropSpeed 計算實際動畫時長
    const ds      = dropSpeedRef.current;
    const DROP_MS = Math.round(BASE_DROP_MS * 100 / ds);
    const HOLD_MS = Math.max(400, Math.round(BASE_HOLD_MS * 100 / ds));
    const RISE_MS = Math.round(BASE_RISE_MS * 100 / ds);

    let resultApplied = false; // 確保結果只處理一次

    const tick = (now) => {
      const t = now - start;

      if (t < DROP_MS) {
        // ─── 下降階段 ───
        setClawY(t / DROP_MS);
        dropAnimRef.current = requestAnimationFrame(tick);

      } else if (t < DROP_MS + HOLD_MS) {
        // ─── 底部停留階段 ───
        setClawY(1);

        // 在停留階段的中後段，若伺服器結果已到達，則套用結果
        if (!resultApplied && t > DROP_MS + 230 && catchResultRef.current !== null) {
          resultApplied = true;
          const { success } = catchResultRef.current;
          setProngsOpen(false); // 爪子閉合

          if (success) {
            // 找到最近的蘋果並標記為被夾走
            const apple = findNearestApple();
            if (apple) {
              // 更新 ref 與 state 中的 isCaught 標記
              const withCaught = appleListRef.current.map(a =>
                a.id === apple.id ? { ...a, isCaught: true } : a
              );
              appleListRef.current = withCaught;
              setAppleList([...withCaught]);

              // 設定定時器：待消失動畫結束後，移除該蘋果並讓上層蘋果往下補位
              clearTimeout(slideTimerRef.current);
              slideTimerRef.current = setTimeout(() => {
                const caughtPosIdx = apple.posIdx;
                const next = appleListRef.current
                  .filter(a => !a.isCaught)                     // 過濾掉被夾走的
                  .map(a => a.posIdx > caughtPosIdx
                    ? { ...a, posIdx: a.posIdx - 1 }          // 上層蘋果 posIdx 減 1 (下移)
                    : a
                  );
                appleListRef.current = next;
                setAppleList([...next]);
              }, 450);
            }
            setHasCatch(true); // 爪子上顯示一顆蘋果
          }
        }
        dropAnimRef.current = requestAnimationFrame(tick);

      } else if (t < DROP_MS + HOLD_MS + RISE_MS) {
        // ─── 上升階段 ───
        setClawY(1 - (t - DROP_MS - HOLD_MS) / RISE_MS);
        dropAnimRef.current = requestAnimationFrame(tick);

      } else {
        // ─── 動畫結束 ───
        setClawY(0);
        setProngsOpen(true);
        setHasCatch(false);

        const res = catchResultRef.current;
        if (res?.success) {
          const earned = res.earned ?? rewardRef.current; // 伺服器可能回傳實際獲得數
          myScoreRef.current += earned;
          setMyScore(myScoreRef.current);
          setApples(prev => prev + earned);
          // 加入特效
          const id = effectIdRef.current++;
          setEffects(prev => [...prev, { id, earned }]);
          setTimeout(() => setEffects(prev => prev.filter(e => e.id !== id)), 1400);
        }

        // 重置狀態
        catchResultRef.current = null;
        droppingRef.current    = false;
        setDropping(false);
        // 若遊戲仍在進行，重新開始搖擺
        if (phaseRef.current === "playing") startOscillation();
      }
    };

    dropAnimRef.current = requestAnimationFrame(tick);
  }, [setApples, startOscillation, findNearestApple]);

  // ===== Socket 事件監聽 =====
  useEffect(() => {
    if (!socket) return;

    /**
     * 30秒預告事件
     */
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

    /**
     * 遊戲開始事件
     */
    const onStart = ({ duration, reward: r, speed, dropSpeed, appleCount }) => {
      inputLockedRef.current = false;
      // 關閉預告彈窗
      clearInterval(warnTimerRef.current);
      setWarnVisible(false);

      clearInterval(timerRef.current);
      stopOscillation();
      if (dropAnimRef.current) cancelAnimationFrame(dropAnimRef.current);

      // 決定本場使用的蘋果數量 (取伺服器設定值，但不超過 FULL_APPLE_INIT 長度)
      const count = Math.max(1, Math.min(appleCount ?? 12, FULL_APPLE_INIT.length));
      const activeApples = FULL_APPLE_INIT.slice(0, count).map((a, i) => ({
        id: a.id, x: a.x, dur: a.dur, delay: a.delay,
        posIdx: i, isCaught: false,
      }));

      // 重置蘋果列表 (先清空再設定)
      appleListRef.current = [];
      clearTimeout(slideTimerRef.current);
      appleListRef.current = activeApples;
      setAppleList(activeApples);

      // 設定遊戲狀態
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

      // 啟動倒計時
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);

      // 啟動爪子搖擺
      startOscillation();
    };

    /**
     * 下爪結果事件 (伺服器回傳)
     */
    const onDropResult = ({ success, caught }) => {
      if (inputLockedRef.current) return;
      catchResultRef.current = { success, earned: caught ?? rewardRef.current };
    };

    /**
     * 遊戲結束事件
     */
    const onEnd = ({ scores }) => {
      inputLockedRef.current = true;
      clearInterval(timerRef.current);
      stopOscillation();
      if (dropAnimRef.current) cancelAnimationFrame(dropAnimRef.current);
      clearTimeout(closeTimerRef.current);
      clearTimeout(slideTimerRef.current);

      // 進入 closing 過渡階段
      setPhase("closing");
      phaseRef.current    = "closing";
      setDropping(false);
      droppingRef.current = false;
      setClawY(0);
      setProngsOpen(true);
      setHasCatch(false);
      setResult(scores);

      // 如果自己有得分，重新查詢金蘋果數量
      if ((scores?.[name] || 0) > 0) {
        setTimeout(() => { refreshMyApples(); }, 300);
      }

      // 短暫過渡後顯示結果畫面
      closeTimerRef.current = setTimeout(() => {
        setPhase("result");
        phaseRef.current = "result";
      }, 450);
    };

    // 註冊事件
    socket.on("clawGameWarn",   onWarn);
    socket.on("clawGameStart",  onStart);
    socket.on("clawDropResult", onDropResult);
    socket.on("clawGameEnd",    onEnd);

    // 清除事件監聽與所有計時器
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
  }, [socket, startOscillation, stopOscillation, resetApples, name, refreshMyApples]);

  // ===== 玩家互動 =====

  /**
   * 按下「抓！」按鈕或空白鍵時，發送下爪事件並啟動動畫
   */
  const handleDrop = useCallback(() => {
    if (inputLockedRef.current) return;
    if (phaseRef.current !== "playing" || droppingRef.current) return;
    droppingRef.current    = true;
    catchResultRef.current = null;
    setDropping(true);
    stopOscillation();
    // 發送爪子當前位置 (0~1 比例)
    socket.emit("clawDropClaw", { token, room: RN, position: +(clawXRef.current / 100).toFixed(2) });
    runDropAnimation();
  }, [socket, token, stopOscillation, runDropAnimation]);

  // 鍵盤監聽：空白鍵或 Enter 觸發抓取
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return; // 避免在輸入框中觸發
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); handleDrop(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDrop]);

  // ===== 渲染 =====

  // ---------- 30 秒預告說明彈窗 ----------
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

  // 沒有任何活動時不渲染
  if (phase === "idle") return null;

  // 排行榜排序
  const sortedScores = result ? Object.entries(result).sort(([, a], [, b]) => b - a) : [];
  // 繩子長度 (根據爪子垂直比例)
  const ropeH = 20 + clawY * 9999;
  const isClosing = phase === "closing";

  // ---------- 結果畫面 ----------
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

  // ---------- 主要遊戲畫面 (playing / closing) ----------
  return (
    <div className={`clw-overlay${isClosing ? " closing" : ""}`}>

      {/* 上方 HUD 資訊 */}
      <div className="clw-hud">
        <span className={`clw-timer${timeLeft <= 10 ? " urgent" : timeLeft <= 20 ? " warning" : ""}`}>
          {timeLeft}<span className="clw-timer-unit">秒</span>
        </span>
        <span className="clw-score">
          <img src={APPLE_IMG} className="clw-score-icon" alt="" /> {myScore} 顆
        </span>
        <span className="clw-hint">按「抓！」或空白鍵落下爪子</span>
      </div>

      {/* 遊戲區域 */}
      <div className="clw-field">
        <div className="clw-machine">

          {/* 機台上方標題 */}
          <div className="clw-top-bar">
            <span className="clw-neon-text">🎰 夾蘋果機</span>
          </div>

          {/* 機台視窗 (玩家看到蘋果與爪子的區域) */}
          <div className="clw-window" ref={windowRef}>
            <div className="clw-rail" />

            {/* 爪子系統 (包含繩子 + 爪頭) */}
            <div className="clw-claw-system" style={{ left: `${clawX}%` }}>
              <div
                className="clw-rope"
                style={{ height: `min(${ropeH}px, calc(var(--clw-max-extend, 210px) + 20px))` }}
              />
              <div className="clw-claw-head">
                <div className={`clw-prong clw-prong-l${prongsOpen ? "" : " closed"}`} />
                <div className={`clw-prong clw-prong-c${prongsOpen ? "" : " closed"}`} />
                <div className={`clw-prong clw-prong-r${prongsOpen ? "" : " closed"}`} />
                {/* 若爪子夾到蘋果，顯示在爪子上 */}
                {hasCatch && (
                  <div className="clw-held-apple">
                    <img src={APPLE_IMG} alt="金蘋果" />
                  </div>
                )}
              </div>
            </div>

            {/* 蘋果堆 (使用絕對定位動態配置) */}
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

            {/* "+N" 得分特效 */}
            {effects.map(e => (
              <div key={e.id} className="clw-effect">
                +{e.earned} <img src={APPLE_IMG} alt="" />
              </div>
            ))}
          </div>

          {/* 機台出口槽 */}
          <div className="clw-slot">
            <span className="clw-slot-label">出口</span>
          </div>
        </div>

        {/* 抓取按鈕 */}
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