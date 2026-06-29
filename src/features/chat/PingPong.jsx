import { useState, useEffect, useRef, useCallback } from "react";
import "./PingPong.css";

const PADDLE_THROTTLE = 30; // ms between paddle move emits

export default function PingPong({ socket, room, name, pendingTarget, onClearPending }) {
  const [phase, setPhase]       = useState("idle"); // idle | incoming | outgoing | countdown | playing
  const [gameInfo, setGameInfo] = useState(null);   // { challenger, target }
  const [gs, setGs]             = useState(null);   // latest pingpongState from server
  const [cancelled, setCancelled] = useState(null);
  const [countdown, setCountdown] = useState(3);

  const fieldRef       = useRef(null);
  const lastSendRef    = useRef(0);
  const cancelTimerRef = useRef(null);
  const gameInfoRef    = useRef(null);
  gameInfoRef.current  = gameInfo;

  // Outgoing challenge signalled by ChatApp
  useEffect(() => {
    if (!pendingTarget) return;
    setPhase("outgoing");
    setGameInfo({ challenger: name, target: pendingTarget });
  }, [pendingTarget]);

  const showCancelMsg = (msg) => {
    setCancelled(msg);
    if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
    cancelTimerRef.current = setTimeout(() => setCancelled(null), 3000);
  };

  const resetAll = useCallback(() => {
    setPhase("idle");
    setGameInfo(null);
    setGs(null);
    onClearPending?.();
  }, [onClearPending]);

  // Socket events
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
    const onCancelled = ({ reason }) => {
      resetAll();
      showCancelMsg(reason);
    };
    const onState = (data) => {
      setGs(data);
    };
    const onGameDone = () => {
      resetAll();
    };

    socket.on("pingpongChallengeReceived",  onChallengeReceived);
    socket.on("pingpongChallengeCancelled", onChallengeCancelled);
    socket.on("pingpongStart",              onStart);
    socket.on("pingpongCancelled",          onCancelled);
    socket.on("pingpongState",              onState);
    socket.on("pingpongGameDone",           onGameDone);
    return () => {
      socket.off("pingpongChallengeReceived",  onChallengeReceived);
      socket.off("pingpongChallengeCancelled", onChallengeCancelled);
      socket.off("pingpongStart",             onStart);
      socket.off("pingpongCancelled",         onCancelled);
      socket.off("pingpongState",             onState);
      socket.off("pingpongGameDone",          onGameDone);
    };
  }, [socket, resetAll]);

  // Countdown before game starts
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { setPhase("playing"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Paddle move: throttled, sends logical X (0..fieldW)
  const sendPaddle = useCallback((clientX) => {
    const now = Date.now();
    if (now - lastSendRef.current < PADDLE_THROTTLE) return;
    lastSendRef.current = now;
    const info = gameInfoRef.current;
    if (!info || !fieldRef.current) return;
    const rect    = fieldRef.current.getBoundingClientRect();
    const relX    = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const fieldW  = gs?.fieldW ?? 300;
    const logicalX = (relX / rect.width) * fieldW;
    socket.emit("pingpongPaddleMove", {
      room,
      challenger: info.challenger,
      target:     info.target,
      x: logicalX,
    });
  }, [socket, room, gs]);

  const handleMouseMove  = useCallback((e) => sendPaddle(e.clientX), [sendPaddle]);
  const handleTouchMove  = useCallback((e) => {
    e.preventDefault();
    sendPaddle(e.touches[0].clientX);
  }, [sendPaddle]);

  // Derived display values
  let display = null;
  if (gs) {
    const { ballX, ballY, challengerPaddleX, targetPaddleX,
            challengerScore, targetScore, myRole,
            fieldW = 300, fieldH = 200, paddleW = 80, paddleH = 10, ballR = 8 } = gs;

    const isTarget    = myRole === 'target';
    const dispBallX   = ballX;
    const dispBallY   = isTarget ? fieldH - ballY : ballY;
    const myPaddleX   = isTarget ? targetPaddleX : challengerPaddleX;
    const oppPaddleX  = isTarget ? challengerPaddleX : targetPaddleX;
    const myScore     = isTarget ? targetScore : challengerScore;
    const oppScore    = isTarget ? challengerScore : targetScore;
    const opponent    = gameInfo
      ? (gameInfo.challenger === name ? gameInfo.target : gameInfo.challenger)
      : "?";

    const bL = `calc(${dispBallX / fieldW * 100}% - ${ballR}px)`;
    const bT = `calc(${dispBallY / fieldH * 100}% - ${ballR}px)`;
    const myL   = `calc(${myPaddleX  / fieldW * 100}% - ${paddleW / 2}px)`;
    const oppL  = `calc(${oppPaddleX / fieldW * 100}% - ${paddleW / 2}px)`;
    const paddleStyle = { width: paddleW, height: paddleH };

    display = { bL, bT, myL, oppL, paddleStyle, ballR, myScore, oppScore, opponent };
  }

  return (
    <>
      {cancelled && <div className="pp-toast">{cancelled}</div>}

      {phase !== "idle" && (
        <div className="pp-overlay">
          {/* Incoming */}
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

          {/* Outgoing */}
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

          {/* Playing (also shown during countdown so paddles stay active) */}
          {(phase === "playing" || phase === "countdown") && (
            <div className="pp-modal pp-game">
              {/* Score header */}
              <div className="pp-header">
                <span className="pp-player">{name}</span>
                <span className="pp-scoreboard">
                  <span className="pp-score">{display?.myScore ?? 0}</span>
                  <span className="pp-colon"> : </span>
                  <span className="pp-score">{display?.oppScore ?? 0}</span>
                </span>
                <span className="pp-player pp-opp-name">{display?.opponent ?? "…"}</span>
              </div>

              {/* Game field */}
              <div
                ref={fieldRef}
                className="pp-field"
                onMouseMove={handleMouseMove}
                onTouchMove={handleTouchMove}
                style={{ touchAction: "none" }}
              >
                {display ? (
                  <>
                    {/* Opponent paddle (top) */}
                    <div className="pp-paddle pp-opp-paddle"
                      style={{ ...display.paddleStyle, left: display.oppL }} />

                    {/* Ball */}
                    <div className="pp-ball"
                      style={{ width: display.ballR * 2, height: display.ballR * 2,
                               left: display.bL, top: display.bT }} />

                    {/* My paddle (bottom) */}
                    <div className="pp-paddle pp-my-paddle"
                      style={{ ...display.paddleStyle, left: display.myL }} />

                    {gs?.gameState === 'resetting' && (
                      <div className="pp-score-flash">得分！</div>
                    )}
                  </>
                ) : (
                  <div className="pp-waiting-start">準備中…</div>
                )}

                {/* Countdown overlay on top of field */}
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
