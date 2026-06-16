import { useState, useEffect, useRef } from "react";
import { Room, LocalAudioTrack } from "livekit-client";
import "./SongRoom.css";
import { roomConfig } from "../../shared/roomConfig";

const MAX_SING_DURATION = 5000;
const BASE_SING_DURATION = 480;

export default function SongRoom({ room, name, socket, currentSinger, myLevel }) {
  const [lkRoom, setLkRoom] = useState(null);
  const [singing, setSinging] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [myPosition, setMyPosition] = useState(0);
  const [queue, setQueue] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => { singingRef.current = singing; }, [singing]);
  const [isProcessing, setIsProcessing] = useState(false);
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
    const handleYourTurn = () => { setWaiting(false); grabMic(); };
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

      let micStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      } catch (micErr) {
        console.error(`[LiveKit] getUserMedia failed: ${micErr?.message}`, { room, singer: name, ts: new Date().toISOString() });
        throw micErr;
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
    }
  };

  const stopSing = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    intentionalStopRef.current = true;
    try {
      const lk = roomRef.current;
      await lk?.localParticipant.setMicrophoneEnabled(false);
      if (micTrackRef.current) await lk?.localParticipant.unpublishTrack(micTrackRef.current);
      micSourceRef.current?.disconnect();
      micSourceRef.current = null;
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
      micTrackRef.current?.mediaStreamTrack?.stop();
      micTrackRef.current?.stop();
      micTrackRef.current = null;
      await lk?.disconnect();
      roomRef.current = null;
      setLkRoom(null);
      await audioCtxRef.current?.suspend();
      await audioCtxRef.current?.close();
      audioCtxRef.current = null;
      destRef.current = null;
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

  const grabMic = () => {
    if (isProcessing || singing) return;

    setIsProcessing(true);

    socket.emit("grabMic", { room, singer: name });
    if (livekitTokenHandlerRef.current) {
      socket.off("livekit-token", livekitTokenHandlerRef.current);
    }
    livekitTokenHandlerRef.current = async ({ token }) => {
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

  return (
    <div className="songroom-container">
      <button className="songroom-button" disabled={isProcessing}
        onClick={singing ? stopSing : inQueue ? leaveQueue : otherSinger ? joinQueue : grabMic}>
        {isProcessing ? "⏳ 處理中" : singing ? "🛑 下麥" : inQueue ? `🎤 取消排麥` : otherSinger ? "🎶 排麥" : "🎤 上麥"}
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
                    <span>{currentSinger}</span>
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
                    <span>{i + 1}. {q}{q === name && " (我)"}</span>
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
}
