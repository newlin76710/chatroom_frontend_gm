// WhackAppleGame.jsx — 打金蘋果遊戲（打地鼠風格）
// 此組件實現了一個經典的打地鼠遊戲機制：
//  - 金蘋果從 3x3 的洞中隨機冒出。
//  - 玩家移動錘子（跟隨鼠標/觸控）敲擊冒出的蘋果。
//  - 每敲中一個蘋果 +1 分，連續敲中會顯示 Combo。
//  - 遊戲時間結束後顯示排行榜。
// 
// Socket 事件:
//   接收 (in):
//     whackGameStart { duration, reward, msLo, msHi, minApples, maxApples }
//     whackGameEnd   { scores: { [username]: count } }
//     whackGameWarn  { secondsLeft }
//   發送 (out):
//     catchWhackApple { token }   // 每次敲中蘋果時發送

import { useState, useEffect, useRef, useCallback } from "react";
import "./WhackAppleGame.css";

import { BACKEND, RN } from "../../shared/roomConfig";

// 洞的總數（3x3 排列）
const HOLE_COUNT = 9;

// 生成指定範圍內的隨機數
function rand(min, max) { return min + Math.random() * (max - min); }

/**
 * 打金蘋果遊戲主组件
 * @param {object}   socket    - Socket.IO 客戶端實例
 * @param {string}   token     - 用戶認證 token
 * @param {string}   name      - 玩家暱稱
 * @param {function} setApples - 更新金蘋果數量的回調
 */
