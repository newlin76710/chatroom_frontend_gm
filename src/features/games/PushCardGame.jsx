// PushCardGame.jsx — 推牌遊戲（右下角小卡片，玩法/版面參考跑馬燈 MarqueeGame.jsx）
// 站長觸發後，其他人在時限內可選擇參加並下注（1~上限顆）或不參加；不參加直接關閉，
// 參加時金額立刻由伺服器扣款，時間到伺服器會發一張紅心 1~10 的牌互相比大小，
// 比站長大就贏（1 賠 1：拿回本金+等額彩金），平手算站長贏，輸了本金已經扣了、歸系統。
//
// Socket 事件：
//   接收 (in):
//     pushCardStart      { durationMs, hostName, maxBet, minBet }
//     pushCardEnd        { hostName, hostCard, results: [{ username, card, bet, win, tie }] }
//     joinPushCardError  { reason }
//   發送 (out):
//     joinPushCard   { token, room, bet }

import { useState, useEffect, useRef, useCallback } from "react";
import "./PushCardGame.css";

import { RN, roomConfig } from "../../shared/roomConfig";

const RESULT_DISPLAY_MS = 6000;
const FALLBACK_BUFFER_MS = 3000;
const DEFAULT_MIN_BET = 1;
const DEFAULT_MAX_BET = 50;

