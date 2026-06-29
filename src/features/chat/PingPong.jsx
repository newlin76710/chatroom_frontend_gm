import { useState, useEffect, useRef, useCallback } from "react";
import "./PingPong.css";

const PADDLE_THROTTLE = 30;

export default function PingPong({ socket, room, name, pendingTarget, onClearPending, onActiveChange }) {
  const [phase, setPhase]     = useState("idle"); // idle | incoming | outgoing | countdown | playing
  const [gameInfo, setGameInfo] = useState(null);
  const [gs, setGs]           = useState(null);
  const [countdown, setCountdown] = useState(3);
  const [errMsg, setErrMsg]   = useState(null); // independent right-side toast

  const fieldRef      = useRef(null);
  const lastSendRef   = useRef(0);
  const errTimerRef   = useRef(null);
  const gameInfoRef   = useRef(null);
  const phaseRef      = useRef(phase);
  gameInfoRef.current = gameInfo;
  phaseRef.current    = phase;

  const showErrMsg = useCallback((msg) => {
    setErrMsg(msg);
    if (errTimerRef.current) clearTimeout(errTimerRef.current);
    errTimerRef.current = setTimeout(() => setErrMsg(null), 4000);
  }, []);

  // Notify ChatApp whenever we enter or leave an active state
  useEffect(() => {
    onActiveChange?.(phase !== "idle");
  }, [phase]);

  useEffect(() => {
    if (!pendingTarget) return;
    if (phaseRef.current !== "idle") {
      onClearPending?.();
      return;
    }
    setPhase("outgoing");
    setGameInfo({ challenger: name, target: pendingTarget });
  }, [pendingTarget]);

  const resetAll = useCallback(() => {
    setPhase("idle");
    setGameInfo(null);
    setGs(null);
    onClearPending?.();
  }, [onClearPending]);

  useEffect(() => {
    if (!socket) return;

    const onChallengeReceived = ({ challenger }) => {
      setPhase("incoming");
      setGameInfo({ challenger, target: name });
    };
    const onChallengeCancelled = () => {
      setPhase(p => p === "incoming" ? "idle" : p);
    };
    const onStart = ({ challenger, target }) => {
      onClearPending?.();
      setGameInfo({ challenger, target });
      setGs(null);
      setCountdown(3);
      setPhase("countdown");
    };
    // Terminal: resets game state
    const onCancelled = ({ reason }) => {
      resetAll();
      showErrMsg(reason);
    };
    // Non-terminal: show toast; if stuck in outgoing (challenge rejected), also reset
    const onError = ({ reason }) => {
      showErrMsg(reason);
      if (phaseRef.current === "outgoing") resetAll();
    };
    const onState = (data) => setGs(data);
    const onGameDone = () => resetAll();

    socket.on("pingpongChallengeReceived",  onChallengeReceived);
    socket.on("pingpongChallengeCancelled", onChallengeCancelled);
    socket.on("pingpongStart",              onStart);
    socket.on("pingpongCancelled",          onCancelled);
    socket.on("pingpongError",              onError);
    socket.on("pingpongState",              onState);
    socket.on("pingpongGameDone",           onGameDone);
    return () => {
      socket.off("pingpongChallengeReceived",  onChallengeReceived);
      socket.off("pingpongChallengeCancelled", onChallengeCancelled);
      socket.off("pingpongStart",             onStart);
      socket.off("pingpongCancelled",         onCancelled);
      socket.off("pingpongError",             onError);
      socket.off("pingpongState",             onState);
      socket.off("pingpongGameDone",          onGameDone);
    };
  }, [socket, resetAll, showErrMsg]);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { setPhase("playing"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Paddle
  const sendPaddle = useCallback((clientX) => {
    const now = Date.now();
    if (now - lastSendRef.current < PADDLE_THROTTLE) return;
    lastSendRef.current = now;
    const info = gameInfoRef.current;
    if (!info || !fieldRef.current) return;
    const rect    = fieldRef.current.getBoundingClientRect();
    const relX    = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const fieldW  = gs?.fieldW ?? 300;
    socket.emit("pingpongPaddleMove", {
      room, challenger: info.challenger, target: info.target,
      x: (relX / rect.width) * fieldW,
    });
  }, [socket, room, gs]);

  const handleMouseMove = useCallback((e) => sendPaddle(e.clientX), [sendPaddle]);
  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    sendPaddle(e.touches[0].clientX);
  }, [sendPaddle]);

  let display = null;
  if (gs) {
    const { ballX, ballY, challengerPaddleX, targetPaddleX,
            challengerScore, targetScore, myRole,
            fieldW = 300, fieldH = 200, paddleW = 80, paddleH = 10, ballR = 8 } = gs;
    const isTarget   = myRole === "target";
    const dispBallY  = isTarget ? fieldH - ballY : ballY;
    const myPaddleX  = isTarget ? targetPaddleX  : challengerPaddleX;
    const oppPaddleX = isTarget ? challengerPaddleX : targetPaddleX;
    const myScore    = isTarget ? targetScore    : challengerScore;
    const oppScore   = isTarget ? challengerScore : targetScore;
    const opponent   = gameInfo
      ? (gameInfo.challenger === name ? gameInfo.target : gameInfo.challenger) : "?";
    display = {
      bL: `calc(${ballX / fieldW * 100}% - ${ballR}px)`,
      bT: `calc(${dispBallY / fieldH * 100}% - ${ballR}px)`,
      myL:  `calc(${myPaddleX  / fieldW * 100}% - ${paddleW / 2}px)`,
      oppL: `calc(${oppPaddleX / fieldW * 100}% - ${paddleW / 2}px)`,
      paddleStyle: { width: paddleW, height: paddleH },
      ballR, myScore, oppScore, opponent,
    };
  }

  const inGame = phase === "playing" || phase === "countdown";

  return (
    <>
      {/* Independent right-side error toast — never affects game state */}
      {errMsg && (
        <div className="pp-error-toast">
          <span>{errMsg}</span>
          <button className="pp-close-btn" onClick={() => setErrMsg(null)}>✕</button>
        </div>
      )}

      {phase !== "idle" && (
        <div className="pp-overlay">
          {phase === "incoming" && (
            <div className="pp-modal">
              <div className="pp-title">🏓 乒乓球邀請</div>
              <div className="pp-desc">{gameInfo?.challenger} 向你發起乒乓球！</div>
              <div className="pp-actions">
                <button className="pp-btn pp-accept" onClick={() =>
                  socket.emit("pingpongAccept", { room, challenger: gameInfo.challenger, target: name })
                }>接受</button>
                <button className="pp-btn pp-decline" onClick={() => {
                  socket.emit("pingpongDecline", { room, challenger: gameInfo.challenger, target: name });
                  setPhase("idle"); setGameInfo(null);
                }}>拒絕</button>
              </div>
            </div>
          )}

          {phase === "outgoing" && (
            <div className="pp-modal">
              <div className="pp-title">🏓 乒乓球邀請</div>
              <div className="pp-desc">已向 {gameInfo?.target} 發出邀請，等待接受…</div>
              <button className="pp-btn pp-decline" onClick={() => {
                socket.emit("pingpongCancel", { room, challenger: name, target: gameInfo.target });
                resetAll();
              }}>取消</button>
            </div>
          )}

          {inGame && (
            <div className="pp-modal pp-game">
              <div className="pp-header">
                <span className="pp-player">{name}</span>
                <span className="pp-scoreboard">
                  <span className="pp-score">{display?.myScore ?? 0}</span>
                  <span className="pp-colon"> : </span>
                  <span className="pp-score">{display?.oppScore ?? 0}</span>
                </span>
                <span className="pp-player pp-opp-name">{display?.opponent ?? "…"}</span>
              </div>

              <div
                ref={fieldRef}
                className="pp-field"
                onMouseMove={handleMouseMove}
                onTouchMove={handleTouchMove}
                style={{ touchAction: "none" }}
              >
                {display ? (
                  <>
                    <div className="pp-paddle pp-opp-paddle"
                      style={{ ...display.paddleStyle, left: display.oppL }} />
                    <div className="pp-ball"
                      style={{ width: display.ballR * 2, height: display.ballR * 2,
                               left: display.bL, top: display.bT }} />
                    <div className="pp-paddle pp-my-paddle"
                      style={{ ...display.paddleStyle, left: display.myL }} />
                    {gs?.gameState === "resetting" && (
                      gs.serveCountdown > 0
                        ? <div className="pp-serve-countdown">{gs.serveCountdown}</div>
                        : <div className="pp-score-flash">得分！</div>
                    )}
                  </>
                ) : (
                  <div className="pp-waiting-start">準備中…</div>
                )}

                {phase === "countdown" && (
                  <div className="pp-countdown-overlay">
                    <div className="pp-countdown">{countdown}</div>
                  </div>
                )}
              </div>

              <div className="pp-hint">移動滑鼠 / 觸控控制球拍</div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
