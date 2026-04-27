import { useState } from "react";
import RouletteGame from "./RouletteGame";
import BlackjackGame from "./BlackjackGame";
import "./CasinoPanel.css";

const RULES = `🎰 金蘋果輪盤 遊戲規則

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

export default function CasinoPanel({ token, apples, onApplesChange, open, onClose }) {
  const [tab, setTab] = useState("blackjack");
  const [showRules, setShowRules] = useState(false);

  if (!open) return null;

  return (
    <div className="casino-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="casino-panel">

        {/* ── Light bulbs top ── */}
        <div className="casino-lights top">
          {Array.from({ length: 18 }).map((_, i) => (
            <span key={i} className="casino-bulb" style={{ animationDelay: `${(i * 0.11).toFixed(2)}s` }} />
          ))}
        </div>

        {/* ── Header ── */}
        <div className="casino-header">
          <span className="casino-title">🎰 娛樂城</span>
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
                  <pre>{RULES}</pre>
                </div>
              )}
            </div>
            <button className="casino-close-btn" onClick={onClose}>✖</button>
          </div>
        </div>

        {/* ── Apples display ── */}
        <div className="casino-apples">
          <img src="/gifts/gold_apple.gif" alt="金蘋果" style={{ width: 18, height: 18, verticalAlign: "middle" }} />
          {" "}{apples != null ? apples : "–"} 個金蘋果
        </div>

        {/* ── Tabs ── */}
        <div className="casino-tabs">
          <button
            className={`casino-tab ${tab === "blackjack" ? "active" : ""}`}
            onClick={() => setTab("blackjack")}
          >🃏 21點</button>
          <button
            className={`casino-tab ${tab === "roulette" ? "active" : ""}`}
            onClick={() => setTab("roulette")}
          >🎡 輪盤</button>
        </div>

        {/* ── Game area ── */}
        <div className="casino-body">
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
