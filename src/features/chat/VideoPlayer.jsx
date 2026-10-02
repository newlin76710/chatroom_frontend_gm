import YouTube from "react-youtube";
import { useRef, useEffect } from "react";
import "./VideoPlayer.css";

export default function VideoPlayer({ video, extractVideoID, onClose }) {
  const playerRef = useRef(null);
  const lastVideoIdRef = useRef(null);
  const closedRef = useRef(false);

  // 點播區也能放圖片（kind: "image"）：直接顯示，不經過 YouTube 播放器。
  // 沒帶 kind（後端還沒更新會把它丟掉）時，解析不出 YouTube ID 的 http(s) 網址也當成圖片
  const parsedVideoId = video ? extractVideoID(video.url) : null;
  const imageUrl = video && (video.kind === "image" || (!parsedVideoId && /^https?:\/\//i.test(video.url || ""))) ? video.url : null;
  const videoId = imageUrl ? null : parsedVideoId;

  /* ===== Player Ready ===== */
  const onPlayerReady = (event) => {
    if (closedRef.current) return;

    playerRef.current = event.target;

    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;

    try {
      if (isTouchDevice) {
        event.target.mute(); // 手機先靜音避免 autoplay 被擋
      } else {
        event.target.unMute();
        event.target.setVolume(100);
      }
    } catch { }
  };

  /* ===== 手機首次觸控解除靜音 ===== */
  useEffect(() => {
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (!isTouchDevice) return;

    const handleTouch = () => {
      try {
        playerRef.current?.unMute();
        playerRef.current?.setVolume(100);
      } catch { }

      window.removeEventListener("touchstart", handleTouch);
    };

    window.addEventListener("touchstart", handleTouch);
    return () => window.removeEventListener("touchstart", handleTouch);
  }, []);

  /* ===== 影片真的換了才播放 ===== */
  useEffect(() => {
    if (!playerRef.current || !videoId || closedRef.current) return;

    if (lastVideoIdRef.current !== videoId) {
      try {
        playerRef.current.playVideo();
        lastVideoIdRef.current = videoId;
      } catch { }
    }
  }, [videoId]);

  /* ===== 關閉播放器 ===== */
  const handleClose = () => {
    closedRef.current = true;

    try {
      if (playerRef.current) {
        playerRef.current.stopVideo();
        playerRef.current.destroy();
        playerRef.current = null;
      }
    } catch { }

    lastVideoIdRef.current = null;

    onClose?.(); // 通知父層
  };

  /* ===== Unmount 保護（超重要） ===== */
  useEffect(() => {
    return () => {
      closedRef.current = true;

      try {
        if (playerRef.current) {
          playerRef.current.stopVideo();
          playerRef.current.destroy();
          playerRef.current = null;
        }
      } catch { }
    };
  }, []);

  if (imageUrl) {
    return (
      <div className="video-player-float video-image-mode">
        <a href={imageUrl} target="_blank" rel="noopener noreferrer" title="開新視窗看原圖">
          <img className="video-image" src={imageUrl} alt="點播圖片" referrerPolicy="no-referrer" />
        </a>
        <div className="video-info">
          <span>🖼️ 點播圖片（由 {video.user?.name || "未知"} 點播）</span>
          {/* 圖片沒有播放器要銷毀，只通知父層收起；不能動 closedRef，否則之後點播的影片會播不出來 */}
          <button className="close-btn" onClick={() => onClose?.()}>✖</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`video-player-float ${!videoId ? "placeholder" : ""}`}>
      {videoId ? (
        <>
          <YouTube
            videoId={videoId}
            onReady={onPlayerReady}
            opts={{
              width: "100%",
              height: "100%",
              playerVars: {
                autoplay: 0, // 建議開 → 點播就是要播
                playsinline: 1,
                controls: 1,
                rel: 0,
                modestbranding: 1,
              },
            }}
          />

          <div className="video-info">
            <span>
              🎧 正在播放（由 {video.user?.name || "未知"} 點播）
            </span>

            <button className="close-btn" onClick={handleClose}>
              ✖
            </button>
          </div>
        </>
      ) : (
        <div className="video-placeholder">
          <div className="placeholder-text">
            🎬 影片・圖片點播中...
            <br />
            歡樂聊天盡在尋夢園
          </div>
        </div>
      )}
    </div>
  );
}
