import { lazy, Suspense, useState } from "react";
import "./CasinoPanel.css";
import { roomConfig } from "../../shared/roomConfig";

const RouletteGame = lazy(() => import("./RouletteGame"));
const BlackjackGame = lazy(() => import("./BlackjackGame"));
const SicBoGame = lazy(() => import("./SicBoGame"));
const SlotMachine = lazy(() => import("./SlotMachine"));
const BaccaratGame = lazy(() => import("./BaccaratGame"));
const PusherMachine = lazy(() => import("./PusherMachine"));
const RacingGame = lazy(() => import("./RacingGame"));
const ZombieSurvivalGame = lazy(() => import("./ZombieSurvivalGame"));

const getRules = () => `🎰 ${roomConfig.currency_name}輪盤 遊戲規則

【賠率】
數字 0–36  ×36　大/小/紅/黑  ×2
🔴大/🔴小/⚫大/⚫小（組合）  ×4

【規則】
• 0 為綠色，除數字外全輸
• 可多選，每種各自扣注、各自結算
• 猜中數字全場廣播獲獎訊息
• 單注上限 50 顆，開放 13:00–00:00

【流程】
1. 選類型＋金額（可多選）
2. 點「開始旋轉」，金額立即扣除
3. 旋轉 10 秒後公佈結果
4. 中獎自動入帳`;

export default function CasinoPanel({ token, apples, onApplesChange, open, onClose, variant = "casino", includePusher = true }) {
  const isPlayground = variant === "playground";
  const [tab, setTab] = useState(isPlayground ? "pusher" : "blackjack");
  const [showRules, setShowRules] = useState(false);

  // 遊樂場面板即使關閉也保持掛載（改用隱藏），推幣機的桌面局面才不會每次重開都重新排列
  if (!open && !isPlayground) return null;

  return (
    <div
      className="casino-overlay"
      style={open ? undefined : { display: "none" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="casino-panel">

        {/* ── Light bulbs top ── */}
        <div className="casino-lights top">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="casino-bulb" style={{ animationDelay: `${(i * 0.11).toFixed(2)}s` }} />
          ))}
        </div>

        {/* ── Header ── */}
        <div className="casino-header">
          <span className="casino-title">{isPlayground ? "🎡 遊樂場" : "🎰 娛樂城"}</span>
          <div className="casino-header-right">
            {/* Rules button */}
            <div className="casino-rules-wrap">
              {/* <button
                className="casino-rules-btn"
                onMouseEnter={() => setShowRules(true)}
                onMouseLeave={() => setShowRules(false)}
                onClick={() => setShowRules(v => !v)}
              >？</button> */}
              {showRules && (
                <div className="casino-rules-tooltip">
                  <pre>{getRules()}</pre>
                </div>
              )}
            </div>
            <button className="casino-close-btn" onClick={onClose}>✖</button>
          </div>
        </div>

        {/* ── Apples display ── */}
        <div className="casino-apples">
          <img src={`/gifts/${roomConfig.currency_icon}`} alt={roomConfig.currency_name} style={{ width: 18, height: 18, verticalAlign: "middle" }} />
          {" "}{apples != null ? apples : "–"} 個{roomConfig.currency_name}
        </div>

        {/* ── Tabs ── */}
        <div className="casino-tabs">
          {isPlayground ? (
            <>
              <button
                className={`casino-tab ${tab === "pusher" ? "active" : ""}`}
                onClick={() => setTab("pusher")}
              >🎰 推幣機</button>
              <button
                className={`casino-tab ${tab === "race" ? "active" : ""}`}
                onClick={() => setTab("race")}
              >🏎️ 賽車</button>
              <button
                className={`casino-tab ${tab === "zombie" ? "active" : ""}`}
                onClick={() => setTab("zombie")}
              >🧟 殭屍生存戰</button>
            </>
          ) : (
            <>
              <button
                className={`casino-tab ${tab === "blackjack" ? "active" : ""}`}
                onClick={() => setTab("blackjack")}
              >🃏 21點</button>
              <button
                className={`casino-tab ${tab === "roulette" ? "active" : ""}`}
                onClick={() => setTab("roulette")}
              >🎡 輪盤</button>
              <button
                className={`casino-tab ${tab === "sicbo" ? "active" : ""}`}
                onClick={() => setTab("sicbo")}
              >🎲 骰寶</button>
              <button
                className={`casino-tab ${tab === "slot" ? "active" : ""}`}
                onClick={() => setTab("slot")}
              >🎰 老虎機</button>
              <button
                className={`casino-tab ${tab === "baccarat" ? "active" : ""}`}
                onClick={() => setTab("baccarat")}
              >🀄 百家樂</button>
              {includePusher && (
                <button
                  className={`casino-tab ${tab === "pusher" ? "active" : ""}`}
                  onClick={() => setTab("pusher")}
                >🎰 推幣機</button>
              )}
            </>
          )}
        </div>

        {/* ── Game area ── */}
        <div className="casino-body">
          <Suspense fallback={null}>
            {isPlayground ? (
              <>
                {/* 推幣機常駐掛載（用隱藏取代卸載），切分頁或關閉再打開遊樂場都不會重新排列桌面 */}
                <div style={{ display: tab === "pusher" ? "contents" : "none" }}>
                  <PusherMachine
                    token={token}
                    apples={apples}
                    onApplesChange={onApplesChange}
                    visible={open && tab === "pusher"}
                  />
                </div>
                {tab === "race" && (
                  <RacingGame
                    token={token}
                    apples={apples}
                    onApplesChange={onApplesChange}
                  />
                )}
                {tab === "zombie" && (
                  <ZombieSurvivalGame
                    token={token}
                    apples={apples}
                    onApplesChange={onApplesChange}
                  />
                )}
              </>
            ) : (
              <>
                {tab === "blackjack" && (
                  <BlackjackGame
                    token={token}
                    apples={apples}
                    onApplesChange={onApplesChange}
                  />
                )}
                {tab === "roulette" && (
                  <RouletteGame
                    token={token}
                    apples={apples}
                    onApplesChange={onApplesChange}
                  />
                )}
                {tab === "sicbo" && (
                  <SicBoGame
                    token={token}
                    apples={apples}
                    onApplesChange={onApplesChange}
                  />
                )}
                {tab === "slot" && (
                  <SlotMachine
                    token={token}
                    apples={apples}
                    onApplesChange={onApplesChange}
                  />
                )}
                {tab === "baccarat" && (
                  <BaccaratGame
                    token={token}
                    apples={apples}
                    onApplesChange={onApplesChange}
                  />
                )}
                {includePusher && (
                  <div style={{ display: tab === "pusher" ? "contents" : "none" }}>
                    <PusherMachine
                      token={token}
                      apples={apples}
                      onApplesChange={onApplesChange}
                      visible={open && tab === "pusher"}
                    />
                  </div>
                )}
              </>
            )}
          </Suspense>
        </div>

        {/* ── Light bulbs bottom ── */}
        <div className="casino-lights bottom">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="casino-bulb" style={{ animationDelay: `${(i * 0.11 + 0.05).toFixed(2)}s` }} />
          ))}
        </div>

      </div>
    </div>
  );
}
