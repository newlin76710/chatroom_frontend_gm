import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Room, LocalAudioTrack } from "livekit-client";
import "./SongRoom.css";
import { roomConfig } from "../../shared/roomConfig";

const MAX_SING_DURATION = 5000;
const BASE_SING_DURATION = 480;
const MIC_TIMEOUT_MS = 10000;   // 等麥克風權限/裝置回應的上限（LINE 等 App 內建瀏覽器可能永遠不回應）
const TOKEN_TIMEOUT_MS = 15000; // 送出上麥後等 LiveKit token 的上限
const MIC_CONSTRAINTS = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } };

// 取得麥克風：逾時就放棄；逾時後才拿到的串流立刻關掉，避免麥克風一直被佔用
function acquireMic() {
  if (!navigator.mediaDevices?.getUserMedia) {
    const err = new Error("getUserMedia unsupported");
    err.name = "NotSupportedError";
    return Promise.reject(err);
  }
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      done = true;
      const err = new Error("getUserMedia timeout");
      err.name = "TimeoutError";
      reject(err);
    }, MIC_TIMEOUT_MS);
    navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS).then(
      (stream) => {
        clearTimeout(timer);
        if (done) { stream.getTracks().forEach((t) => t.stop()); return; }
        done = true;
        resolve(stream);
      },
      (err) => {
        clearTimeout(timer);
        if (done) return;
        done = true;
        reject(err);
      }
    );
  });
}

function micErrorMessage(err) {
  switch (err?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "麥克風權限被拒絕，請在瀏覽器設定中允許使用麥克風後再上麥";
    case "NotFoundError":
    case "OverconstrainedError":
    case "DevicesNotFoundError":
      return "找不到麥克風裝置，無法上麥";
    case "NotReadableError":
      return "麥克風被其他程式佔用，請關閉其他使用麥克風的程式後再試";
    case "NotSupportedError":
      return "這個瀏覽器無法使用麥克風（LINE 等 App 內建瀏覽器請改用 Safari 或 Chrome 開啟）";
    case "TimeoutError":
      return "麥克風沒有回應，請確認已允許使用麥克風後再試";
    default:
      return "上麥失敗，請稍後再試";
  }
}

