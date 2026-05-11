import { useState, useEffect, useRef } from "react";
import { Room } from "livekit-client";
import "./Listener.css";
import { roomConfig, BACKEND } from "../../shared/roomConfig";

export default function Listener({ room, name, socket, onSingerChange }) {
  const lkRoomRef = useRef(null); // ← ref 取代 state，避免 stale closure
  const [listening, setListening] = useState(false);
  const [currentSinger, setCurrentSinger] = useState(null);
  const [nextSinger, setNextSinger] = useState(null);
  const [score, setScore] = useState(0);
  const [ratedSinger, setRatedSinger] = useState(null);
  const [averageScore, setAverageScore] = useState(null);
  const [scoreCount, setScoreCount] = useState(0);
  const [singStartTime, setSingStartTime] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);
  const togglingRef = useRef(false);
  const audioElementsRef = useRef({});
  const audioTracksRef = useRef({});
  const wasListeningBeforeSingRef = useRef(false);
  const listeningRef = useRef(false); // ref 版本供 effect 讀取
  const [isSinging, setIsSinging] = useState(false);

  // 同步 listening state → ref
  useEffect(() => { listeningRef.current = listening; }, [listening]);

  useEffect(() => {
    if (isSinging) {
      wasListeningBeforeSingRef.current = listeningRef.current;
      if (listeningRef.current) {
        stopListening();
      }
    } else {
      if (wasListeningBeforeSingRef.current) {
        startListening();
        wasListeningBeforeSingRef.current = false;
      }
    }
  }, [isSinging]);

  useEffect(() => {
    if (!currentSinger) { setIsSinging(false); return; }
    if (togglingRef.current) return;

    if (currentSinger === name) {
      setIsSinging(true);
      return;
    }

    setIsSinging(false);
    // autoSubscribe: true 會自動訂閱新的演唱者，不需要重新連線
  }, [currentSinger]);

  useEffect(() => {
    setScore(0);
    setRatedSinger(null);
  }, [currentSinger]);

  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (!singStartTime) { setCountdown(null); return; }

    const SING_DURATION = 480;
    const tick = () => {
      const remaining = Math.max(0, SING_DURATION - Math.floor((Date.now() - singStartTime) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { clearInterval(countdownRef.current); countdownRef.current = null; };
  }, [singStartTime]);

  /* ===== Socket：目前演唱者 ===== */
  useEffect(() => {
    if (!socket) return;

    const handler = (data) => {
      const singer = data.currentSinger || null;
      const queue = data.queue || [];
      setNextSinger(queue.length > 0 ? queue[0] : null);
      setCurrentSinger(singer);
      setSingStartTime(data.singStartTime || null);
      onSingerChange?.(singer);
    };

    socket.on("micStateUpdate", handler);
    return () => socket.off("micStateUpdate", handler);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const handler = (data) => {
      if (data.singer === currentSinger) {
        setAverageScore(data.average);
        setScoreCount(data.count);
      }
    };

    socket.on("scoreUpdate", handler);
    return () => socket.off("scoreUpdate", handler);
  }, [socket, currentSinger]);

  // 離開頁面時確保斷線
  useEffect(() => {
    return () => { stopListening(); };
  }, []);

  const submitScore = (value) => {
    if (!currentSinger || ratedSinger === currentSinger) return;

    socket.emit("rateSinger", {
      room,
      singer: currentSinger,
      score: value
    });

    setScore(value);
    setRatedSinger(currentSinger);
  };

  /* ===== 清 audio ===== */
  const clearAllAudio = () => {
    Object.values(audioElementsRef.current).forEach((el) => {
      el.pause?.();
      el.remove();
    });
    audioElementsRef.current = {};
  };

  /* ===== 停止 ===== */
  const stopListening = async () => {
    const lk = lkRoomRef.current; // 永遠讀最新值
    if (!lk) return;

    lkRoomRef.current = null;
    setListening(false);
    listeningRef.current = false;

    try {
      lk.removeAllListeners();
      await lk.disconnect();
    } catch { }

    clearAllAudio();
    audioTracksRef.current = {};
  };

  /* ===== 開始 ===== */
  const startListening = async () => {
    if (lkRoomRef.current) return; // 已連線，不重複建立

    const res = await fetch(
      `${BACKEND}/livekit-token?room=${room}&name=${name}`
    );
    const data = await res.json();
    if (!data.token) return;

    // fetch 期間若已有人連上（race condition），放棄
    if (lkRoomRef.current) return;

    const lk = new Room();

    lk.on("trackSubscribed", (track, pub, participant) => {
      if (track.kind !== "audio") return;

      audioTracksRef.current[participant.identity] = track;

      // 直接播放，不用判斷是否為 currentSinger（currentSinger 是 stale closure）
      clearAllAudio();
      const el = track.attach();
      el.autoplay = true;
      document.body.appendChild(el);
      audioElementsRef.current[participant.identity] = el;
    });

    lk.on("trackUnsubscribed", (track, pub, participant) => {
      const el = audioElementsRef.current[participant.identity];
      if (el) { el.pause(); el.remove(); delete audioElementsRef.current[participant.identity]; }
      delete audioTracksRef.current[participant.identity];
    });

    await lk.connect(roomConfig.livekit_url, data.token, {
      autoSubscribe: true,
    });

    lkRoomRef.current = lk;
    setListening(true);
    listeningRef.current = true;
  };

  /* ===== 手動 toggle ===== */
  const toggleListening = async () => {
    if (togglingRef.current) return;
    togglingRef.current = true;

    try {
      if (listeningRef.current) {
        await stopListening();
      } else {
        await startListening();
      }
    } finally {
      togglingRef.current = false;
    }
  };

  return (
    <div className="listener-bar">
      <span className="current-singer">
        🎤 演唱者：{currentSinger || "無"} &nbsp;
      </span>
      {countdown !== null && currentSinger && (
        <span className="sing-countdown">⏱ 尚餘 {countdown} 秒 &nbsp;</span>
      )}
      <span className="next-singer">
        ⏭ 下一位：{nextSinger || "無"} &nbsp;
      </span>
      <button className="listen-btn" disabled={isSinging} onClick={toggleListening}>
        {listening ? "🛑 停止聽" : "🎧 開始聽"}
      </button>

      {/* {currentSinger && (
        <div className="rating-panel">
          <span>評分：</span>
          {[1, 2, 3, 4, 5].map((s) => (
            <span
              key={s}
              className={`star ${score >= s ? "active" : ""}`}
              onClick={() => submitScore(s)}
            >
              ★
            </span>
          ))}
        </div>
      )}

      {averageScore && (
        <div className="score-display">
          🎵 平均：{averageScore}分/{scoreCount}人
        </div>
      )} */}

    </div>
  );
}