export default function PushCardGame({ socket, token, name, apples }) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState("prompt"); // prompt | waiting | result
  const [hostName, setHostName] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [minBet, setMinBet] = useState(DEFAULT_MIN_BET);
  const [maxBet, setMaxBet] = useState(DEFAULT_MAX_BET);
  const [betInput, setBetInput] = useState(String(DEFAULT_MIN_BET));
  const [joinError, setJoinError] = useState("");
  const [outcome, setOutcome] = useState(null); // { hostCard, myCard, myBet, win, tie } | null（沒參加或沒中）

  const tickIntervalRef = useRef(null);
  const closeTimerRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const roundActiveRef = useRef(false);
  const joinedRef = useRef(false);
  const phaseRef = useRef("prompt");
  const tokenRef = useRef(token);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const close = useCallback(() => {
    clearInterval(tickIntervalRef.current);
    clearTimeout(closeTimerRef.current);
    clearTimeout(fallbackTimerRef.current);
    tickIntervalRef.current = null;
    closeTimerRef.current = null;
    fallbackTimerRef.current = null;
    roundActiveRef.current = false;
    joinedRef.current = false;
    setJoinError("");
    setVisible(false);
  }, []);

  useEffect(() => {
    const onStart = ({ durationMs, hostName: host, minBet: mb, maxBet: xb }) => {
      if (host === name) return; // 站長自己不用選擇要不要參加

      close();
      roundActiveRef.current = true;
      joinedRef.current = false;
      setHostName(host);
      setPhase("prompt");
      setOutcome(null);
      setJoinError("");
      const lo = Number.isFinite(mb) ? mb : DEFAULT_MIN_BET;
      const hi = Number.isFinite(xb) ? xb : DEFAULT_MAX_BET;
      setMinBet(lo);
      setMaxBet(hi);
      setBetInput(String(lo));
      setVisible(true);

      const totalSecs = Math.ceil((durationMs || 10000) / 1000);
      let s = totalSecs;
      setSecondsLeft(s);
      tickIntervalRef.current = setInterval(() => {
        s -= 1;
        setSecondsLeft(Math.max(0, s));
        if (s <= 0) {
          clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
          // 時間到了還沒決定：視同不參加，直接關閉
          if (phaseRef.current === "prompt") close();
        }
      }, 1000);

      fallbackTimerRef.current = setTimeout(close, (durationMs || 10000) + FALLBACK_BUFFER_MS);
    };

    const onEnd = ({ hostName: host, hostCard, results }) => {
      if (!roundActiveRef.current) return; // 使用者已經關掉/沒參加，遲來的結果不用管
      if (host === name) { close(); return; }
      if (!joinedRef.current) { close(); return; }

      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;

      const mine = (results || []).find((r) => r.username === name);
      setOutcome({
        hostCard,
        myCard: mine?.card ?? null,
        myBet: mine?.bet ?? 0,
        win: !!mine?.win,
        tie: !!mine?.tie,
      });
      setPhase("result");
      setVisible(true);

      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(close, RESULT_DISPLAY_MS);
    };

    const onJoinError = ({ reason }) => {
      // 下注被伺服器拒絕（金額不合法/餘額不足）：退回選擇畫面，讓使用者改金額或放棄參加
      joinedRef.current = false;
      setJoinError(reason || "參加失敗");
      setPhase("prompt");
    };

    socket.on("pushCardStart", onStart);
    socket.on("pushCardEnd", onEnd);
    socket.on("joinPushCardError", onJoinError);

    return () => {
      socket.off("pushCardStart", onStart);
      socket.off("pushCardEnd", onEnd);
      socket.off("joinPushCardError", onJoinError);
      close();
    };
  }, [socket, name, close]);

  const parsedBet = Math.floor(Number(betInput));
  const betValid = Number.isFinite(parsedBet) && parsedBet >= minBet && parsedBet <= maxBet
    && (apples == null || parsedBet <= apples);

  const handleJoin = useCallback(() => {
    if (!betValid) return;
    joinedRef.current = true;
    setJoinError("");
    // 牌完全由伺服器擲，這裡只送下注金額
    socket.emit("joinPushCard", { token: tokenRef.current, room: RN, bet: parsedBet });
    setPhase("waiting");
  }, [socket, betValid, parsedBet]);

  const handleDecline = useCallback(() => {
    close();
  }, [close]);

  if (!visible) return null;

  return (
    <div className="pcg-corner">
      <button className="pcg-close" onClick={close} title="關閉">✖</button>
      <div className="pcg-header">
        <span className="pcg-title">🃏 推牌遊戲</span>
        {phase !== "result" && <span className="pcg-timer">{secondsLeft}s</span>}
      </div>

      {phase === "prompt" && (
        <div className="pcg-body">
          <p className="pcg-desc">站長邀請你推牌比大小，比較大 1 賠 1，平手算站長贏，是否參加？</p>
          <div className="pcg-bet-row">
            <span>下注</span>
            <input
              type="number"
              className="pcg-bet-input"
              min={minBet}
              max={maxBet}
              value={betInput}
              onChange={(e) => setBetInput(e.target.value)}
            />
            <span>顆（{minBet}~{maxBet}）</span>
          </div>
          {joinError && <p className="pcg-error">{joinError}</p>}
          <div className="pcg-actions">
            <button className="pcg-btn pcg-btn-join" onClick={handleJoin} disabled={!betValid}>參加</button>
            <button className="pcg-btn pcg-btn-decline" onClick={handleDecline}>不參加</button>
          </div>
        </div>
      )}

      {phase === "waiting" && (
        <div className="pcg-body">
          <p className="pcg-desc">已參加，等待開牌…</p>
        </div>
      )}

      {phase === "result" && outcome && (
        <div className="pcg-body pcg-result">
          <div className="pcg-cards">
            <div className="pcg-card-slot">
              <span className="pcg-card-label">站長</span>
              <span className="pcg-card-value">🂠 紅心{outcome.hostCard}</span>
            </div>
            <span className="pcg-vs">VS</span>
            <div className="pcg-card-slot">
              <span className="pcg-card-label">你</span>
              <span className="pcg-card-value">🂠 紅心{outcome.myCard}</span>
            </div>
          </div>
          {outcome.win ? (
            <p className="pcg-win">🎉 你比較大！下注 {outcome.myBet} 顆，1 賠 1 拿回 {outcome.myBet * 2} 個{roomConfig.currency_name}</p>
          ) : outcome.tie ? (
            <p className="pcg-lose">跟站長平手（平手算站長贏），下注的 {outcome.myBet} 顆歸系統</p>
          ) : (
            <p className="pcg-lose">沒有比站長大，下注的 {outcome.myBet} 顆歸系統</p>
          )}
        </div>
      )}
    </div>
  );
}
