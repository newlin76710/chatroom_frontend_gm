// GoldAppleGame.jsx — 撈金蘋果遊戲覆蓋層
// 遊戲一：多顆金蘋果，即時提交撈取，結束直接查看伺服器結算結果
// 遊戲二：一顆大金蘋果，第一個點到的人獲得全部獎勵
//
// 遊戲一採用即時提交模式：每次撈到蘋果時立刻向伺服器發送 `caughtApple1` 事件，
// 伺服器累積計數，遊戲結束後自動結算，因此不需要等待提交視窗。
// 遊戲二透過 `catchApple2` 事件觸發搶奪，伺服器立即回傳勝負。
//
// Socket 事件：
//   接收 (in):
//     goldGame1Warn    { secondsLeft }               // 遊戲一 30 秒預告
//     goldGame1Start   { duration, appleIds, reward, speedLo, speedHi, maxCatchPerUser, appleCount }
//     goldGame1End     (空)                           // 遊戲一時間到
//     goldGame1Result  { catches: { [name]: count } } // 遊戲一結算結果
//     goldGame2Warn    { secondsLeft }               // 遊戲二 30 秒預告
//     goldGame2Start   { reward, speedLo, speedHi }  // 遊戲二開始
//     goldGame2Won     { winner, reward }             // 遊戲二有人搶到
//     goldGame2Late    { winner, secondsLate }       // 遊戲二你慢了
//     goldGame2End     { winner }                     // 遊戲二結束
//   發送 (out):
//     caughtApple1     { token, appleId }             // 遊戲一每次撈到蘋果
//     catchApple2      { token }                      // 遊戲二點擊大蘋果

import { useState, useEffect, useRef, useCallback } from "react";
import "./GoldAppleGame.css";

import { BACKEND, RN } from "../../shared/roomConfig";

// ─── 常數 ─────────────────────────────────────────────────────────────────────
const SIZE1 = 56;       // 遊戲一蘋果尺寸 (px)
const SIZE2 = 100;      // 遊戲二大蘋果尺寸 (px)
const SPD_LO = 5;       // 遊戲一最低速度 (px/frame @60fps)
const SPD_HI = 9;       // 遊戲一最高速度
const SPD2_LO = 40;     // 遊戲二最低速度
const SPD2_HI = 60;     // 遊戲二最高速度

/**
 * 產生隨機速度向量 (遊戲一 / 遊戲二通用)
 * @param {number} lo 最低速度值
 * @param {number} hi 最高速度值
 * @returns {{ vx: number, vy: number }}
 */
function randSpd(lo = SPD_LO, hi = SPD_HI) {
  const s = lo + Math.random() * (hi - lo);
  const a = Math.random() * Math.PI * 2;
  return { vx: Math.cos(a) * s, vy: Math.sin(a) * s };
}

/**
 * 反彈後輕微旋轉速度向量，增加軌跡不規則感
 * @param {object} p        物件 (需包含 vx, vy)
 * @param {number} angleDeg 最大旋轉角度 (度)
 */
function jitterBounce(p, angleDeg = 20) {
  const a = (Math.random() - 0.5) * (angleDeg * Math.PI / 180);
  const cos = Math.cos(a), sin = Math.sin(a);
  const vx = p.vx * cos - p.vy * sin;
  const vy = p.vx * sin + p.vy * cos;
  p.vx = vx;
  p.vy = vy;
}

