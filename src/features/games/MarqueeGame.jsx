import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { roomConfig } from "../../shared/roomConfig";
import "./MarqueeGame.css";

const VISIBLE_SIDES = 1; // 中心左右各顯示幾個名字（小尺寸角落卡片，只留中心+左右各一）
const VISIBLE = VISIBLE_SIDES * 2 + 1; // 共 3 個
const RESULT_DISPLAY_MS = 6000; // 結果畫面顯示多久後自動關閉
const FALLBACK_BUFFER_MS = 3000; // 保底逾時的緩衝：房間設定的秒數到了再多等這麼久還沒收到 marqueeEnd 就強制關閉

export default function MarqueeGame({ socket, name, userList }) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState("running"); // running | result（只有 visible 時才有意義）
  const [reward, setReward] = useState(0);
  const [winner, setWinner] = useState(null);
  const [tick, setTick] = useState(0);

  const tickIntervalRef = useRef(null);
  const closeTimerRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const participantsRef = useRef([]);
  // true 只代表「使用者還沒把這一輪關掉」，open() 設 true、close() 設 false。
  // 伺服器的 marqueeEnd 是這一輪抽獎結束才會來，如果使用者已經手動關掉，
  // 這個遲來的結果就不該又把視窗打開——不然關掉之後中獎瞬間又跳出來。
  const roundActiveRef = useRef(false);

  // 排除 AI 跟隱身使用者——隱身的人不該出現在跑馬燈的跑動名單裡，也不該被抽到
  const participants = useMemo(
    () => userList.filter((u) => u.type !== "AI" && !u.invisible).map((u) => u.name),
    [userList]
  );
  participantsRef.current = participants;

  // 唯一的關閉入口：不管現在是跑動中、結果畫面、還是已經關著，呼叫這個之後
  // 一律變成「關閉」狀態，並且把所有計時器都停掉。手動點 ✖、結果顯示到時間、
  // 開新的一輪之前的收尾，全部都只呼叫這一個函式，不需要另外判斷目前狀態。
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

  // 唯一的開啟入口：先確保上一輪的計時器都清乾淨，再從頭開始跑動畫。
  // durationMs 是房間設定（room_settings.marquee_duration）換算出來的秒數，
  // 拿來排一個保底逾時——正常情況下 marqueeEnd 一定會在這之前到，讓 onEnd 提早關掉；
  // 只有伺服器那邊真的沒送到結果（斷線、房間對不上等等）時，這個保底計時器才會真的觸發，
  // 效果是強制關閉，不會讓卡片沒有上限地一直轉下去。
  const open = useCallback((tickMs, durationMs, r) => {
    close();
    roundActiveRef.current = true;
    setPhase("running");
    setReward(r);
    setWinner(null);
    setTick(0);
    setVisible(true);
    tickIntervalRef.current = setInterval(() => setTick((t) => t + 1), tickMs);
    if (durationMs) {
      fallbackTimerRef.current = setTimeout(close, durationMs + FALLBACK_BUFFER_MS);
    }
  }, [close]);

  useEffect(() => {
    const onStart = ({ durationMs, tickMs, reward: r }) => {
      open(tickMs, durationMs, r);
    };

    const onEnd = ({ winner: w, reward: r }) => {
      if (!roundActiveRef.current) return; // 使用者已經關掉這一輪了，遲來的結果不用管
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
      // 結果已經真的到了，保底逾時計時器沒必要留著——不清掉的話，如果它排定的時間點
      // 剛好落在接下來的結果展示期間內，會提早把結果畫面切斷
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
      setPhase("result");
      setWinner(w);
      setReward(r);
      setVisible(true);
      // 結果畫面固定顯示這麼久，時間到直接關閉，不管中間發生什麼事
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(close, RESULT_DISPLAY_MS);
    };

    socket.on("marqueeStart", onStart);
    socket.on("marqueeEnd", onEnd);

    return () => {
      socket.off("marqueeStart", onStart);
      socket.off("marqueeEnd", onEnd);
      close();
    };
  }, [socket, open, close]);

  if (!visible) return null;

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
    <div className="mq-corner">
      <button className="mq-close" onClick={close} title="關閉">✖</button>
      <div className="mq-header">
        <span className="mq-title">🎰 跑馬燈抽獎</span>
        <span className="mq-prize">獎品 {reward} 顆{roomConfig.currency_name}</span>
      </div>

      {phase === "running" && n > 0 && (
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
        </div>
      )}

      {phase === "running" && n === 0 && (
        <p className="mq-empty">目前沒有可參加的使用者</p>
      )}

      {phase === "result" && (
        <div className="mq-result">
          {winner ? (
            <>
              <div className={`mq-winner-name${winner === name ? " is-me" : ""}`}>
                🎉 {winner}
              </div>
              <div className="mq-winner-reward">獲得 {reward} 顆{roomConfig.currency_name}</div>
              {winner === name && (
                <div className="mq-congrats">恭喜你中獎了！</div>
              )}
            </>
          ) : (
            <p className="mq-empty">本次抽獎無人在線</p>
          )}
        </div>
      )}
    </div>
  );
}
