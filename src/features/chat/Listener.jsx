import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Room, RoomEvent } from "livekit-client";
import "./Listener.css";
import { roomConfig, BACKEND } from "../../shared/roomConfig";

// 極短的無聲 WAV，用來在點擊手勢內「解鎖」共用 audio 元素
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

const Listener = forwardRef(function Listener({ room, name, socket, onSingerChange, onSelectTarget }, ref) {
  const lkRoomRef = useRef(null); // ← ref 取代 state，避免 stale closure
  const [listening, setListening] = useState(false);
  const [currentSinger, setCurrentSinger] = useState(null);
  const [nextSinger, setNextSinger] = useState(null);
  const [score, setScore] = useState(0);
  const [ratedSinger, setRatedSinger] = useState(null);
  const [averageScore, setAverageScore] = useState(null);
  const [scoreCount, setScoreCount] = useState(0);
  const [singStartTime, setSingStartTime] = useState(null);
  const [singEndTime, setSingEndTime] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);
  const togglingRef = useRef(false);
  const audioElementsRef = useRef({});
  const audioTracksRef = useRef({});
  const wasListeningBeforeSingRef = useRef(false);
  const listeningRef = useRef(false); // ref 版本供 effect 讀取
  const [isSinging, setIsSinging] = useState(false);
  // 手機/平板瀏覽器擋自動播放時，顯示「點此開啟聲音」讓使用者再點一次（點擊本身就是解鎖手勢）
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const [connecting, setConnecting] = useState(false);
  // 全程共用同一個 <audio>：iOS/Android 的自動播放限制是「以元素為單位」解鎖，
  // 原本每次收到音軌都 new 一個 audio 元素，那時早就不在點擊手勢裡了，所以常常被擋、聽不到。
  const sharedAudioRef = useRef(null);

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
    const endTime = singEndTime ?? (singStartTime + SING_DURATION * 1000);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) { clearInterval(countdownRef.current); countdownRef.current = null; }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => { clearInterval(countdownRef.current); countdownRef.current = null; };
  }, [singStartTime, singEndTime]);

  /* ===== Socket：目前演唱者 ===== */
  useEffect(() => {
    if (!socket) return;

    const handler = (data) => {
      const singer = data.currentSinger || null;
      const queue = data.queue || [];
      setNextSinger(queue.length > 0 ? queue[0] : null);
      setCurrentSinger(singer);
      setSingStartTime(data.singStartTime || null);
      setSingEndTime(data.singEndTime || null);
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

  /* ===== 共用 audio 元素 ===== */
  const getSharedAudio = () => {
    let el = sharedAudioRef.current;
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      el.playsInline = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.style.display = "none";
      document.body.appendChild(el);
      sharedAudioRef.current = el;
    }
    return el;
  };

  // 必須在點擊事件的「同步」階段呼叫（任何 await 之前），手機瀏覽器才會認定是使用者手勢而放行播放
  const unlockAudio = () => {
    const el = getSharedAudio();
    try {
      if (!el.srcObject) {
        el.src = SILENT_WAV;
        const p = el.play();
        p?.then(() => { if (!el.srcObject) el.pause(); }).catch(() => { });
      } else {
        el.play()?.catch(() => { });
      }
    } catch { }
    // LiveKit 內部若有用到 AudioContext，也一起在手勢內解鎖
    try { lkRoomRef.current?.startAudio(); } catch { }
  };

  const playShared = () => {
    const el = sharedAudioRef.current;
    if (!el || !el.srcObject) return;
    el.play()
      .then(() => setNeedsAudioTap(false))
      .catch(() => setNeedsAudioTap(true));
  };

  /* ===== 清 audio ===== */
  const clearAllAudio = () => {
    const el = sharedAudioRef.current;
    Object.values(audioTracksRef.current).forEach((t) => {
      try { if (el) t.detach(el); } catch { }
    });
    if (el) {
      el.pause?.();
      el.srcObject = null;
      el.removeAttribute("src");
    }
    audioElementsRef.current = {};
    setNeedsAudioTap(false);
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
    unlockAudio(); // ⚠️ 一定要在第一個 await 之前

    if (!roomConfig.livekit_url) { alert("語音服務尚未設定，暫時無法收聽"); return; }

    setConnecting(true);
    let lk = null;
    try {
      const res = await fetch(
        `${BACKEND}/livekit-token?room=${encodeURIComponent(room)}&name=${encodeURIComponent(name)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!data.token) throw new Error("取得收聽憑證失敗");

      // fetch 期間若已有人連上（race condition），放棄
      if (lkRoomRef.current) return;

      lk = new Room({ adaptiveStream: false, dynacast: false });

      lk.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        if (track.kind !== "audio") return;

        // 直接播放，不用判斷是否為 currentSinger（currentSinger 是 stale closure）
        clearAllAudio();
        audioTracksRef.current[participant.identity] = track;
        const el = getSharedAudio();
        el.removeAttribute("src");
        track.attach(el);
        audioElementsRef.current[participant.identity] = el;
        playShared();
      });

      lk.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
        const el = sharedAudioRef.current;
        try { if (el) track.detach(el); } catch { }
        delete audioElementsRef.current[participant.identity];
        delete audioTracksRef.current[participant.identity];
      });

      // LiveKit 偵測到瀏覽器擋播放
      lk.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!lk.canPlaybackAudio) setNeedsAudioTap(true);
      });

      // 手機切到背景/換網路（Wi-Fi ↔ 行動網路）時 LiveKit 可能重連失敗而斷線；
      // 原本斷了也還是顯示「停止聽」、再按「開始聽」又因為 lkRoomRef 還在直接 return，就一直聽不到。
      lk.on(RoomEvent.Disconnected, () => {
        if (lkRoomRef.current !== lk) return; // 自己按停止的，不處理
        lkRoomRef.current = null;
        setListening(false);
        listeningRef.current = false;
        clearAllAudio();
        audioTracksRef.current = {};
      });

      await lk.connect(roomConfig.livekit_url, data.token, {
        autoSubscribe: true,
      });

      lkRoomRef.current = lk;
      setListening(true);
      listeningRef.current = true;
      if (!lk.canPlaybackAudio) setNeedsAudioTap(true);
    } catch (err) {
      console.error("開始聽失敗:", err);
      try { lk?.removeAllListeners(); await lk?.disconnect(); } catch { }
      if (lkRoomRef.current === lk) lkRoomRef.current = null;
      alert("連線收聽失敗，請稍後再試一次");
    } finally {
      setConnecting(false);
    }
  };

  // 被擋播放時使用者再點一下（這次點擊就是手勢）
  const resumeAudio = () => {
    try { lkRoomRef.current?.startAudio(); } catch { }
    playShared();
  };

  // 手機鎖屏/切 App 回來時，瀏覽器常把 audio 暫停；回到前景自動續播
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !listeningRef.current) return;
      const el = sharedAudioRef.current;
      if (el && el.srcObject && el.paused) playShared();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, []);

  // 卸載時把共用 audio 元素移除
  useEffect(() => () => {
    sharedAudioRef.current?.remove();
    sharedAudioRef.current = null;
  }, []);

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

  // 讓外部（例如舊版介面的「功能選單」）可以觸發開始聽/結束聽
  useImperativeHandle(ref, () => ({
    startListen: async () => {
      if (togglingRef.current || isSinging || listeningRef.current) return;
      togglingRef.current = true;
      try { await startListening(); } finally { togglingRef.current = false; }
    },
    stopListen: async () => {
      if (togglingRef.current || !listeningRef.current) return;
      togglingRef.current = true;
      try { await stopListening(); } finally { togglingRef.current = false; }
    },
  }));

  return (
    <div className="listener-bar">
      <span className="current-singer" title={currentSinger || undefined}>
        🎤 演唱者：
        <span
          style={currentSinger && currentSinger !== name ? { cursor: "pointer" } : undefined}
          onClick={() => currentSinger && onSelectTarget?.(currentSinger)}
        >
          {currentSinger || "無"}
        </span>
        {" "}
      </span>
      {countdown !== null && currentSinger && (
        <span className="sing-countdown">⏱ 尚餘 {countdown} 秒 &nbsp;</span>
      )}
      <span className="next-singer" title={nextSinger || undefined}>
        ⏭ 下一位：
        <span
          style={nextSinger && nextSinger !== name ? { cursor: "pointer" } : undefined}
          onClick={() => nextSinger && onSelectTarget?.(nextSinger)}
        >
          {nextSinger || "無"}
        </span>
        {" "}
      </span>
      {needsAudioTap && listening && (
        <button className="listen-btn listen-btn-unmute" onClick={resumeAudio}>
          🔊 點此開啟聲音
        </button>
      )}
      <button className="listen-btn" disabled={isSinging || connecting} onClick={toggleListening}>
        {connecting ? "⏳ 連線中" : listening ? "🛑 停止聽" : "🎧 開始聽"}
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
});

export default Listener;