/**
 * 隨機初始位置 (保證蘋果完全在可視範圍內)
 * @param {number} W 容器寬度
 * @param {number} H 容器高度
 * @param {number} size 蘋果尺寸
 * @returns {{ x: number, y: number }}
 */
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

  // ── 30 秒預告類型和倒數秒數
  const [warnType, setWarnType] = useState(null);   // null | 'game1' | 'game2'
  const [warnSeconds, setWarnSeconds] = useState(30);

  // ── 遊戲一相關狀態 ──────────────────────────────────────────────────────
  const [g1AppleIds, setG1AppleIds] = useState([]);      // 畫面上剩餘的蘋果 ID 列表
  const [g1Reward, setG1Reward] = useState(1);           // 每顆蘋果可獲得的金蘋果數
  const [g1CatchLimit, setG1CatchLimit] = useState(0);   // 個人最多可撈取顆數
  const [g1CaughtCount, setG1CaughtCount] = useState(0); // 本地已撈取計數
  const [g1Result, setG1Result] = useState(null);        // 伺服器結算結果 { [player]: apples }
  const [g1Submitting, setG1Submitting] = useState(false); // 是否正在等待結算

  // ── 遊戲二相關狀態 ──────────────────────────────────────────────────────
  const [g2Reward, setG2Reward] = useState(25);          // 大金蘋果獎勵
  const [g2Result, setG2Result] = useState(null);        // { winner, reward }

  // ── 共用 ────────────────────────────────────────────────────────────────
  const [timeLeft, setTimeLeft] = useState(0);           // 遊戲一剩餘秒數
  const [lateMsg, setLateMsg] = useState("");            // 遊戲二慢了 N 秒的提示文字

  // ── Refs (避免閉包捕獲過舊的值，讓動畫迴圈 / DOM 操作直接讀取最新資料) ─
  const containerRef = useRef(null);
  const physicsRef = useRef({});         // 遊戲一蘋果物理資料 id → { id, x, y, vx, vy }
  const domRefs = useRef({});             // 遊戲一蘋果 DOM 元素引用
  const localCaughtRef = useRef(new Set()); // 本地已撈取 appleId (防止重複點擊)
  const apple2WrapRef = useRef(null);     // 遊戲二蘋果包裝 div
  const apple2Physics = useRef({ x: 200, y: 200, vx: 7, vy: 6 }); // 遊戲二蘋果物理
  const g1SpdRef = useRef({ lo: SPD_LO,  hi: SPD_HI  });   // 遊戲一速度設定
  const g2SpdRef = useRef({ lo: SPD2_LO, hi: SPD2_HI });   // 遊戲二速度設定
  const animRef = useRef(null);           // 動畫 requestAnimationFrame ID
  const timerRef = useRef(null);          // 倒計時 interval ID
  const warnTimerRef = useRef(null);      // 預告彈窗倒數 interval ID
  const phaseRef = useRef("idle");        // 當前階段鏡像
  const inputLockedRef = useRef(true);    // 輸入鎖 (非遊戲中或正在下爪時鎖定)
  const activePointerRef = useRef(null);  // 多點觸控保護：只允許第一個接觸點
  const lastCatchTimeRef = useRef(0);     // 上次撈取時間 (客戶端本地冷卻)
  const CATCH_COOLDOWN_MS = 200;          // 客戶端撈取冷卻時間 (ms)
  // 容器尺寸快取 (避免每幀 reflow)
  const sizeRef = useRef({ W: window.innerWidth, H: window.innerHeight });

  // 撈網游標位置與動作狀態
  const [netPos, setNetPos]           = useState({ x: -300, y: -300 });
  const [netScooping, setNetScooping] = useState(false); // 撈網是否正在舀取動畫中

  // 同步 phase state 到 ref
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /**
   * 從伺服器重新查詢並更新金蘋果數量 (呼叫父層 setApples)
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

  /**
   * 監聽容器尺寸變化，更新 sizeRef
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      sizeRef.current = { W: width, H: height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]); // phase 改變時可能重新掛載容器

  // ─── 動畫迴圈 ──────────────────────────────────────────────────────────────

  /**
   * 開始動畫迴圈 (requestAnimationFrame)
   * 依據 phaseRef 決定更新遊戲一多顆蘋果或遊戲二單顆蘋果的位置
   */
  const startAnim = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);

    function loop() {
      if (!containerRef.current) {
        animRef.current = requestAnimationFrame(loop);
        return;
      }
      const { W, H } = sizeRef.current;

      if (phaseRef.current === "game1") {
        // 更新所有蘋果位置，處理邊界反彈
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
        // 更新大金蘋果位置，邊界反彈並加入抖動
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

  /**
   * 停止動畫迴圈
   */
  const stopAnim = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
  }, []);

  // ─── 倒計時 ────────────────────────────────────────────────────────────────

  /**
   * 啟動遊戲一倒計時
   * @param {number} secs 總秒數
   */
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

  // ─── Socket 事件監聽 ──────────────────────────────────────────────────────────
  useEffect(() => {
    // 30 秒預告開始倒數
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

    // 遊戲一預告
    const onGame1Warn = ({ secondsLeft }) => startWarnCountdown('game1', secondsLeft);
    // 遊戲二預告
    const onGame2Warn = ({ secondsLeft }) => startWarnCountdown('game2', secondsLeft);

    // 遊戲一開始
    const onG1Start = ({ duration, appleIds, reward, speedLo, speedHi, maxCatchPerUser, appleCount }) => {
      inputLockedRef.current = false;
      clearInterval(warnTimerRef.current);
      setWarnType(null);
      setG1Reward(reward);
      setG1CatchLimit(Number(maxCatchPerUser || appleCount || appleIds?.length || 0));
      setG1CaughtCount(0);
      setG1Result(null);
      setG1Submitting(false);
      setLateMsg("");
      if (speedLo !== undefined) g1SpdRef.current = { lo: speedLo, hi: speedHi };

      // 清除上一場紀錄
      localCaughtRef.current.clear();
      activePointerRef.current = null;
      lastCatchTimeRef.current = 0;
      setNetPos({ x: -300, y: -300 });
      setNetScooping(false);

      // 初始化蘋果物理
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

    // 遊戲一結束：回傳本地撈取總數給後端比對
    const onG1End = () => {
      inputLockedRef.current = true;
      stopAnim();
      clearInterval(timerRef.current);
      activePointerRef.current = null;
      setNetScooping(false);
      setG1Submitting(true);
      // 回傳本地計數給後端做比對（取較高值結算）
      socket.emit("submitGame1Score", { token, room: RN, count: localCaughtRef.current.size });
      setG1AppleIds([]);
      physicsRef.current = {};
      domRefs.current = {};
      setPhase("result1");
    };

    // 遊戲一結算結果
    const onG1Result = ({ catches }) => {
      setG1Submitting(false);
      setG1Result(catches || {});
      if ((catches?.[name] || 0) > 0) {
        // 如果有得分，稍候更新金蘋果數量
        setTimeout(() => { refreshMyApples(); }, 300);
      }
      setG1CaughtCount(0);
      setG1CatchLimit(0);
    };

    // 遊戲二開始
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
      startAnim();
    };

    // 遊戲二有人獲勝
    const onG2Won = ({ winner, reward }) => {
      inputLockedRef.current = true;
      setG2Result({ winner, reward });
      if (winner === name) {
        setTimeout(() => { refreshMyApples(); }, 300);
      }
    };

    // 遊戲二你慢了
    const onG2Late = ({ winner, secondsLate }) => {
      setLateMsg(`已被 ${winner} 搶先 ${secondsLate} 秒`);
      setTimeout(() => setLateMsg(""), 3500);
    };

    // 遊戲二結束（清除狀態）
    const onG2End = () => {
      inputLockedRef.current = true;
      stopAnim();
      activePointerRef.current = null;
      setPhase("result2");
    };

    // 註冊所有事件監聽
    socket.on("goldGame1Warn",   onGame1Warn);
    socket.on("goldGame2Warn",   onGame2Warn);
    socket.on("goldGame1Start", onG1Start);
    socket.on("goldGame1End", onG1End);
    socket.on("goldGame1Result", onG1Result);
    socket.on("goldGame2Start", onG2Start);
    socket.on("goldGame2Won", onG2Won);
    socket.on("goldGame2Late", onG2Late);
    socket.on("goldGame2End", onG2End);

    // 清除事件與所有計時器
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

  // 組件卸載時清理所有動畫與計時器
  useEffect(() => {
    return () => {
      stopAnim();
      clearInterval(timerRef.current);
      clearInterval(warnTimerRef.current);
    };
  }, [stopAnim]);

  // ─── 撈蘋果動作（遊戲一，即時提交） ─────────────────────────────────────────

  /**
   * 處理撈網下壓（pointer down）
   * 計算距離最近的蘋果，若在撈網半徑內則標記為已撈取，並發送 caughtApple1 事件給伺服器
   */
  const handleNetCast = useCallback((e) => {
    if (inputLockedRef.current) return;
    if (phaseRef.current !== "game1") return;
    // 多點觸控保護
    if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) return;
    const now = Date.now();
    if (now - lastCatchTimeRef.current < CATCH_COOLDOWN_MS) return;

    activePointerRef.current = e.pointerId;
    setNetPos({ x: e.clientX, y: e.clientY });

    const NET_RADIUS = 55; // 撈網有效半徑 (px)
    let bestId = null;
    let bestDist = Infinity;

    // 尋找範圍內最近的蘋果 (以中心點計算距離)
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

    // 播放撈網動畫
    setNetScooping(true);
    setTimeout(() => setNetScooping(false), 420);

    if (!bestId) return; // 沒有撈到任何蘋果

    // 記錄撈取
    lastCatchTimeRef.current = now;
    localCaughtRef.current.add(bestId);
    delete physicsRef.current[bestId]; // 從物理世界移除

    // 即時向伺服器回報撈取
    socket.emit("caughtApple1", { token, room: RN, appleId: bestId });

    // 更新本地計數
    setG1CaughtCount(prev => {
      const next = prev + 1;
      return g1CatchLimit ? Math.min(next, g1CatchLimit) : next;
    });
    setG1AppleIds(prev => prev.filter(id => id !== bestId));
  }, [socket, token, g1CatchLimit]);

  /**
   * 移動撈網游標 (跟隨指針)
   */
  const handlePointerMove = useCallback((e) => {
    if (inputLockedRef.current) return;
    if (phaseRef.current !== "game1") return;
    setNetPos({ x: e.clientX, y: e.clientY });
  }, []);

  /**
   * 遊戲二搶奪大金蘋果
   */
  const handleCatch2 = useCallback((e) => {
    if (inputLockedRef.current) return;
    e.stopPropagation();
    if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = e.pointerId;
    socket.emit("catchApple2", { token, room: RN });
  }, [socket, token]);

  /**
   * 釋放指針 (觸控結束)
   */
  const handlePointerRelease = useCallback((e) => {
    if (activePointerRef.current === e.pointerId) {
      activePointerRef.current = null;
    }
  }, []);

  /**
   * 關閉結果畫面，回到 idle
   */
  const dismissResult = useCallback(() => {
    inputLockedRef.current = true;
    setPhase("idle");
    setG1Result(null);
    setG1CaughtCount(0);
    setG1CatchLimit(0);
    setG2Result(null);
    setG1Submitting(false);
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

  if (phase === "idle") return null;

  // ─── 結果畫面（遊戲一） ─────────────────────────────────────────────────
  if (phase === "result1") {
    const isSettling = g1Result === null || g1Submitting; // 是否還在等待伺服器結算
    const entries = Object.entries(g1Result || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);
    return (
      <div className="gag-overlay" onClick={dismissResult}>
        <div className="gag-result" onClick={e => e.stopPropagation()}>
          <h2>🍎 遊戲結束！</h2>
          {isSettling ? (
            <>
              <p>正在等待結算結果...</p>
              <p>你撈到了 {localCaughtRef.current.size} 顆（最終以伺服器紀錄為準）</p>
            </>
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
          <p className="gag-dismiss-hint">點擊任意處關閉</p>
        </div>
      </div>
    );
  }

  // ─── 結果畫面（遊戲二） ─────────────────────────────────────────────────
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
      {/* HUD 資訊欄 */}
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

      {/* 慢了 N 秒提示 */}
      {lateMsg && <div className="gag-late">{lateMsg}</div>}

      {/* 遊戲一：多顆金蘋果 */}
      {phase === "game1" && g1AppleIds.map(id => (
        <div
          key={id}
          className="gag-apple-wrap"
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

      {/* 遊戲二：一顆大金蘋果 */}
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