export default function WhackAppleGame({ socket, token, name, setApples }) {
  // ===== 遊戲階段狀態 =====
  const [phase, setPhase]         = useState("idle");    // idle | playing | result
  const [warnVisible, setWarnVisible] = useState(false); // 30 秒預告彈窗是否顯示
  const [warnSeconds, setWarnSeconds] = useState(30);    // 預告倒數秒數

  // ===== 遊戲資料 =====
  const [timeLeft, setTimeLeft]   = useState(0);        // 剩餘遊戲時間（秒）
  const [reward, setReward]       = useState(1);        // 每顆蘋果可獲得的金蘋果獎勵（從伺服器設定）
  const [holes, setHoles]         = useState(() =>
    Array.from({ length: HOLE_COUNT }, () => ({ up: false, whacked: false }))
  ); // 洞的狀態陣列：up 表示蘋果是否冒出，whacked 表示是否已被打中
  const [myScore, setMyScore]     = useState(0);        // 本地本場得分（已打中的蘋果數）
  const [combo, setCombo]         = useState(0);        // Combo 連續打中計數
  const [hitEffects, setHitEffects] = useState([]);     // 打擊特效列表 [{ id, x, y }]
  const [result, setResult]       = useState(null);      // 遊戲結束時的排行榜數據 { [username]: count }

  // 錘子相關狀態
  const [hammerPos, setHammerPos]           = useState({ x: -200, y: -200 }); // 錘子位置（跟隨鼠標）
  const [hammerSwinging, setHammerSwinging] = useState(false);                // 錘子是否正在揮擊動畫中

  // ===== Refs（避免閉包陳舊，並讓定時器、動畫迴圈直接讀取最新值）=====
  const phaseRef    = useRef("idle");         // 當前階段鏡像
  const timerRef    = useRef(null);           // 遊戲倒計時 interval ID
  const warnTimerRef = useRef(null);          // 預告彈窗倒數 interval ID
  const inputLockedRef = useRef(true);        // 輸入鎖定（遊戲進行中且未在冷卻時解鎖）
  const holeTimers  = useRef([]);             // 儲存所有蘋果冒出/縮回的計時器，以便清除
  const myScoreRef  = useRef(0);              // 得分鏡像
  const comboRef    = useRef(0);              // combo 鏡像
  const comboTimer  = useRef(null);           // combo 重置計時器
  const hitIdRef           = useRef(0);       // 特效遞增 ID
  const upCountRef         = useRef(0);       // 當前同時冒出的蘋果數量
  const activePointerRef   = useRef(null);    // 多點觸控保護：只允許第一個接觸點觸發打擊
  const lastWhackTimeRef   = useRef(0);       // 上次打擊時間，用於冷卻
  const WHACK_COOLDOWN_MS  = 250;             // 打擊後冷卻時間（毫秒）
  const maxConcurrentRef   = useRef(4);       // 目前允許同時存在的蘋果數（會隨時間增加）
  const initConcurrentRef  = useRef(4);       // 開場時的同時蘋果數（來自伺服器設定）
  const finalConcurrentRef = useRef(7);       // 遊戲後期的最高同時蘋果數（來自伺服器設定）
  const appleMsLoRef       = useRef(350);     // 蘋果最短停留時間（毫秒）
  const appleMsHiRef       = useRef(700);     // 蘋果最長停留時間（毫秒）

  // holeStateRef 是洞狀態的權威副本，用於碰撞檢測和計時器回調，避免 stale closure
  const holeStateRef = useRef(
    Array.from({ length: HOLE_COUNT }, () => ({ up: false, whacked: false }))
  );
  const holeRefs = useRef([]); // 每個洞包的 DOM 元素引用

  // 同步 phase state 到 phaseRef
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  /**
   * 從伺服器重新查詢使用者的金蘋果數量（用於遊戲結束後更新）
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

  // ===== 洞狀態更新 =====

  /**
   * 原子性地更新 holeStateRef 和 React state
   * @param {function} updater - 接收當前狀態並返回新狀態的函數
   */
  const setHoleStateAtomically = useCallback((updater) => {
    holeStateRef.current = updater(holeStateRef.current);
    setHoles([...holeStateRef.current]);
  }, []);

  /**
   * 重置所有洞的狀態（清除冒出與打擊標記）
   */
  const resetHoles = useCallback(() => {
    holeStateRef.current = Array.from({ length: HOLE_COUNT }, () => ({ up: false, whacked: false }));
    setHoles([...holeStateRef.current]);
  }, []);

  /**
   * 清除所有洞相關的計時器（包括冒出、縮回、升級計時器）
   */
  const clearHoleTimers = useCallback(() => {
    holeTimers.current.forEach(clearTimeout);
    holeTimers.current = [];
  }, []);

  // ===== 蘋果調度（控制出現邏輯）=====

  /**
   * 排程下一個蘋果從隨機空閒的洞中冒出
   * 使用 ref 獲取最新狀態，可在計時器回調中安全調用
   * @param {number} delay - 延遲多久後冒出（毫秒）
   */
  const scheduleNextHole = useCallback((delay = rand(300, 700)) => {
    if (phaseRef.current !== "playing") return;
    if (upCountRef.current >= maxConcurrentRef.current) return; // 已達同時上限

    const t = setTimeout(() => {
      if (phaseRef.current !== "playing") return;
      if (upCountRef.current >= maxConcurrentRef.current) return;

      // 找出所有目前沒有冒出的洞
      const idleIndices = holeStateRef.current
        .map((h, i) => i)
        .filter(i => !holeStateRef.current[i].up);
      if (idleIndices.length === 0) return; // 沒有空閒洞

      // 隨機選擇一個
      const i = idleIndices[Math.floor(Math.random() * idleIndices.length)];
      upCountRef.current++; // 增加冒出計數

      // 更新洞狀態為冒出（未擊中）
      holeStateRef.current = holeStateRef.current.map((h, idx) =>
        idx === i ? { up: true, whacked: false } : h
      );
      setHoles([...holeStateRef.current]);

      // 設定自動縮回計時器（若玩家未在時間內擊中）
      const upDuration = rand(appleMsLoRef.current, appleMsHiRef.current);
      const t2 = setTimeout(() => {
        if (phaseRef.current !== "playing") return;
        const h = holeStateRef.current[i];
        if (h.up && !h.whacked) {
          // 蘋果未被擊中，自行縮回
          upCountRef.current = Math.max(0, upCountRef.current - 1);
          holeStateRef.current = holeStateRef.current.map((hole, idx) =>
            idx === i ? { up: false, whacked: false } : hole
          );
          setHoles([...holeStateRef.current]);
          // 縮回後立即排程下一個蘋果冒出
          scheduleNextHole(rand(100, 350));
        }
      }, upDuration);

      holeTimers.current.push(t2);
    }, delay);

    holeTimers.current.push(t);
  }, []); // 所有依賴都通過 ref，不需加入依賴陣列

  /**
   * 啟動蘋果冒出邏輯，並設定難度漸進計時器
   */
  const startHoles = useCallback(() => {
    clearHoleTimers();
    resetHoles();
    upCountRef.current = 0;

    const initN  = initConcurrentRef.current;
    const finalN = finalConcurrentRef.current;
    const midN   = Math.round((initN + finalN) / 2);
    maxConcurrentRef.current = initN; // 初始同時上限

    // 開場立刻啟動前幾個蘋果
    for (let k = 0; k < initN; k++) {
      scheduleNextHole(rand(k * 120, k * 120 + 250));
    }

    // 10 秒後提升難度至中間值
    const ramp1 = setTimeout(() => {
      if (phaseRef.current === "playing" && midN > initN) {
        maxConcurrentRef.current = midN;
        for (let k = 0; k < midN - initN; k++) scheduleNextHole(rand(50 + k * 100, 200 + k * 100));
      }
    }, 10000);

    // 20 秒後提升至最高難度
    const ramp2 = setTimeout(() => {
      if (phaseRef.current === "playing" && finalN > midN) {
        maxConcurrentRef.current = finalN;
        for (let k = 0; k < finalN - midN; k++) scheduleNextHole(rand(50 + k * 80, 200 + k * 80));
      }
    }, 20000);

    holeTimers.current.push(ramp1, ramp2);
  }, [clearHoleTimers, resetHoles, scheduleNextHole]);

  /**
   * 停止所有蘋果活動（遊戲結束時）
   */
  const stopHoles = useCallback(() => {
    clearHoleTimers();
    resetHoles();
  }, [clearHoleTimers, resetHoles]);

  // ===== Socket 事件監聽 =====
  useEffect(() => {
    if (!socket) return;

    /**
     * 30 秒預告事件
     */
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

    /**
     * 遊戲開始事件
     */
    const onStart = ({ duration, reward: r, msLo, msHi, minApples, maxApples }) => {
      inputLockedRef.current = false;           // 解鎖輸入
      clearInterval(warnTimerRef.current);
      setWarnVisible(false);

      // 重置所有遊戲狀態
      setReward(r ?? 1);
      setMyScore(0); myScoreRef.current = 0;
      setCombo(0);   comboRef.current   = 0;
      setResult(null);
      setHitEffects([]);
      activePointerRef.current = null;
      lastWhackTimeRef.current = 0;
      setHammerPos({ x: -200, y: -200 });
      setHammerSwinging(false);

      // 設定自訂參數（若伺服器提供）
      if (msLo       !== undefined) appleMsLoRef.current       = msLo;
      if (msHi       !== undefined) appleMsHiRef.current       = msHi;
      if (minApples  !== undefined) initConcurrentRef.current  = minApples;
      if (maxApples  !== undefined) finalConcurrentRef.current = maxApples;

      phaseRef.current = "playing";
      setPhase("playing");

      // 啟動倒計時
      clearInterval(timerRef.current);
      let left = duration;
      setTimeLeft(left);
      timerRef.current = setInterval(() => {
        left--;
        setTimeLeft(left);
        if (left <= 0) clearInterval(timerRef.current);
      }, 1000);

      // 啟動蘋果冒出邏輯
      startHoles();
    };

    /**
     * 遊戲結束事件
     */
    const onEnd = ({ scores }) => {
      console.log("[WhackGame] onEnd received:", { scores });
      inputLockedRef.current = true;
      clearInterval(timerRef.current);
      stopHoles(); // 清除所有洞活動
      activePointerRef.current = null;
      setHammerSwinging(false);
      setResult(scores || {});
      phaseRef.current = "result";
      setPhase("result");

      // 如果自己有得分，直接更新本機金蘋果（避免等待 HTTP）
      if (scores?.[name] && typeof setApples === "function") {
        setApples(prev => prev + scores[name]);
        // 延遲再從伺服器確認一次（確保同步）
        setTimeout(() => { refreshMyApples(); }, 300);
      }
    };

    // 註冊事件監聽
    socket.on("whackGameWarn",  onWarn);
    socket.on("whackGameStart", onStart);
    socket.on("whackGameEnd",   onEnd);

    // 清除事件與所有計時器
    return () => {
      socket.off("whackGameWarn",  onWarn);
      socket.off("whackGameStart", onStart);
      socket.off("whackGameEnd",   onEnd);
      clearInterval(timerRef.current);
      clearInterval(warnTimerRef.current);
      clearHoleTimers();
      clearTimeout(comboTimer.current);
    };
  }, [socket, name, setApples, startHoles, stopHoles, refreshMyApples]);

  // 組件卸載時清理
  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(warnTimerRef.current);
    clearHoleTimers();
    clearTimeout(comboTimer.current);
  }, [clearHoleTimers]);

  // ===== 玩家輸入處理 =====

  /**
   * 釋放指針（觸控結束），用於多點觸控管理
   */
  const handlePointerRelease = useCallback((e) => {
    if (activePointerRef.current === e.pointerId) {
      activePointerRef.current = null;
    }
  }, []);

  /**
   * 移動錘子（跟隨鼠標或觸控）
   */
  const handleHammerMove = useCallback((e) => {
    if (inputLockedRef.current) return;
    if (phaseRef.current !== "playing") return;
    setHammerPos({ x: e.clientX, y: e.clientY });
  }, []);

  /**
   * 敲擊處理（觸發打擊判斷）
   */
  const handleHammerStrike = useCallback((e) => {
    if (inputLockedRef.current) return;
    if (phaseRef.current !== "playing") return;
    // 多點觸控保護：如果已有其他指針在進行打擊，忽略
    if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) return;

    const now = Date.now();
    // 冷卻檢查：防止過快連續打擊
    if (now - lastWhackTimeRef.current < WHACK_COOLDOWN_MS) return;

    const STRIKE_RADIUS = 80; // 打擊有效半徑 (px)
    let bestIdx = -1;
    let bestDist = Infinity;

    // 遍歷所有洞，找出最近且未被擊中且處於冒出狀態的洞
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

    // 播放揮擊動畫
    setHammerSwinging(true);
    setTimeout(() => setHammerSwinging(false), 280);

    if (bestIdx < 0) return; // 沒有擊中任何蘋果

    // 鎖定當前指針
    activePointerRef.current = e.pointerId;
    lastWhackTimeRef.current = now;

    // 將該洞標記為已擊中
    holeStateRef.current = holeStateRef.current.map((hole, idx) =>
      idx === bestIdx ? { up: true, whacked: true } : hole
    );
    setHoles([...holeStateRef.current]);

    // 增加本機得分
    myScoreRef.current++;
    setMyScore(myScoreRef.current);

    // Combo 增加
    comboRef.current++;
    setCombo(comboRef.current);
    clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
    }, 1500); // 1.5 秒內沒有連續打中則重置 Combo

    // 顯示 +1 特效
    const rect2 = holeRefs.current[bestIdx]?.getBoundingClientRect();
    const fx_x = rect2 ? rect2.left + rect2.width / 2 : e.clientX;
    const fx_y = rect2 ? rect2.top : e.clientY;
    const id = ++hitIdRef.current;
    setHitEffects(fx => [...fx, { id, x: fx_x, y: fx_y }]);
    setTimeout(() => setHitEffects(fx => fx.filter(f => f.id !== id)), 700);

    // 向伺服器發送打擊事件
    socket.emit("catchWhackApple", { token, room: RN });

    // 短暫延遲後清除該洞的蘋果，並排程下一個蘋果
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

  /**
   * 關閉結果畫面，返回空閒狀態
   */
  const dismissResult = useCallback(() => {
    inputLockedRef.current = true;
    setPhase("idle");
    setResult(null);
  }, []);

  // ===== 渲染 =====

  // ---------- 30 秒預告說明彈窗 ----------
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

  // 閒置狀態不渲染
  if (phase === "idle") return null;

  // ---------- 結果畫面 ----------
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

  // ─── 遊戲進行中畫面 ──────────────────────────────────────────────────────
  const urgency = timeLeft <= 10 ? "urgent" : timeLeft <= 20 ? "warning" : "";

  return (
    <div className="wag-overlay"
      onPointerMove={handleHammerMove}        // 跟隨指針移動錘子
      onPointerDown={handleHammerStrike}      // 按下時打擊
      onPointerUp={handlePointerRelease}      // 釋放指針
      onPointerCancel={handlePointerRelease}  // 取消觸控
      style={{ cursor: "none" }}              // 隱藏原始鼠標
    >
      {/* 錘子游標（跟隨鼠標/觸控位置） */}
      <div
        className={`wag-hammer${hammerSwinging ? " swinging" : ""}`}
        style={{ left: hammerPos.x, top: hammerPos.y }}
      >
        🔨
      </div>

      {/* 上方資訊 HUD */}
      <div className="wag-hud">
        <span className={`wag-timer ${urgency}`}>{timeLeft}</span>
        <span className="wag-timer-unit">秒</span>
        <span className="wag-score">🍎 ×{myScore}</span>
        <span className="wag-hint">移動槌子打金蘋果！每顆得 {reward} 個🍎</span>
      </div>

      {/* Combo 計數器（連續 2 次以上顯示） */}
      {combo >= 2 && (
        <div key={combo} className={`wag-combo ${combo >= 5 ? "fire" : combo >= 3 ? "hot" : ""}`}>
          {combo >= 7 ? "🔥🔥" : combo >= 5 ? "🔥" : "⚡"} COMBO ×{combo}!
        </div>
      )}

      {/* 浮動 +1 特效 */}
      {hitEffects.map(fx => (
        <div key={fx.id} className="wag-hit-effect" style={{ left: fx.x, top: fx.y }}>
          +1 🍎
        </div>
      ))}

      {/* 遊戲區域（3x3 洞陣列） */}
      <div className="wag-field">
        {/* 背景星星裝飾 */}
        <div className="wag-stars-bg" aria-hidden="true" />

        <div className="wag-holes-grid">
          {holes.map((hole, i) => (
            <div key={i} className="wag-hole-wrap" ref={el => holeRefs.current[i] = el}>
              {/* 裁剪區：蘋果從這裡滑出 */}
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
                  {/* 打中後的打擊特效 */}
                  {hole.whacked && (
                    <div className="wag-whack-fx" aria-hidden="true">
                      {comboRef.current >= 5 ? "💥🌟" : "💥"}
                    </div>
                  )}
                </div>
              </div>
              {/* 橢圓形洞口 */}
              <div className="wag-hole" />
            </div>
          ))}
        </div>

        {/* 地面裝飾 */}
        <div className="wag-ground" />
      </div>
    </div>
  );
}