const SongRoom = forwardRef(function SongRoom({ room, name, socket, currentSinger, myLevel, onSelectTarget }, ref) {
  const [lkRoom, setLkRoom] = useState(null);
  const [singing, setSinging] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [myPosition, setMyPosition] = useState(0);
  const [queue, setQueue] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => { singingRef.current = singing; }, [singing]);
  const [isProcessing, setIsProcessingState] = useState(false);
  const setIsProcessing = (v) => { processingRef.current = v; setIsProcessingState(v); };
  const [addedSeconds, setAddedSeconds] = useState(0);
  const inQueue = queue.includes(name);
  const roomRef = useRef(null);
  const livekitTokenHandlerRef = useRef(null);
  const singingRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const audioCtxRef = useRef(null);
  const destRef = useRef(null);
  const micTrackRef = useRef(null);
  const micSourceRef = useRef(null);
  const micStreamRef = useRef(null);
  const pendingStreamRef = useRef(null);  // 上麥前先取得的麥克風串流，拿到 token 後交給 startSing 使用
  const tokenTimerRef = useRef(null);
  const processingRef = useRef(false);    // socket handler 是掛載時的 closure，用 ref 讀最新的處理中狀態
  const panelRef = useRef(null);
  const posRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });
  const startDrag = (clientX, clientY) => {
    posRef.current.dragging = true;

    const el = panelRef.current;
    const rect = el.getBoundingClientRect();

    // 🔥 關鍵：清掉衝突定位
    el.style.right = "auto";
    el.style.bottom = "auto";

    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;

    posRef.current.offsetX = clientX - rect.left;
    posRef.current.offsetY = clientY - rect.top;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
  };

  const onMouseDown = (e) => {
    startDrag(e.clientX, e.clientY);
  };

  const onTouchStart = (e) => {
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  };
  const moveDrag = (clientX, clientY) => {
    if (!posRef.current.dragging) return;

    const x = clientX - posRef.current.offsetX;
    const y = clientY - posRef.current.offsetY;

    panelRef.current.style.left = `${x}px`;
    panelRef.current.style.top = `${y}px`;
    panelRef.current.style.right = "auto";
  };

  const onMouseMove = (e) => {
    moveDrag(e.clientX, e.clientY);
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);
  };
  const endDrag = () => {
    posRef.current.dragging = false;

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
  };

  const onMouseUp = () => endDrag();
  const onTouchEnd = () => endDrag();
  useEffect(() => {
    if (!socket) return;

    const handleForceStopSing = () => stopSing();
    const handleYourTurn = () => { setWaiting(false); grabMic({ fromTurn: true }); };
    const handleMicStateUpdate = (data) => {
      setQueue(data.queue);
      setMyPosition(data.queue.indexOf(name) + 1);
    };

    socket.on("forceStopSing", handleForceStopSing);
    socket.on("yourTurn", handleYourTurn);
    socket.on("micStateUpdate", handleMicStateUpdate);

    return () => {
      socket.off("forceStopSing", handleForceStopSing);
      socket.off("yourTurn", handleYourTurn);
      socket.off("micStateUpdate", handleMicStateUpdate);
      if (livekitTokenHandlerRef.current) {
        socket.off("livekit-token", livekitTokenHandlerRef.current);
        livekitTokenHandlerRef.current = null;
      }
    };
  }, [socket, name]);

  const stopPendingStream = () => {
    pendingStreamRef.current?.getTracks().forEach((t) => t.stop());
    pendingStreamRef.current = null;
  };

  const cleanupLocalAudio = async () => {
    const lk = roomRef.current;
    clearTimeout(tokenTimerRef.current);
    stopPendingStream();

    try { await lk?.localParticipant.setMicrophoneEnabled(false); } catch (err) { console.warn("[LiveKit] failed to disable microphone", err); }
    try {
      if (micTrackRef.current) await lk?.localParticipant.unpublishTrack(micTrackRef.current);
    } catch (err) {
      console.warn("[LiveKit] failed to unpublish microphone track", err);
    }
    micSourceRef.current?.disconnect();
    micSourceRef.current = null;
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
    micTrackRef.current?.mediaStreamTrack?.stop();
    micTrackRef.current?.stop();
    micTrackRef.current = null;
    try { await lk?.disconnect(); } catch (err) { console.warn("[LiveKit] failed to disconnect", err); }
    roomRef.current = null;
    setLkRoom(null);
    try { await audioCtxRef.current?.suspend(); } catch (err) { console.warn("[Audio] failed to suspend context", err); }
    try { await audioCtxRef.current?.close(); } catch (err) { console.warn("[Audio] failed to close context", err); }
    audioCtxRef.current = null;
    destRef.current = null;
  };

  const startSing = async (jwtToken) => {
    try {
      const lk = new Room({
        adaptiveStream: true,
        dynacast: true,
        reconnectPolicy: {
          maxRetries: 999,
        }
      });
      roomRef.current = lk;

      lk.on("connectionStateChanged", (state) => {
        console.log(`[LiveKit] connectionStateChanged → ${state}`, { room, singer: name, ts: new Date().toISOString() });
      });
      lk.on("error", (err) => {
        console.error(`[LiveKit] error: ${err?.message}`, { room, singer: name, ts: new Date().toISOString() });
      });
      lk.on("disconnected", (reason) => {
        console.warn(`[LiveKit] disconnected, reason: ${reason}`, { room, singer: name, ts: new Date().toISOString() });
        // 非主動下麥：token 到期或網路斷線，自動向 server 補發 token
        if (singingRef.current && !intentionalStopRef.current) {
          console.warn(`[LiveKit] auto-reconnect: re-emitting grabMic for new token`);
          socket.emit("grabMic", { room, singer: name });
        }
        intentionalStopRef.current = false;
      });
      lk.on("reconnecting", () => {
        console.warn(`[LiveKit] reconnecting…`, { room, singer: name, ts: new Date().toISOString() });
      });
      lk.on("reconnected", () => {
        console.log(`[LiveKit] reconnected`, { room, singer: name, ts: new Date().toISOString() });
      });

      await lk.connect(roomConfig.livekit_url, jwtToken, {
        autoSubscribe: true,
      });
      console.log(`[LiveKit] connected`, { room, singer: name, ts: new Date().toISOString() });

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      destRef.current = dest;

      // 上麥前已經先確認過麥克風；LiveKit 斷線重連補發 token 時才需要重新取得
      let micStream = pendingStreamRef.current;
      pendingStreamRef.current = null;
      if (!micStream || micStream.getAudioTracks().every((t) => t.readyState === "ended")) {
        try {
          micStream = await acquireMic();
        } catch (micErr) {
          console.error(`[LiveKit] getUserMedia failed: ${micErr?.message}`, { room, singer: name, ts: new Date().toISOString() });
          throw micErr;
        }
      }
      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(dest);
      micSourceRef.current = micSource;
      micStreamRef.current = micStream;
      const audioTracks = dest.stream.getAudioTracks();
      if (!audioTracks.length) {
        console.error(`[LiveKit] no audio tracks after getUserMedia`, { room, singer: name, ts: new Date().toISOString() });
        throw new Error("no audio tracks");
      }
      const micTrack = new LocalAudioTrack(audioTracks[0]);
      micTrackRef.current = micTrack;
      await lk.localParticipant.publishTrack(micTrack, {
        audioBitrate: 32000
      });
      console.log(`[LiveKit] track published`, { room, singer: name, ts: new Date().toISOString() });

      setLkRoom(lk);
      setSinging(true);

    } catch (err) {
      console.error(`[LiveKit] startSing failed: ${err?.message}`, { room, singer: name, ts: new Date().toISOString() });
      // 伺服器已先保留麥位；本機無麥克風或權限失敗時必須歸還，避免卡在上麥狀態。
      intentionalStopRef.current = true;
      await cleanupLocalAudio();
      setSinging(false);
      if (livekitTokenHandlerRef.current) {
        socket.off("livekit-token", livekitTokenHandlerRef.current);
        livekitTokenHandlerRef.current = null;
      }
      socket.emit("stopSing", { room, singer: name });
      alert(micErrorMessage(err));
    }
  };

  // 下麥：不管是不是還在「處理中」都要能執行，避免卡在台上下不來
  const stopSing = async () => {
    setIsProcessing(true);
    intentionalStopRef.current = true;
    try {
      await cleanupLocalAudio();
      if (livekitTokenHandlerRef.current) {
        socket.off("livekit-token", livekitTokenHandlerRef.current);
        livekitTokenHandlerRef.current = null;
      }
      setSinging(false);
      socket.emit("stopSing", { room, singer: name });
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // fromTurn：排麥輪到我（伺服器已經把我設成台上歌手），失敗時要把麥位讓出來
  const grabMic = async ({ fromTurn = false } = {}) => {
    if (processingRef.current || singingRef.current) return;
    if (!fromTurn && currentSinger === name) return;

    setIsProcessing(true);

    // 先確認這台裝置真的能用麥克風，拿不到就不通知伺服器，其他人也不會看到你上麥
    let stream;
    try {
      stream = await acquireMic();
    } catch (err) {
      console.warn(`[Mic] 無法取得麥克風: ${err?.name} ${err?.message}`);
      setIsProcessing(false);
      if (fromTurn) socket.emit("stopSing", { room, singer: name });
      alert(micErrorMessage(err));
      return;
    }
    stopPendingStream();
    pendingStreamRef.current = stream;

    socket.emit("grabMic", { room, singer: name });

    // 等 token 逾時：歸還麥位，避免停在「處理中」、全場卻看到你在台上
    clearTimeout(tokenTimerRef.current);
    tokenTimerRef.current = setTimeout(async () => {
      if (singingRef.current) return;
      console.warn("[LiveKit] 等待 token 逾時，自動下麥");
      intentionalStopRef.current = true;
      await cleanupLocalAudio();
      if (livekitTokenHandlerRef.current) {
        socket.off("livekit-token", livekitTokenHandlerRef.current);
        livekitTokenHandlerRef.current = null;
      }
      setSinging(false);
      setIsProcessing(false);
      socket.emit("stopSing", { room, singer: name });
      alert("連線逾時，上麥失敗，請稍後再試");
    }, TOKEN_TIMEOUT_MS);

    if (livekitTokenHandlerRef.current) {
      socket.off("livekit-token", livekitTokenHandlerRef.current);
    }
    livekitTokenHandlerRef.current = async ({ token }) => {
      clearTimeout(tokenTimerRef.current);
      try {
        // 重連情境：先清掉舊的 LiveKit 連線
        if (roomRef.current) {
          try { await roomRef.current.disconnect(); } catch (_) {}
          roomRef.current = null;
          setLkRoom(null);
          micTrackRef.current?.mediaStreamTrack?.stop();
          micTrackRef.current?.stop();
          micTrackRef.current = null;
          micSourceRef.current?.disconnect();
          micSourceRef.current = null;
          micStreamRef.current?.getTracks().forEach(t => t.stop());
          micStreamRef.current = null;
          try { await audioCtxRef.current?.close(); } catch (_) {}
          audioCtxRef.current = null;
          destRef.current = null;
        }
        await startSing(token);
      } finally {
        setIsProcessing(false);
        // 不 null out：保留 handler 以接收重連 token
      }
    };
    socket.on("livekit-token", livekitTokenHandlerRef.current);
  };
  const joinQueue = () => { socket.emit("joinQueue", { room, name }); setWaiting(true); };
  const leaveQueue = () => { socket.emit("leaveQueue", { room, name }); setWaiting(false); };
  const forceStopSinger = (singerName) => { socket.emit("forceStopSinger", { room, singer: singerName }); };

  useEffect(() => { setAddedSeconds(0); }, [currentSinger]);

  const maxAddable = MAX_SING_DURATION - BASE_SING_DURATION;
  const addSingTime = (seconds) => {
    const actualAdd = Math.min(seconds, maxAddable - addedSeconds);
    if (actualAdd <= 0) return;
    socket.emit("adminAddSingTime", { room, seconds: actualAdd });
    setAddedSeconds(prev => prev + actualAdd);
  };

  const otherSinger = currentSinger && currentSinger !== name;
  const isCurrentSinger = currentSinger === name;

  // 讓外部（例如舊版介面的「功能選單」）可以觸發開啟/關閉語音
  useImperativeHandle(ref, () => ({
    startVoice: () => {
      if (isProcessing || singing || inQueue) return;
      otherSinger ? joinQueue() : grabMic();
    },
    stopVoice: () => {
      if (singing || isCurrentSinger) stopSing();
      else if (inQueue) leaveQueue();
    },
  }));

  return (
    <div className="songroom-container">
      <button className="songroom-button" disabled={isProcessing && !(singing || isCurrentSinger)}
        onClick={singing || isCurrentSinger ? stopSing : inQueue ? leaveQueue : otherSinger ? joinQueue : () => grabMic()}>
        {singing || isCurrentSinger ? "🛑 下麥" : isProcessing ? "⏳ 處理中" : inQueue ? `🎤 取消排麥` : otherSinger ? "🎶 排麥" : "🎤 上麥"}
      </button>

      <div ref={panelRef} className="queue-panel">
        <div className="queue-panel-header" onClick={() => setPanelOpen(!panelOpen)} onMouseDown={onMouseDown} onTouchStart={onTouchStart}>
          <span>🎤 排麥列表</span>
          <span>{panelOpen ? "−" : "+"}</span>
        </div>
        {panelOpen && (
          <div className="queue-panel-content">
            <div style={{ marginBottom: 8 }}>
              <strong>正在唱：</strong>
              {currentSinger && (
                <>
                  <div className="queue-item">
                    <span
                      style={currentSinger !== name ? { cursor: "pointer" } : undefined}
                      onClick={() => onSelectTarget?.(currentSinger)}
                    >
                      {currentSinger}
                    </span>
                    {myLevel >= (roomConfig.admin_min_level || 91) && <button className="kick-button" onClick={() => forceStopSinger(currentSinger)}>踢下麥</button>}
                  </div>
                  {myLevel >= (roomConfig.admin_min_level || 91) && (
                    <div className="admin-time-controls">
                      <span className="time-label">⏱ 加秒：</span>
                      <button className="add-time-button" onClick={() => addSingTime(30)} disabled={addedSeconds >= maxAddable}>+30秒</button>
                      <button className="add-time-button" onClick={() => addSingTime(60)} disabled={addedSeconds >= maxAddable}>+1分</button>
                      <button className="add-time-button" onClick={() => addSingTime(300)} disabled={addedSeconds >= maxAddable}>+5分</button>
                      <button className="add-time-button" onClick={() => addSingTime(600)} disabled={addedSeconds >= maxAddable}>+10分</button>
                      <div className="time-info">已加 {addedSeconds} 秒（上限 {MAX_SING_DURATION} 秒）</div>
                    </div>
                  )}
                </>
              )}
              {!currentSinger && <div className="queue-item">無 </div>}
            </div>

            <div>
              <strong>排麥中：</strong>
              {queue.length === 0 ? <div style={{ opacity: 0.6 }}>目前沒有人排麥</div> :
                queue.map((q, i) => (
                  <div key={i} className={`queue-item ${q === name ? "me" : ""}`}>
                    <span
                      style={q !== name ? { cursor: "pointer" } : undefined}
                      onClick={() => onSelectTarget?.(q)}
                    >
                      {i + 1}. {q}{q === name && " (我)"}
                    </span>
                    {myLevel >= (roomConfig.admin_min_level || 91) && <div className="admin-controls">
                      {i === 0 && currentSinger && (
                        <button
                          className="force-button"
                          title="直接推上來替換演唱者"
                          onClick={() => socket.emit("adminForceNext", { room })}>
                          ⬆
                        </button>
                      )}

                      {i > 0 && (
                        <button
                          className="kick-button"
                          onClick={() =>
                            socket.emit("adminMoveQueue", {
                              room,
                              fromIndex: i,
                              toIndex: i - 1
                            })
                          }>
                          ⬆
                        </button>
                      )}

                      {i < queue.length - 1 && (
                        <button
                          className="kick-button"
                          onClick={() =>
                            socket.emit("adminMoveQueue", {
                              room,
                              fromIndex: i,
                              toIndex: i + 1
                            })
                          }>
                          ⬇
                        </button>
                      )}

                      <button
                        className="kick-button"
                        onClick={() => forceStopSinger(q)}>
                        ❌
                      </button>
                    </div>}
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default SongRoom;
