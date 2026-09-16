// LittleMaryGame.jsx — 小瑪莉跑馬燈押注（僅金幣模式），右下角小卡片，版面/收合邏輯參考
// 推牌遊戲（PushCardGame.jsx）跟跑馬燈（MarqueeGame.jsx）。管理員在 ChatApp.jsx 觸發開局
// 後，玩家在下注時間內可對 1~8 個圖案各自下注（每筆金額立刻由伺服器扣款），時間到伺服器
// 開獎、依中獎圖案的賠率倍率派彩，這裡只負責顯示下注面板跟結果，牌局狀態完全以伺服器為準。

import { useState, useEffect, useRef, useCallback } from "react";
import "./LittleMaryGame.css";

import { RN, roomConfig } from "../../shared/roomConfig";

const RESULT_DISPLAY_MS = 6000;
const FALLBACK_BUFFER_MS = 3000;

export default function LittleMaryGame({ socket, token, name }) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState("betting"); // betting | result
  const [symbols, setSymbols] = useState([]);
  const [maxBetPerSymbol, setMaxBetPerSymbol] = useState(50);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [betInputs, setBetInputs] = useState({}); // symbolKey → 輸入框字串
  const [placedBets, setPlacedBets] = useState({}); // symbolKey → 已下注總額（伺服器確認過的）
  const [errorMsg, setErrorMsg] = useState("");
  const [outcome, setOutcome] = useState(null); // { winningSymbol, myBets, myWinAmount } | null

  const tickIntervalRef = useRef(null);
  const closeTimerRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const roundActiveRef = useRef(false);
  const tokenRef = useRef(token);

  useEffect(() => { tokenRef.current = token; }, [token]);

  const close = useCallback(() => {
    clearInterval(tickIntervalRef.current);
    clearTimeout(closeTimerRef.current);
    clearTimeout(fallbackTimerRef.current);
    tickIntervalRef.current = null;
    closeTimerRef.current = null;
    fallbackTimerRef.current = null;
    roundActiveRef.current = false;
    setVisible(false);
  }, []);

  useEffect(() => {
    const onBetOpen = ({ durationMs, symbols: syms, maxBetPerSymbol: maxBet, isAuto } = {}) => {
      close();
      roundActiveRef.current = true;
      setPhase("betting");
      setSymbols(Array.isArray(syms) ? syms : []);
      setMaxBetPerSymbol(Number(maxBet) || 50);
      setBetInputs({});
      setPlacedBets({});
      setErrorMsg("");
      setOutcome(null);
      setVisible(true);

      const totalSecs = Math.ceil((durationMs || 20000) / 1000);
      let s = totalSecs;
      setSecondsLeft(s);
      tickIntervalRef.current = setInterval(() => {
        s -= 1;
        setSecondsLeft(Math.max(0, s));
        if (s <= 0) {
          clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
        }
      }, 1000);

      fallbackTimerRef.current = setTimeout(close, (durationMs || 20000) + FALLBACK_BUFFER_MS);
    };

    const onResult = ({ winningSymbol, results } = {}) => {
      if (!roundActiveRef.current) return;
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;

      const mine = (results || []).find((r) => r.username === name);
      setOutcome({
        winningSymbol,
        myBets: mine?.bets || [],
        myWinAmount: mine?.winAmount || 0,
      });
      setPhase("result");
      setVisible(true);

      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(close, RESULT_DISPLAY_MS);
    };

    const onBetError = ({ reason } = {}) => {
      setErrorMsg(reason || "下注失敗");
    };

    const onBetAck = ({ symbol, totalOnSymbol } = {}) => {
      setPlacedBets((p) => ({ ...p, [symbol]: totalOnSymbol }));
      setBetInputs((p) => ({ ...p, [symbol]: "" }));
      setErrorMsg("");
    };

    socket.on("littleMaryBetOpen", onBetOpen);
    socket.on("littleMaryResult", onResult);
    socket.on("littleMaryBetError", onBetError);
    socket.on("littleMaryBetAck", onBetAck);

    return () => {
      socket.off("littleMaryBetOpen", onBetOpen);
      socket.off("littleMaryResult", onResult);
      socket.off("littleMaryBetError", onBetError);
      socket.off("littleMaryBetAck", onBetAck);
      close();
    };
  }, [socket, name, close]);

  const placeBet = useCallback((symbolKey) => {
    const raw = betInputs[symbolKey];
    const amount = Math.floor(Number(raw));
    if (!Number.isFinite(amount) || amount < 1) return;
    setErrorMsg("");
    socket.emit("littleMaryBet", { token: tokenRef.current, room: RN, symbol: symbolKey, amount });
  }, [socket, betInputs]);

  if (!visible) return null;

  const bettingOpen = phase === "betting" && secondsLeft > 0;

  return (
    <div className="lmg-corner">
      <button className="lmg-close" onClick={close} title="關閉">✖</button>
      <div className="lmg-header">
        <span className="lmg-title">🎡 小瑪莉</span>
        {phase === "betting" && <span className="lmg-timer">{secondsLeft}s</span>}
      </div>

      {phase === "betting" && (
        <div className="lmg-body">
          <p className="lmg-desc">
            {bettingOpen
              ? `選圖案下注（每圖案上限 ${maxBetPerSymbol} ${roomConfig.currency_unit || "枚"}），時間到自動開獎`
              : "下注時間已到，等待開獎…"}
          </p>
          {errorMsg && <p className="lmg-error">{errorMsg}</p>}
          <div className="lmg-symbol-grid">
            {symbols.map((sym) => {
              const placed = placedBets[sym.key] || 0;
              const remaining = Math.max(0, maxBetPerSymbol - placed);
              return (
                <div className="lmg-symbol-row" key={sym.key}>
                  <span className="lmg-symbol-label">{sym.label}</span>
                  <span className="lmg-symbol-mult">×{sym.multiplier}</span>
                  <input
                    type="number"
                    className="lmg-bet-input"
                    min={1}
                    max={remaining}
                    disabled={!bettingOpen || remaining <= 0}
                    value={betInputs[sym.key] || ""}
                    onChange={(e) => setBetInputs((p) => ({ ...p, [sym.key]: e.target.value }))}
                    placeholder={placed > 0 ? `已下${placed}` : ""}
                  />
                  <button
                    className="lmg-bet-btn"
                    disabled={!bettingOpen || remaining <= 0 || !betInputs[sym.key]}
                    onClick={() => placeBet(sym.key)}
                  >
                    下注
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {phase === "result" && outcome && (
        <div className="lmg-body lmg-result">
          <div className="lmg-winning-symbol">
            開獎：<span className="lmg-winning-value">{outcome.winningSymbol?.label}</span>
            <span className="lmg-winning-mult">×{outcome.winningSymbol?.multiplier}</span>
          </div>
          {outcome.myBets.length === 0 ? (
            <p className="lmg-lose">這局你沒有下注</p>
          ) : outcome.myWinAmount > 0 ? (
            <p className="lmg-win">🎉 恭喜中獎！獲得 {outcome.myWinAmount} 個{roomConfig.currency_name}</p>
          ) : (
            <p className="lmg-lose">沒有押中，下次再接再厲</p>
          )}
        </div>
      )}
    </div>
  );
}
