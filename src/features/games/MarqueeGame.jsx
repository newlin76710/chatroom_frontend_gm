import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "./MarqueeGame.css";

const VISIBLE_SIDES = 3; // 中心左右各顯示幾個名字
const VISIBLE = VISIBLE_SIDES * 2 + 1; // 共 7 個

export default function MarqueeGame({ socket, name, userList }) {
  const [phase, setPhase] = useState("idle"); // idle | running | stopping | result
  const [reward, setReward] = useState(0);
  const [winner, setWinner] = useState(null);
  const [tick, setTick] = useState(0);

  const phaseRef = useRef("idle");
  const tickRef = useRef(0);
  const winnerRef = useRef(null);
  const intervalRef = useRef(null);
  const stopTimerRef = useRef(null);
  const participantsRef = useRef([]);

  const participants = useMemo(
    () => userList.filter((u) => u.type !== "AI").map((u) => u.name),
    [userList]
  );
  participantsRef.current = participants;

  const clearTimers = useCallback(() => {
    clearInterval(intervalRef.current);
    clearTimeout(stopTimerRef.current);
  }, []);

  // 減速動畫：逐步減慢直到停在中獎人名字上
  const startDeceleration = useCallback(() => {
    const parts = participantsRef.current;
    if (parts.length === 0) {
      setPhase("result");
      phaseRef.current = "result";
      return;
    }

    const w = winnerRef.current;
    const winIdx = parts.indexOf(w);

    const n = parts.length;
    const cur = tickRef.current % n;
    // 確保至少跑完 2 圈再停到中獎位置
    const stepsToWinner = winIdx !== -1
      ? ((winIdx - cur) % n + n) % n || n
      : n; // 找不到中獎人就多跑一圈
    const totalSteps = 2 * n + stepsToWinner;

    let step = 0;

    function scheduleNext(delay) {
      stopTimerRef.current = setTimeout(() => {
        step++;
        tickRef.current++;
        setTick((t) => t + 1);

        const progress = step / totalSteps;
        // quadratic ease-out：從 60ms 加速到 500ms
        const nextDelay = Math.round(60 + (500 - 60) * Math.pow(progress, 2));

        if (step < totalSteps) {
          scheduleNext(nextDelay);
        } else {
          setPhase("result");
          phaseRef.current = "result";
        }
      }, delay);
    }

    scheduleNext(60);
  }, []);

  useEffect(() => {
    const onStart = ({ durationMs, tickMs, reward: r }) => {
      clearTimers();
      tickRef.current = 0;
      winnerRef.current = null;
      phaseRef.current = "running";
      setTick(0);
      setReward(r);
      setWinner(null);
      setPhase("running");

      intervalRef.current = setInterval(() => {
        tickRef.current++;
        setTick((t) => t + 1);
      }, tickMs);
    };

    const onEnd = ({ winner: w, reward: r }) => {
      clearInterval(intervalRef.current);
      winnerRef.current = w;
      setWinner(w);
      setReward(r);
      phaseRef.current = "stopping";
      setPhase("stopping");
      startDeceleration();
    };

    socket.on("marqueeStart", onStart);
    socket.on("marqueeEnd", onEnd);

    return () => {
      socket.off("marqueeStart", onStart);
      socket.off("marqueeEnd", onEnd);
      clearTimers();
    };
  }, [socket, clearTimers, startDeceleration]);

  const handleDismiss = useCallback(() => {
    if (phase === "result") {
      setPhase("idle");
      phaseRef.current = "idle";
    }
  }, [phase]);

  if (phase === "idle") return null;

  const n = participants.length;
  const currentIdx = n > 0 ? tick % n : 0;

  const displayItems =
    n > 0
      ? Array.from({ length: VISIBLE }, (_, i) => {
          const offset = i - VISIBLE_SIDES;
          const idx = ((currentIdx + offset) % n + n) % n;
          return { name: participants[idx], isCenter: offset === 0 };
        })
      : [];

  return (
    <div className="mq-overlay" onClick={handleDismiss}>
      <div className="mq-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="mq-title">🎰 跑馬燈抽獎</h2>
        <p className="mq-prize">獎品：{reward} 顆金蘋果 🍎</p>

        {(phase === "running" || phase === "stopping") && n > 0 && (
          <div className="mq-strip-area">
            <div className="mq-strip">
              {displayItems.map((item, i) => (
                <div
                  key={i}
                  className={`mq-item${item.isCenter ? " center" : ""}`}
                >
                  {item.name}
                </div>
              ))}
            </div>
            <div className="mq-pointer">▲</div>
          </div>
        )}

        {phase === "result" && (
          <div className="mq-result">
            {winner ? (
              <>
                <div className="mq-winner-label">幸運得主</div>
                <div className={`mq-winner-name${winner === name ? " is-me" : ""}`}>
                  🎉 {winner} 🎉
                </div>
                <div className="mq-winner-reward">獲得 {reward} 顆金蘋果</div>
                {winner === name && (
                  <div className="mq-congrats">恭喜你中獎了！</div>
                )}
              </>
            ) : (
              <p>本次抽獎無人在線</p>
            )}
            <p className="mq-dismiss">點擊任意處關閉</p>
          </div>
        )}
      </div>
    </div>
  );
}
