import { useState, useEffect, useRef } from "react";
import "./RPS.css";

const CHOICES = [
  { key: "rock",     label: "✊", name: "石頭" },
  { key: "scissors", label: "✌️", name: "剪刀" },
  { key: "paper",    label: "🖐️", name: "布" },
];

export default function RPS({ socket, room, name, pendingTarget, onClearPending, onActiveChange }) {
  // state: idle | incoming | outgoing | choosing | chosen
  const [phase, setPhase] = useState("idle");
  const [gameInfo, setGameInfo] = useState(null); // { challenger, target }
  const [myChoice, setMyChoice] = useState(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [cancelled, setCancelled] = useState(null); // terminal cancel message
  const [errMsg, setErrMsg]       = useState(null); // independent right-side toast
  const countdownRef = useRef(null);
  const cancelMsgRef = useRef(null);
  const errTimerRef  = useRef(null);

  // Notify ChatApp whenever we enter or leave an active state
  useEffect(() => {
    onActiveChange?.(phase !== "idle");
  }, [phase]);

  // When ChatApp signals an outgoing challenge
  useEffect(() => {
    if (!pendingTarget) return;
    if (phase !== "idle") {
      // Already in a game — reject and clear so ChatApp doesn't think it's pending
      onClearPending?.();
      return;
    }
    setPhase("outgoing");
    setGameInfo({ challenger: name, target: pendingTarget });
  }, [pendingTarget]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const onChallengeReceived = ({ challenger }) => {
      setPhase("incoming");
      setGameInfo({ challenger, target: name });
    };

    const onChallengeCancelled = () => {
      if (phase === "incoming") {
        setPhase("idle");
        setGameInfo(null);
      }
    };

    const onStart = ({ challenger, target }) => {
      onClearPending?.();
      setPhase("choosing");
      setGameInfo({ challenger, target });
      setMyChoice(null);
      setTimeLeft(10);
    };

    const onCancelled = ({ reason }) => {
      onClearPending?.();
      setPhase("idle");
      setGameInfo(null);
      showCancelMsg(reason);
    };

    const onGameDone = () => {
      setPhase("idle");
      setGameInfo(null);
      setMyChoice(null);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };

    const onError = ({ reason }) => {
      setErrMsg(reason);
      if (errTimerRef.current) clearTimeout(errTimerRef.current);
      errTimerRef.current = setTimeout(() => setErrMsg(null), 4000);
      // If we're stuck in outgoing (challenge was rejected before going through), reset
      if (phase === "outgoing") {
        onClearPending?.();
        setPhase("idle");
        setGameInfo(null);
      }
    };

    socket.on("rpsChallengeReceived",  onChallengeReceived);
    socket.on("rpsChallengeCancelled", onChallengeCancelled);
    socket.on("rpsStart",              onStart);
    socket.on("rpsCancelled",          onCancelled);
    socket.on("rpsError",              onError);
    socket.on("rpsGameDone",           onGameDone);

    return () => {
      socket.off("rpsChallengeReceived",  onChallengeReceived);
      socket.off("rpsChallengeCancelled", onChallengeCancelled);
      socket.off("rpsStart",             onStart);
      socket.off("rpsCancelled",         onCancelled);
      socket.off("rpsError",             onError);
      socket.off("rpsGameDone",          onGameDone);
    };
  }, [socket, phase]);

  // Countdown when in choosing / chosen phase
  useEffect(() => {
    if (phase !== "choosing" && phase !== "chosen") {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }
    setTimeLeft(10);
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    };
  }, [phase]);

  const showCancelMsg = (msg) => {
    setCancelled(msg);
    if (cancelMsgRef.current) clearTimeout(cancelMsgRef.current);
    cancelMsgRef.current = setTimeout(() => setCancelled(null), 3000);
  };

  const handleAccept = () => {
    socket.emit("rpsAccept", { room, challenger: gameInfo.challenger, target: name });
  };

  const handleDecline = () => {
    socket.emit("rpsDecline", { room, challenger: gameInfo.challenger, target: name });
    setPhase("idle");
    setGameInfo(null);
  };

  const handleCancel = () => {
    socket.emit("rpsCancel", { room, challenger: name, target: gameInfo.target });
    onClearPending?.();
    setPhase("idle");
    setGameInfo(null);
  };

  const handleChoice = (choice) => {
    if (myChoice) return;
    setMyChoice(choice);
    setPhase("chosen");
    socket.emit("rpsChoice", {
      room,
      challenger: gameInfo.challenger,
      target: gameInfo.target,
      choice,
    });
  };

  const opponent = gameInfo
    ? (gameInfo.challenger === name ? gameInfo.target : gameInfo.challenger)
    : null;

  return (
    <>
      {cancelled && (
        <div className="rps-toast">{cancelled}</div>
      )}

      {/* Independent right-side error toast — never affects game state */}
      {errMsg && (
        <div className="rps-error-toast">
          <span>{errMsg}</span>
          <button className="rps-close-btn" onClick={() => setErrMsg(null)}>✕</button>
        </div>
      )}

      {phase !== "idle" && (
        <div className="rps-overlay">
          {phase === "incoming" && (
            <div className="rps-modal">
              <div className="rps-title">✊ 猜拳邀請</div>
              <div className="rps-desc">{gameInfo.challenger} 向你發起猜拳！</div>
              <div className="rps-actions">
                <button className="rps-btn rps-accept" onClick={handleAccept}>接受</button>
                <button className="rps-btn rps-decline" onClick={handleDecline}>拒絕</button>
              </div>
            </div>
          )}

          {phase === "outgoing" && (
            <div className="rps-modal">
              <div className="rps-title">✊ 猜拳邀請</div>
              <div className="rps-desc">已向 {gameInfo.target} 發出邀請，等待接受…</div>
              <button className="rps-btn rps-decline" onClick={handleCancel}>取消</button>
            </div>
          )}

          {(phase === "choosing" || phase === "chosen") && (
            <div className="rps-modal">
              <div className="rps-title">✊ 猜拳 vs {opponent}</div>
              <div className={`rps-countdown ${timeLeft <= 2 ? "urgent" : ""}`}>
                {timeLeft > 0 ? `${timeLeft} 秒` : "時間到！等待結算…"}
              </div>
              {phase === "choosing" ? (
                <div className="rps-choices">
                  {CHOICES.map(c => (
                    <button
                      key={c.key}
                      className="rps-choice-btn"
                      onClick={() => handleChoice(c.key)}
                    >
                      <span className="rps-choice-emoji">{c.label}</span>
                      <span className="rps-choice-name">{c.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rps-waiting">
                  已出 {CHOICES.find(c => c.key === myChoice)?.label}{" "}
                  {CHOICES.find(c => c.key === myChoice)?.name}，等待對方出拳…
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
