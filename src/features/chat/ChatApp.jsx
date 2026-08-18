// ChatApp.optimized.jsx — 優化版本（供參考）
//
// 主要優化：
//  1. [訊息上限]     訊息超過 MAX_MESSAGES(500) 自動截斷最舊的，防止記憶體洩漏
//  2. [穩定的 Socket handlers]
//     使用 "ref 轉發" 模式：每個 socket handler 只在 socket 變動時重新綁定一次，
//     內部透過 ref 讀取最新的 userList / closedVideoId 等值，完全避免 stale closure
//  3. [useMemo]      visibleMessages 依賴 messages + filteredUsers，不在每次 render 重算
//  4. [自訂 Hooks]   useMessages / useUserState 拆出核心狀態邏輯，主元件更清晰
//  5. [AppErrorBoundary] 管理面板 / UserList 包上錯誤邊界，局部錯誤不炸全頁
//  6. [常數集中]     所有魔術數字從 constants.js 引入

import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import socketInstance from "../../shared/socket";
import "./ChatApp.css";
import MessageList from "./MessageList";
import VideoPlayer from "./VideoPlayer";
import VideoSafeBoundary from "./VideoSafeBoundary";
import SongRoom from "./SongRoom";
import Listener from "./Listener";
import UserList from "./UserList";
import RPS from "./RPS";
import PingPong from "./PingPong";
import SurpriseHistoryPanel from "./SurpriseHistoryPanel";
import QuickPhrasePanel from "./QuickPhrasePanel";
import ColorSwatchPicker from "./ColorSwatchPicker";
import FunctionMenuPicker from "./FunctionMenuPicker";
import TextEmotionPicker from "./TextEmotionPicker";
import AnnouncementPanel from "./AnnouncementPanel";
import MyMessageLogPanel from "./MyMessageLogPanel";
import AppErrorBoundary from "../../shared/AppErrorBoundary";
import { getAiAvatar } from "../../shared/aiConfig";
import { expForNextLevel, safeText } from "../../shared/utils";
import { useMessages } from "../../shared/hooks/useMessages";
import { useUserState } from "../../shared/hooks/useUserState";
import { HEARTBEAT_INTERVAL, GENDER_COLORS } from "../../shared/constants";
import { Converter } from "opencc-js";

// ─── 環境設定 ────────────────────────────────────────────────────────────────
import { roomConfig, loadRoomConfig, BACKEND, RN } from "../../shared/roomConfig";
loadRoomConfig();
const FRONTEND_VERSION = import.meta.env.VITE_APP_VERSION || "dev";

// ✅ 模組層級建立（原本在 render 內建立，每次 render 都重新 new）
const converter = Converter({ from: "cn", to: "tw" });
const toTraditional = (text) => (text ? converter(text) : "");

const formatLv = (lv) => String(lv).padStart(2, "0");

const extractVideoID = (url) => {
  if (!url) return null;
  const match =
    url.match(/[?&]v=([\w-]{11})/) ||
    url.match(/youtu\.be\/([\w-]{11})/) ||
    url.match(/shorts\/([\w-]{11})/) ||
    url.match(/live\/([\w-]{11})/);
  return match ? match[1] : null;
};

const getUserColorByGender = (g) => GENDER_COLORS[g] ?? GENDER_COLORS.default;

function compareVersions(a = "", b = "") {
  const pa = String(a).match(/\d+/g)?.map((n) => Number.parseInt(n, 10) || 0) || [0];
  const pb = String(b).match(/\d+/g)?.map((n) => Number.parseInt(n, 10) || 0) || [0];
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

const AdminSettingsModal = lazy(() => import("../admin/AdminSettingsModal"));
const GoldAppleGame = lazy(() => import("../games/GoldAppleGame"));
const WhackAppleGame = lazy(() => import("../games/WhackAppleGame"));
const ClawMachineGame = lazy(() => import("../games/ClawMachineGame"));
const CherryTreeGame = lazy(() => import("../games/CherryTreeGame"));
const DigTreasureGame = lazy(() => import("../games/DigTreasureGame"));
const MarqueeGame = lazy(() => import("../games/MarqueeGame"));
const PushCardGame = lazy(() => import("../games/PushCardGame"));
const AdminToolPanel = lazy(() => import("../admin/AdminToolPanel"));
const ShopPanel = lazy(() => import("./ShopPanel"));
const CasinoPanel = lazy(() => import("../casino/CasinoPanel"));
const LoungePanel = lazy(() => import("../lounge/LoungePanel"));
const MessageBoard = lazy(() => import("./MessageBoard"));
const Leaderboard = lazy(() => import("./Leaderboard"));

function DeferredPanel({ children, fallback = null }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

// ─── 主元件 ──────────────────────────────────────────────────────────────────
export default function ChatApp() {
  useNavigate(); // 保留 navigate（forceLogout 跳頁用）
  const socket = socketInstance;
  const [room] = useState(RN);
  const [CN, setCN] = useState("");
  const invisible = sessionStorage.getItem("invisible") === "true"; // 99級隱形登入

  const openaiRef = useRef(false);
  const [ownMessageLeft, setOwnMessageLeft] = useState(!!roomConfig.own_message_left);
  const [legacyChatUI, setLegacyChatUI] = useState(!!roomConfig.legacy_chat_ui);

  // ─── 從後端 room_settings 取得設定 ──────────────────────────────────────
  useEffect(() => {
    loadRoomConfig().then(cfg => {
      setCN(cfg.room_name || "");
      openaiRef.current = cfg.openai === true;
      setOwnMessageLeft(!!cfg.own_message_left);
      setLegacyChatUI(!!cfg.legacy_chat_ui);
    });
  }, []);

  // ─── 管理員即時更新聊天室設定（不需重新整理） ───────────────────────────
  useEffect(() => {
    const handleRoomConfigUpdate = (data) => {
      if (!data) return;
      Object.assign(roomConfig, data);
      if (data.own_message_left !== undefined) setOwnMessageLeft(!!data.own_message_left);
      if (data.legacy_chat_ui !== undefined) setLegacyChatUI(!!data.legacy_chat_ui);
    };
    socket.on("roomConfigUpdate", handleRoomConfigUpdate);
    return () => socket.off("roomConfigUpdate", handleRoomConfigUpdate);
  }, [socket]);

  const AML    = roomConfig.admin_max_level || 99;
  const ANL    = roomConfig.admin_min_level || 91;
  const OPENAI = roomConfig.openai;
  const NF     = roomConfig.new_function;
  const LB     = roomConfig.leaderboard_enabled;

  // ── 自訂 Hooks ──
  const {
    name, level, exp, gender, apples, token,
    expTips, levelUpTips, initializedRef,
    setApples,
    initUser, fetchUserData, handleUpdateUsersForSelf,
  } = useUserState(socket);

  const {
    messages,
    addMessage, addSystemMessage, addTransactionMessage, addGiftMessage,
    addSurpriseMessage, addPeonyMessage,
    clearMessages,
  } = useMessages();

  // ── UI state ──
  const [offline, setOffline] = useState(false);
  const [showReloadNotice, setShowReloadNotice] = useState(false);
  const [target, setTarget] = useState("");
  const [contactedNames, setContactedNames] = useState(() => new Set()); // 舊版介面「選擇對象」清單：登入後有私聊/點過的人
  const [typing] = useState("");
  const [userList, setUserList] = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [closedVideoId, setClosedVideoId] = useState(null);
  const [chatMode, setChatMode] = useState(() => (sessionStorage.getItem("invisible") === "true" ? "private" : "public"));
  const [userListCollapsed, setUserListCollapsed] = useState(false);
  const [text, setText] = useState("");
  const [messageHistory, setMessageHistory] = useState([]); // 進入聊天室後所有已發送訊息（舊版介面 </> 記憶功能用，新到舊排序）
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 = 目前為新輸入，非瀏覽紀錄中
  const [cooldown, setCooldown] = useState(false);
  const [placeholder, setPlaceholder] = useState("輸入訊息...");
  const [chatColor, setChatColor] = useState(
    () => sessionStorage.getItem("chatColor") || "#ffffff"
  );
  const [textEmotion, setTextEmotion] = useState(""); // 舊版介面文字表情（例如「深情款款」）
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showSongRequestModal, setShowSongRequestModal] = useState(false);
  const [showMessageBoard, setShowMessageBoard] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [shopTitle, setShopTitle] = useState("商城");
  const [showCasino, setShowCasino] = useState(false);
  const [showPlayground, setShowPlayground] = useState(false);
  const [showLounge, setShowLounge] = useState(false);
  const [showAdminTools, setShowAdminTools] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [currentSinger, setCurrentSinger] = useState(null);
  const [convertTC, setConvertTC] = useState(true);
  const [appleAmount, setAppleAmount] = useState(1);
  const [sendingApple, setSendingApple] = useState(false);
  const [sendingPeony, setSendingPeony] = useState(false);
  const [showAppleSetting, setShowAppleSetting] = useState(false);
  const [perTransferLimit, setPerTransferLimit] = useState(0); // 0 = 不限制
  const [scrollLocked, setScrollLocked] = useState(false);
  const scrollLockedRef = useRef(false); // 同步更新，避免 useLayoutEffect 讀到過期值
  const [rpsPending, setRpsPending] = useState(null); // 等待對方接受猜拳的目標名
  const [pingpongPending, setPingpongPending] = useState(null);
  const [rpsActive, setRpsActive] = useState(false);
  const [pingpongActive, setPingpongActive] = useState(false);
  const gamesBusy = rpsActive || pingpongActive;
  const [marqueeActive, setMarqueeActive] = useState(false);
  const [pushCardActive, setPushCardActive] = useState(false);

  const [invalidTokenCountdown, setInvalidTokenCountdown] = useState(null);
  const invalidTokenTimerRef = useRef(null);

  const joinedRef = useRef(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const versionReportInFlightRef = useRef(false);
  const versionReloadingRef = useRef(false);
  const videoUrlInputRef = useRef(null);
  const songRoomRef = useRef(null);
  const listenerRef = useRef(null);
  const [quickPhraseOpenSignal, setQuickPhraseOpenSignal] = useState(0);

  const userType = sessionStorage.getItem("type") || "guest";
  const isMember = userType === "account";

  // ─── 「最新值」refs（給 socket handlers 讀取，避免 stale closure 同時不重新綁定）
  const userListRef = useRef(userList);
  const closedVideoIdRef = useRef(closedVideoId);
  const roomRef = useRef(room);
  const nameRef = useRef(name);
  // 登入後累計發話則數（純前端計數，達門檻才向後端雙重驗證，避免每則訊息都查一次 DB）
  const speechCountRef = useRef(0);
  // 在線獎勵：下一次跟後端核對的排程 timer
  const onlineRewardTimerRef = useRef(null);
  useEffect(() => { userListRef.current = userList; }, [userList]);
  useEffect(() => { closedVideoIdRef.current = closedVideoId; }, [closedVideoId]);
  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { nameRef.current = name; }, [name]);

  // ✅ 過濾訊息用 useMemo，只在 messages / filteredUsers 改變時重算
  const visibleMessages = useMemo(
    () => messages.filter((msg) => !filteredUsers.includes(msg.user?.name)),
    [messages, filteredUsers]
  );

  // ─── 初始化 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = initUser();
    if (t) fetchUserData(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerVersionRefresh = useCallback(() => {
    if (versionReloadingRef.current) return;
    versionReloadingRef.current = true;
    // 用 state 控制 UI（不要用 alert）
    setShowReloadNotice(true);
    setTimeout(() => {
      window.location.reload();
    }, 30000);
  }, []);

  // ─── 心跳 + 版本檢查（整合版） ─────────────────────────────────────────────
  useEffect(() => {
    let lastCheckTime = 0;
    const CHECK_INTERVAL = 30000; // 最少30秒檢查一次版本
    const tick = async () => {
      // 1️⃣ heartbeat（原本功能）
      socket.emit("heartbeat");

      // 2️⃣ 節流版本檢查（避免每次 heartbeat 都打 API）
      const now = Date.now();
      if (now - lastCheckTime < CHECK_INTERVAL) return;
      lastCheckTime = now;

      // 3️⃣ 防止重複請求（你原本的保護機制保留）
      if (versionReportInFlightRef.current) return;
      versionReportInFlightRef.current = true;
      try {
        const res = await fetch(`${BACKEND}/frontend-version-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version: FRONTEND_VERSION, room }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (
          data?.shouldRefresh &&
          compareVersions(data.latestVersion, FRONTEND_VERSION) > 0
        ) {
          triggerVersionRefresh();
        }
      } catch (_) {
        // ignore
      } finally {
        versionReportInFlightRef.current = false;
      }
    };

    tick(); // 進來先跑一次
    const id = setInterval(tick, HEARTBEAT_INTERVAL);
    return () => clearInterval(id);
  }, [socket, room, triggerVersionRefresh]);

  // ─── updateUsers ─────────────────────────────────────────────────────────
  useEffect(() => {
    // 這個 handler 用兩個職責分開：
    //  1. 更新 userList（由 ChatApp 自己管）
    //  2. 同步自己的 level/exp/apples（委派給 useUserState hook）
    const handler = (list = []) => {
      if (!Array.isArray(list)) return;
      const filtered = openaiRef.current ? list : list.filter((u) => u?.type !== "AI");

      setUserList(
        filtered
          .map((u, i) => ({
            id: u?.id || i,
            name: safeText(u?.name || u?.user),
            level: u?.level || 1,
            exp: u?.exp || 0,
            gold_apples: u.gold_apples || 0,
            golden_peonies: u.golden_peonies || 0,
            gender: u?.gender || "女",
            type: u?.type || "guest",
            // 管理員收到的 updateUsers 會包含隱身使用者（見 chat.js 的 broadcastUserList），
            // 這個欄位要留著，跑馬燈才能正確把隱身的人排除在跑動名單跟中獎名單之外
            invisible: !!u?.invisible,
            avatar:
              u?.avatar && u.avatar !== ""
                ? u.avatar
                : getAiAvatar(u?.name) || "/avatars/g01.gif",
          }))
          .sort((a, b) => {
            if (a.type === "account" && b.type !== "account") return -1;
            if (a.type !== "account" && b.type === "account") return 1;
            return b.level - a.level;
          })
      );

      // 只有自己的狀態同步交給 hook 處理（handler 內部透過 ref 讀最新值）
      handleUpdateUsersForSelf(list);
    };

    socket.on("updateUsers", handler);
    return () => socket.off("updateUsers", handler);
  }, [socket, handleUpdateUsersForSelf]);
  // ✅ handleUpdateUsersForSelf 本身是穩定的（deps=[]），所以這個 effect 只綁定一次

  // ─── 斷線 / 重連 ─────────────────────────────────────────────────────────
  useEffect(() => {
    const onDisconnect = (reason) => {
      console.log("🔴 socket disconnected:", reason);
      setOffline(true);
    };

    const onReconnect = () => {
      console.log("🟢 socket reconnected");
      setOffline(false);
      if (!joinedRef.current) return;
      socket.emit("joinRoom", {
        room: roomRef.current,
        user: {
          name: nameRef.current,
          type: sessionStorage.getItem("type") || "guest",
          token: sessionStorage.getItem("token") || sessionStorage.getItem("guestToken"),
          invisible,
        },
      });
    };

    const onConnectError = (err) => {
      console.log("connect_error:", err.message);
      setOffline(true);
    };

    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect", onReconnect);
    socket.on("connect_error", onConnectError);
    return () => {
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect", onReconnect);
      socket.off("connect_error", onConnectError);
    };
  }, [socket]);
  // ✅ 不依賴 room / name，改用 ref，不會因為 name 改變就重新綁定

  // ─── Invalid token 全域偵測 ───────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (invalidTokenTimerRef.current) return;
      let remaining = 30;
      setInvalidTokenCountdown(remaining);
      invalidTokenTimerRef.current = setInterval(() => {
        remaining -= 1;
        setInvalidTokenCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(invalidTokenTimerRef.current);
          invalidTokenTimerRef.current = null;
          window.location.reload();
        }
      }, 1000);
    };
    window.addEventListener("invalidToken", handler);
    return () => window.removeEventListener("invalidToken", handler);
  }, []);

  // ─── 聊天 / 系統 / 影片 / 交易 socket 事件 ────────────────────────────────
  useEffect(() => {
    // ✅ 關鍵：handler 本身在 closure 裡讀的是 ref，不是 state，
    //    所以整個 effect 只在 socket 改變時重新執行（綁定一次）
    const handleMessage = (m) => {
      if (m?.room && m.room !== roomRef.current) return;
      addMessage(m, userListRef.current);
      if (m?.mode === "private" || m?.mode === "publicTarget") {
        const isSender = m.user?.name === nameRef.current;
        const isTarget = m.target === nameRef.current;
        if (isSender || isTarget) {
          const other = isSender ? m.target : m.user?.name;
          if (other && other !== nameRef.current) {
            setContactedNames((prev) => (prev.has(other) ? prev : new Set(prev).add(other)));
          }
        }
      }
    };
    const handleSystemMessage = (m) => {
      if (!roomConfig.new_function && !roomConfig.new_section && m?.message?.includes('唱歌獲得') && m?.message?.includes(roomConfig.currency_name)) return;
      addSystemMessage(m);
    };
    const handleVideoUpdate = (v) => {
      if (!v) { setCurrentVideo(null); return; }
      const id = extractVideoID(v.url);
      if (closedVideoIdRef.current === id) return;
      setCurrentVideo(v);
    };
    const handleTransfer = (msg) => addTransactionMessage(msg, userListRef.current);
    const handleGift = (msg) => addGiftMessage(msg);

    socket.on("message", handleMessage);
    socket.on("systemMessage", handleSystemMessage);
    socket.on("videoUpdate", handleVideoUpdate);
    socket.on("transferMessage", handleTransfer);
    socket.on("giftMessage", handleGift);

    return () => {
      socket.off("message", handleMessage);
      socket.off("systemMessage", handleSystemMessage);
      socket.off("videoUpdate", handleVideoUpdate);
      socket.off("transferMessage", handleTransfer);
      socket.off("giftMessage", handleGift);
    };
  }, [socket, addMessage, addSystemMessage, addTransactionMessage, addGiftMessage]);
  // addMessage 等函式全部是穩定的（useCallback deps=[]），所以等同只依賴 socket

  // ─── 每日金蘋果樂透 ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleSurprise = (data) => {
      addSurpriseMessage(data);
      // 若自己是得獎者，立即更新金蘋果數量
      if (data.winner && data.winner === nameRef.current) {
        setApples((prev) => prev + data.amount);
      }
    };
    socket.on("goldenAppleSurprise", handleSurprise);
    return () => socket.off("goldenAppleSurprise", handleSurprise);
  }, [socket, addSurpriseMessage]);

  useEffect(() => {
    const handlePeonySent = (data) => addPeonyMessage(data);
    socket.on("peonySent", handlePeonySent);
    return () => socket.off("peonySent", handlePeonySent);
  }, [socket, addPeonyMessage]);

  useEffect(() => {
    const onStart = () => setMarqueeActive(true);
    const onEnd   = () => setMarqueeActive(false);
    socket.on("marqueeStart", onStart);
    socket.on("marqueeEnd",   onEnd);
    return () => {
      socket.off("marqueeStart", onStart);
      socket.off("marqueeEnd",   onEnd);
    };
  }, [socket]);

  useEffect(() => {
    const onStart = () => setPushCardActive(true);
    const onEnd   = () => setPushCardActive(false);
    socket.on("pushCardStart", onStart);
    socket.on("pushCardEnd",   onEnd);
    return () => {
      socket.off("pushCardStart", onStart);
      socket.off("pushCardEnd",   onEnd);
    };
  }, [socket]);

  useEffect(() => {
    const handleFrontendVersionUpdated = ({ version } = {}) => {
      if (!version) return;
      if (compareVersions(version, FRONTEND_VERSION) > 0) {
        triggerVersionRefresh();
      }
    };

    socket.on("frontendVersionUpdated", handleFrontendVersionUpdated);
    return () => socket.off("frontendVersionUpdated", handleFrontendVersionUpdated);
  }, [socket, triggerVersionRefresh]);

  useEffect(() => {
    const sourceLabel = (source) => {
      switch (source) {
        case "system_game1": return `撈${roomConfig.currency_name}`;
        case "system_game2": return `大${roomConfig.currency_name}`;
        case "system_whack": return `打${roomConfig.currency_name}`;
        case "system_claw": return `夾${roomConfig.currency_name}機`;
        case "system_surprise": return "每日樂透";
        default: return roomConfig.currency_name;
      }
    };

    const handleGoldAwarded = ({ username, source, credited, previousBalance, balance } = {}) => {
      if (username !== nameRef.current) return;
      if (typeof balance === "number") {
        setApples(balance);
        sessionStorage.setItem("apples", balance);
      }
      if ((credited || 0) > 0) {
        const before = typeof previousBalance === "number"
          ? previousBalance
          : typeof balance === "number"
            ? balance - credited
            : "?";
        addSystemMessage(`${roomConfig.currency_emoji} ${sourceLabel(source)} 獲得 ${credited} 顆，原本 ${before} 顆，入帳後 ${balance ?? "?"} 顆`);
      }
    };

    socket.on("goldAwarded", handleGoldAwarded);
    return () => socket.off("goldAwarded", handleGoldAwarded);
  }, [socket, addSystemMessage, setApples]);

  // ─── joinFailed / firework ────────────────────────────────────────────────
  useEffect(() => {
    const handleJoinFail = ({ reason }) => {
      alert(`⚠️ 加入房間失敗: ${reason}`);
      sessionStorage.clear();
      socket.disconnect();
      window.location.href = "/login";
    };

    const handleFirework = (data) => {
      const container = document.createElement("div");
      container.className = "firework-container";

      const img = document.createElement("img");
      img.src = "/gifts/firework-transparent.webp";
      img.className = "firework-gif";
      img.alt = "";

      const message = document.createElement("div");
      message.className = "firework-message";
      message.textContent = data.message || "";

      container.appendChild(img);
      container.appendChild(message);
      document.body.appendChild(container);
      setTimeout(() => container.remove(), 5000);
    };

    const showSnowballEffect = (text) => {
      console.log("❄️ showSnowballEffect:", text);
      const container = document.createElement("div");
      container.className = "snowball-container";

      const message = document.createElement("div");
      message.className = "snowball-message";
      message.textContent = text;
      container.appendChild(message);

      const FLAKE_COUNT = 24;
      for (let i = 0; i < FLAKE_COUNT; i++) {
        const flake = document.createElement("span");
        flake.className = "snowball-flake";
        flake.textContent = "❄️";
        flake.style.left = `${Math.random() * 100}%`;
        flake.style.animationDelay = `${(Math.random() * 0.4).toFixed(2)}s`;
        flake.style.fontSize = `${16 + Math.random() * 20}px`;
        container.appendChild(flake);
      }

      document.body.appendChild(container);
      setTimeout(() => container.remove(), 2500);
    };

    const handleSnowballHit = ({ from }) => {
      showSnowballEffect(`❄️ ${from} 對你丟了一個雪球！`);
    };

    const handleSnowballThrown = ({ target }) => {
      showSnowballEffect(`❄️ 你對 ${target} 丟了一個雪球！`);
    };

    const handleSnowballError = ({ reason }) => {
      console.log("❄️ snowballError:", reason);
      alert(`❄️ ${reason || "丟雪球失敗"}`);
    };

    socket.on("joinFailed", handleJoinFail);
    socket.on("fireworkShow", handleFirework);
    socket.on("snowballHit", handleSnowballHit);
    socket.on("snowballThrown", handleSnowballThrown);
    socket.on("snowballError", handleSnowballError);
    return () => {
      socket.off("joinFailed", handleJoinFail);
      socket.off("fireworkShow", handleFirework);
      socket.off("snowballHit", handleSnowballHit);
      socket.off("snowballThrown", handleSnowballThrown);
      socket.off("snowballError", handleSnowballError);
    };
  }, [socket]);

  // ─── forceLogout / kickFailed ─────────────────────────────────────────────
  useEffect(() => {
    const handleForceLogout = ({ by }) => {
      sessionStorage.setItem("forceLogoutBy", by);
      sessionStorage.setItem("blockedUntil", Date.now() + 5000);
      window.location.href = "/login";
    };
    const handleKickFailed = ({ reason }) => window.alert(reason);

    socket.on("forceLogout", handleForceLogout);
    socket.on("kickFailed", handleKickFailed);
    return () => {
      socket.off("forceLogout", handleForceLogout);
      socket.off("kickFailed", handleKickFailed);
    };
  }, [socket]);

  // ─── 自動 joinRoom ────────────────────────────────────────────────────────
  useEffect(() => {
    if (joinedRef.current || !name) return;
    socket.emit("joinRoom", {
      room,
      user: {
        name,
        type: sessionStorage.getItem("type") || "guest",
        token: sessionStorage.getItem("token") || sessionStorage.getItem("guestToken"),
        invisible,
      },
    });
    joinedRef.current = true;
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 發話獎勵：上線後先跟後端校正一次本地計數器 ──────────────────────────
  // joinRoom 是 async handler，緊接著送 claimSpeechReward 可能會搶在伺服器把
  // socket.data.room/name 設好之前送達；改成等第一次 updateUsers（join 完成後
  // 伺服器一定會 broadcastUserList）才校正一次，確保當下讀到的一定是正確身分。
  useEffect(() => {
    if (!(roomConfig.new_section || roomConfig.new_function)) return;
    let calibrated = false;
    const handleFirstUpdateUsers = () => {
      if (calibrated) return;
      calibrated = true;
      socket.off("updateUsers", handleFirstUpdateUsers);
      socket.emit("claimSpeechReward", { room }, (res) => {
        if (res && Number.isFinite(res.remainder)) {
          speechCountRef.current = res.remainder;
        }
      });
    };
    socket.on("updateUsers", handleFirstUpdateUsers);
    return () => socket.off("updateUsers", handleFirstUpdateUsers);
  }, [socket, room]);

  // ─── 在線獎勵：上線先校正一次，之後由後端算出的剩餘秒數自己排下一次檢查 ──
  // 前端只負責「什麼時候該去問」，實際是否已經在線滿一段時間、發過幾次，
  // 全部由後端用 login_logs（最近一次成功登入時間）現算，不用前端自己計時累積，
  // 這樣重新整理頁面也不會讓在線時長歸零重算。
  useEffect(() => {
    if (!(roomConfig.new_section || roomConfig.new_function)) return;
    let cancelled = false;

    const scheduleNext = (delaySeconds) => {
      if (cancelled) return;
      if (onlineRewardTimerRef.current) clearTimeout(onlineRewardTimerRef.current);
      const delayMs = Math.max(1000, (Number(delaySeconds) || 3600) * 1000);
      onlineRewardTimerRef.current = setTimeout(claim, delayMs);
    };

    const claim = () => {
      socket.emit("claimOnlineReward", { room }, (res) => {
        scheduleNext(res && Number.isFinite(res.remainderSeconds) ? res.remainderSeconds : 3600);
      });
    };

    let calibrated = false;
    const handleFirstUpdateUsers = () => {
      if (calibrated) return;
      calibrated = true;
      socket.off("updateUsers", handleFirstUpdateUsers);
      claim();
    };
    socket.on("updateUsers", handleFirstUpdateUsers);

    return () => {
      cancelled = true;
      socket.off("updateUsers", handleFirstUpdateUsers);
      if (onlineRewardTimerRef.current) clearTimeout(onlineRewardTimerRef.current);
    };
  }, [socket, room]);

  // ─── beforeunload 登出 ────────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit("stop-listening", { room: roomRef.current, listenerId: nameRef.current });
      fetch(`${BACKEND}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: nameRef.current }),
        keepalive: true, // ✅ keepalive 確保瀏覽器關閉時請求還能送出
      }).catch(() => { });
      socket.disconnect();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [socket]);
  // ✅ 不依賴 room / name，改用 ref，避免每次打字都重新綁定

  // ─── cooldown 結束後 focus 輸入框 ────────────────────────────────────────
  useEffect(() => {
    if (!cooldown) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [cooldown]);

  // ─── 離開房間 ─────────────────────────────────────────────────────────────
  const leaveRoom = useCallback(async () => {
    try {
      socket.emit("stop-listening", { room, listenerId: name });
      socket.emit("leaveRoom", { room, user: { name } });
      await fetch(`${BACKEND}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
    } catch (e) {
      console.error("離開房間失敗", e);
    } finally {
      sessionStorage.clear();
      socket.disconnect();
      window.location.href = "/login";
    }
  }, [socket, room, name]);

  // ─── 發訊息 ───────────────────────────────────────────────────────────────
  const send = useCallback(() => {
    if (!socket.connected) { alert("你目前離線中，請重新連線"); return; }
    if (cooldown || !text.trim() || (chatMode !== "public" && !target)) return;

    socket.emit("message", {
      room,
      message: convertTC ? toTraditional(text) : text,
      color: chatColor,
      user: { name },
      target: target || "",
      mode: chatMode,
      emotion: textEmotion || "",
      timestamp: new Date().toLocaleTimeString(),
    });

    // 發話獎勵：累計次數達門檻才請後端雙重驗證並發放
    if (roomConfig.new_section || roomConfig.new_function) {
      const threshold = Math.max(1, Number(roomConfig.speech_reward_threshold) || 100);
      speechCountRef.current += 1;
      if (speechCountRef.current >= threshold) {
        speechCountRef.current = 0; // 先樂觀歸零避免連續觸發，等後端回覆權威值再校正
        socket.emit("claimSpeechReward", { room }, (res) => {
          // 後端用 message_logs 當日總數算出的 remainder 才是準的：
          // 若前端計數器因重新整理/多分頁而跟後端總數有落差，用這個值校正回來，
          // 否則落差會一直存在，200、300…之後的門檻永遠對不上而不會再發放。
          if (res && Number.isFinite(res.remainder)) {
            speechCountRef.current = res.remainder;
          }
        });
      }
    }

    setMessageHistory((prev) => [text, ...prev]);
    setHistoryIndex(-1);

    const cooldownSeconds = Math.max(0, Number(roomConfig.message_cooldown_seconds) || 0);
    setText("");
    if (cooldownSeconds > 0) {
      setCooldown(true);
      setPlaceholder(`請等待 ${cooldownSeconds} 秒後再發送…`);
      setTimeout(() => {
        setCooldown(false);
        setPlaceholder("輸入訊息...");
      }, cooldownSeconds * 1000);
    }
  }, [socket, cooldown, text, chatMode, target, room, convertTC, chatColor, name, textEmotion]);

  // ─── 發言紀錄瀏覽（舊版介面 < > 按鈕）────────────────────────────────────
  const recallOlderMessage = useCallback(() => {
    setHistoryIndex((idx) => {
      if (messageHistory.length === 0) return idx;
      const next = Math.min(idx + 1, messageHistory.length - 1);
      setText(messageHistory[next]);
      return next;
    });
  }, [messageHistory]);

  const recallNewerMessage = useCallback(() => {
    setHistoryIndex((idx) => {
      if (idx <= 0) {
        setText("");
        return -1;
      }
      const next = idx - 1;
      setText(messageHistory[next]);
      return next;
    });
  }, [messageHistory]);

  // ─── 點播影片 ─────────────────────────────────────────────────────────────
  const playVideo = useCallback(() => {
    const id = extractVideoID(videoUrl);
    if (!id) { alert("無法解析 YouTube 連結"); return; }
    socket.emit("playVideo", {
      room,
      url: `https://www.youtube.com/watch?v=${id}`,
      user: { name },
    });
    setVideoUrl("");
  }, [socket, room, videoUrl, name]);

  // ─── 讀取轉帳上限設定 ────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND}/api/transfer-limits?room=${RN}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.per_transfer_limit > 0) setPerTransferLimit(d.per_transfer_limit); })
      .catch(() => { });
  }, [token]);

  // ─── 送金蘋果 ─────────────────────────────────────────────────────────────
  const transferApple = useCallback(async () => {
    if (!target) { alert("請選擇對象"); return; }
    const isAdminSender = level >= ANL;
    const maxAllowed = (!isAdminSender && perTransferLimit > 0) ? Math.min(apples, perTransferLimit) : apples;
    const safeAmount = Math.max(1, Math.min(Math.floor(appleAmount), maxAllowed));
    if (safeAmount > apples) { alert(`${roomConfig.currency_name}不足`); return; }
    setSendingApple(true);
    try {
      const res = await fetch(`${BACKEND}/api/transfer-gold`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUsername: target, amount: safeAmount, room: RN }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.reason || data.error || "送出失敗");
      }
      setAppleAmount(1);
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingApple(false);
    }
  }, [target, appleAmount, token, apples, perTransferLimit, level, ANL]);

  const sendPeony = useCallback(async () => {
    if (!target) { alert("請選擇對象"); return; }
    setSendingPeony(true);
    try {
      const res = await fetch(`${BACKEND}/admin/send-peony`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUsername: target }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "送出失敗");
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSendingPeony(false);
    }
  }, [target, token]);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const selectTarget = useCallback((targetName) => {
    if (!targetName || targetName === name) return;
    setTarget(targetName);
    setChatMode(chatMode === "private" ? "private" : "publicTarget");
    setContactedNames((prev) => (prev.has(targetName) ? prev : new Set(prev).add(targetName)));
    focusInput();
  }, [chatMode, name, focusInput]);

  // ✅ 給 UserList 用的穩定 callback 參考（避免每次打字都重新建立新函式，
  // 讓 UserList 包 React.memo 之後真的能跳過重新 render）
  const kickUser = useCallback((targetName) => socket.emit("kickUser", { room, targetName }), [socket, room]);
  const kickAndBlockUser = useCallback((targetName, reason) => socket.emit("kickAndBlockUser", { room, targetName, reason }), [socket, room]);
  const muteUser = useCallback((targetName) => socket.emit("muteUser", { room, targetName }), [socket, room]);
  const onRpsChallenge = useCallback((targetName) => {
    if (gamesBusy) return;
    socket.emit("rpsChallenge", { room, challenger: name, target: targetName });
    setRpsPending(targetName);
  }, [socket, room, name, gamesBusy]);
  const onPingpongChallenge = useCallback((targetName) => {
    if (gamesBusy) return;
    socket.emit("pingpongChallenge", { room, challenger: name, target: targetName });
    setPingpongPending(targetName);
  }, [socket, room, name, gamesBusy]);
  const onSnowballThrow = useCallback((targetName) => {
    console.log("❄️ emit throwSnowball:", { room, from: name, target: targetName });
    socket.emit("throwSnowball", { room, from: name, target: targetName });
  }, [socket, room, name]);

  // ─── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className={`chat-layout${legacyChatUI ? " chat-layout--legacy" : ""}`}>
        {/* 左側聊天區 */}
        <div className="chat-left">
          <div className="chat-title-bar">
            <div className="chat-title">
              <a href="https://www.ek21.com" target="_blank" rel="noopener noreferrer"><img src="/logo/logo_ek21.gif" alt="尋夢園" style={{ height: '3em', verticalAlign: 'bottom', marginBottom: '-0.5em' }} /></a>{CN}聊天室
              <span className="app-version-badge" title="目前聊天室版本">
                v{FRONTEND_VERSION}
              </span>
              <button className="announce-btn" title="聊天室公告" onClick={() => setShowAnnouncement(true)}>
                📢公告
              </button>
              <button className="announce-btn" onClick={() => setShowMessageBoard(true)} title="聊天室留言板">
                💬 留言板
              </button>
              {isMember && <MyMessageLogPanel token={token} />}
              <DeferredPanel>
                {NF && <Leaderboard room={room} token={token} enabled={!!LB} />}
              </DeferredPanel>
              {!invisible && NF && isMember && (
                <button className="announce-btn" title="商城" onClick={() => { setShopTitle("商城"); setShowShop(true); }}>
                  <img src={`/gifts/${roomConfig.currency_icon}`} alt={roomConfig.currency_name} style={{ width: 20, height: 20, marginTop: -5 }} /> 商城
                </button>
              )}
              {!invisible && NF && isMember && (
                <button className="announce-btn" title="娛樂城" onClick={() => setShowCasino(true)}
                  style={{ background: "linear-gradient(135deg,#2a1500,#4a2800)", border: "1px solid #d4af37", color: "#ffd700" }}>
                  🎰 娛樂城
                </button>
              )}
              {!invisible && isMember && roomConfig.new_section && (
                <button className="announce-btn" title="賣場" onClick={() => { setShopTitle("賣場"); setShowShop(true); }}>
                  <img src={`/gifts/${roomConfig.currency_icon}`} alt={roomConfig.currency_name} style={{ width: 20, height: 20, marginTop: -5 }} /> 賣場
                </button>
              )}
              {!invisible && isMember && roomConfig.new_section && roomConfig.playground_enabled && (
                <button className="announce-btn" title="遊樂場" onClick={() => setShowPlayground(true)}
                  style={{ background: "linear-gradient(135deg,#003a2a,#005a45)", border: "1px solid #4fd0c8", color: "#7fffe8" }}>
                  🎡 遊樂場
                </button>
              )}
              {!invisible && isMember && roomConfig.lounge_enabled && (
                <button className="announce-btn" title="休閒廳" onClick={() => setShowLounge(true)}
                  style={{ background: "linear-gradient(135deg,#102316,#1a3d22)", border: "1px solid #7fbf8a", color: "#b7e8bd" }}>
                  🎲 休閒廳
                </button>
              )}
              {offline && !invalidTokenCountdown && <div className="offline-banner">⚠️ 網路不穩，重新連線中...</div>}
              {invalidTokenCountdown !== null && (
                <div className="reload-banner">
                  🔐 連線驗證過期，{invalidTokenCountdown} 秒後自動重新登入...
                </div>
              )}
              {showReloadNotice && (
                <div className="reload-banner">
                  🔄 聊天室版本已更新，30 秒後系統自動重新整理...
                </div>
              )}
            </div>
          </div>

          <AnnouncementPanel open={showAnnouncement} onClose={() => setShowAnnouncement(false)} myLevel={level} token={token} />
          {showMessageBoard && (
            <DeferredPanel>
              <MessageBoard token={token} myName={name} myLevel={level} open={showMessageBoard} onClose={() => setShowMessageBoard(false)} />
            </DeferredPanel>
          )}
          {showShop && (
            <DeferredPanel>
              <ShopPanel token={token} myName={name} myLevel={level} targetName={target} open={showShop} onClose={() => setShowShop(false)} title={shopTitle} />
            </DeferredPanel>
          )}
          {NF && showCasino && (
            <DeferredPanel>
              <CasinoPanel
                token={token} apples={apples} onApplesChange={setApples}
                open={showCasino} onClose={() => setShowCasino(false)}
                variant="casino" includePusher={false}
              />
            </DeferredPanel>
          )}
          {roomConfig.new_section && roomConfig.playground_enabled && (
            <DeferredPanel>
              <CasinoPanel
                token={token} apples={apples} onApplesChange={setApples}
                open={showPlayground} onClose={() => setShowPlayground(false)}
                variant="playground"
              />
            </DeferredPanel>
          )}
          {showLounge && (
            <DeferredPanel>
              <LoungePanel
                socket={socket} room={room} name={name} apples={apples}
                open={showLounge} onClose={() => setShowLounge(false)}
              />
            </DeferredPanel>
          )}

          {name && (
            <>
              <div className="chat-toolbar">
                <span>
                  Hi &nbsp;
                  <span className="chat-username" style={{ color: getUserColorByGender(gender) }}>
                    {name}
                  </span>
                  &nbsp;等級:{formatLv(level)}
                  {invisible && <span style={{ color: "#aaa", marginLeft: 6 }} title="其他人（非管理員）看不到你在線上">👻 隱形中</span>}
                  {isMember && initializedRef.current && level < ANL - 1
                    ? ` 積分: ${exp} / ${expForNextLevel(level)}`
                    : ""}
                  <span className="exp-tip-inline">
                    {expTips.map((tip) => <span key={tip.id} className="exp-tip">{tip.value}</span>)}
                  </span>
                  <span className="levelup-tip-inline">
                    {levelUpTips.map((tip) => <span key={tip.id} className="levelup-tip">{tip.value}</span>)}
                  </span>
                </span>

                <button onClick={leaveRoom}>離開</button>

                {isMember ? (
                  <>
                    {!invisible && !legacyChatUI && (
                      <div className="video-request">
                        <input
                          ref={videoUrlInputRef}
                          style={{ width: 130 }}
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          placeholder="貼上YouTube連結"
                        />
                        <button onClick={playVideo}>🎵 點播</button>
                      </div>
                    )}
                    {!invisible && (
                      <SongRoom ref={songRoomRef} room={room} name={name} socket={socket} currentSinger={currentSinger} myLevel={level} onSelectTarget={selectTarget} />
                    )}
                  </>
                ) : (
                  <>
                    {!legacyChatUI && (
                      <div className="video-request">
                        <button disabled title="登入會員即可使用點播功能" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                          🎵 點播（限會員）
                        </button>
                      </div>
                    )}
                    <button disabled title="登入會員即可使用唱歌功能" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                      🎤 唱歌（限會員）
                    </button>
                  </>
                )}

                <Listener ref={listenerRef} room={room} name={name} socket={socket} onSingerChange={setCurrentSinger} onSelectTarget={selectTarget} />
              </div>

              {/* ✅ visibleMessages 是 memoized，不會每次 render 重新過濾 */}
              <MessageList
                messages={visibleMessages}
                name={name}
                level={level}
                typing={typing}
                ownMessageLeft={ownMessageLeft}
                messagesEndRef={messagesEndRef}
                onSelectTarget={selectTarget}
                userList={userList}
                scrollLocked={scrollLocked}
                scrollLockedRef={scrollLockedRef}
                legacyUI={legacyChatUI}
              />

              {legacyChatUI ? (
                <div className="chat-input chat-input--legacy">
                  <div className="legacy-row">
                    <span className="legacy-label">發言:</span>
                    <button
                      type="button"
                      className="legacy-btn legacy-btn-grey legacy-history-btn"
                      onClick={recallOlderMessage}
                      disabled={messageHistory.length === 0 || historyIndex >= messageHistory.length - 1}
                      title="上一筆紀錄"
                    >
                      &lt;
                    </button>
                    <input
                      ref={inputRef}
                      className="legacy-text-input"
                      value={text}
                      onChange={(e) => { setText(e.target.value); setHistoryIndex(-1); }}
                      onKeyDown={(e) => e.key === "Enter" && send()}
                      placeholder={placeholder}
                      disabled={cooldown}
                    />
                    <button
                      type="button"
                      className="legacy-btn legacy-btn-grey legacy-history-btn"
                      onClick={recallNewerMessage}
                      disabled={historyIndex < 0}
                      title="下一筆紀錄"
                    >
                      &gt;
                    </button>
                    <button className="legacy-btn legacy-btn-grey" onClick={send} disabled={cooldown}>送出</button>
                  </div>

                  <div className="legacy-row">
                    <FunctionMenuPicker
                      items={[
                        { label: "站務公告", onClick: () => setShowAnnouncement(true) },
                        { label: "編輯常用詞", onClick: () => setQuickPhraseOpenSignal((n) => n + 1) },
                        ...(!invisible ? [
                          { label: "點播歌曲", onClick: () => setShowSongRequestModal(true) },
                          { label: "開始聽", onClick: () => listenerRef.current?.startListen() },
                          { label: "結束聽", onClick: () => listenerRef.current?.stopListen() },
                          { label: "排麥", onClick: () => songRoomRef.current?.startVoice() },
                          { label: "下麥", onClick: () => songRoomRef.current?.stopVoice() },
                        ] : []),
                      ]}
                    />
                    <TextEmotionPicker value={textEmotion} onChange={setTextEmotion} />
                    <ColorSwatchPicker
                      value={chatColor}
                      onChange={(c) => {
                        setChatColor(c);
                        sessionStorage.setItem("chatColor", c);
                      }}
                    />
                    <QuickPhrasePanel
                      token={token}
                      onSelect={(content) => setText((prev) => (prev ? prev + " " : "") + content)}
                      openSignal={quickPhraseOpenSignal}
                      triggerClassName="legacy-select-pink"
                      triggerLabel="常用詞句 ▾"
                    />
                    {level >= ANL && (
                      <AppErrorBoundary label="管理工具">
                        {showAdminTools ? (
                          <DeferredPanel>
                            <AdminToolPanel
                              myName={name}
                              myLevel={level}
                              token={token}
                              userList={userList}
                              initialOpen
                            />
                          </DeferredPanel>
                        ) : (
                          <button className="legacy-btn legacy-btn-yellow" onClick={() => setShowAdminTools(true)}>
                            🛡 管理
                          </button>
                        )}
                      </AppErrorBoundary>
                    )}
                    <label className="legacy-check">
                      <input
                        type="checkbox"
                        checked={!scrollLocked}
                        onChange={(e) => {
                          const next = !e.target.checked;
                          scrollLockedRef.current = next;
                          setScrollLocked(next);
                        }}
                      /> 捲動
                    </label>
                    <label className="legacy-check">
                      <input
                        type="checkbox"
                        checked={chatMode === "private"}
                        disabled={invisible}
                        onChange={(e) => setChatMode(e.target.checked ? "private" : (target ? "publicTarget" : "public"))}
                      /> 密談
                    </label>
                    <label className="legacy-check">
                      <input type="checkbox" checked={convertTC} onChange={(e) => setConvertTC(e.target.checked)} /> 簡-繁
                    </label>
                    <span className="legacy-label legacy-label-green">對象:</span>
                    {chatMode !== "public" && (
                      <select
                        className="legacy-select-green"
                        value={target}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTarget(val);
                          if (chatMode !== "private") setChatMode(val ? "publicTarget" : "public");
                          focusInput();
                        }}
                      >
                        <option value="">選擇對象</option>
                        {userList
                          .filter((u) => u.name !== name && contactedNames.has(u.name))
                          .map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>
                    )}
                    <button
                      className="legacy-btn legacy-btn-green"
                      onClick={() => {
                        setTarget("");
                        if (chatMode !== "private") setChatMode("public");
                      }}
                    >
                      清空對象
                    </button>
                    <button className="legacy-btn legacy-btn-yellow" onClick={clearMessages}>清除畫面</button>
                    <button className="legacy-btn legacy-btn-pink" onClick={leaveRoom}>離開</button>
                  </div>
                </div>
              ) : (
                <div className="chat-input">
                  <button className="clear-btn" onClick={clearMessages}>🧹清空畫面</button>
                  <button
                    className={`clear-btn scroll-lock-btn${scrollLocked ? " active" : ""}`}
                    onClick={() => {
                      const next = !scrollLockedRef.current;
                      scrollLockedRef.current = next;
                      setScrollLocked(next);
                    }}
                    title={scrollLocked ? "自動捲動" : "停止捲動"}
                  >
                    {scrollLocked ? "🔓自動捲動" : "🔒停止捲動"}
                  </button>

                  {/* ✅ 管理工具包 AppErrorBoundary，防止管理面板錯誤炸掉整個聊天室 */}
                  {level >= ANL && (
                    <AppErrorBoundary label="管理工具">
                      {showAdminTools ? (
                        <DeferredPanel>
                          <AdminToolPanel
                            myName={name}
                            myLevel={level}
                            token={token}
                            userList={userList}
                            initialOpen
                          />
                        </DeferredPanel>
                      ) : (
                        <button className="admin-btn" onClick={() => setShowAdminTools(true)}>
                          🛡 管理
                        </button>
                      )}
                    </AppErrorBoundary>
                  )}

                  {!invisible && (
                    <>
                      <label><input type="radio" checked={chatMode === "public"} onChange={() => { setChatMode("public"); setTarget(""); }} /> 公開</label>
                      <label><input type="radio" checked={chatMode === "publicTarget"} onChange={() => setChatMode("publicTarget")} /> 公開對象</label>
                    </>
                  )}
                  <label><input type="radio" checked={chatMode === "private"} onChange={() => setChatMode("private")} /> 私聊</label>

                  {chatMode !== "public" && (
                    <select value={target} onChange={(e) => { setTarget(e.target.value); focusInput(); }}>
                      <option value="">選擇對象</option>
                      {userList
                        .filter((u) => u.name !== name)
                        .map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                  )}

                  <input
                    type="color"
                    value={chatColor}
                    title="選擇聊天顏色"
                    onChange={(e) => {
                      setChatColor(e.target.value);
                      sessionStorage.setItem("chatColor", e.target.value);
                    }}
                  />

                  <QuickPhrasePanel
                    token={token}
                    onSelect={(content) => setText((prev) => (prev ? prev + " " : "") + content)}
                  />

                  <label>
                    <input type="checkbox" checked={convertTC} onChange={(e) => setConvertTC(e.target.checked)} />
                    簡轉繁
                  </label>

                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={placeholder}
                    disabled={cooldown}
                  />
                  <button onClick={send} disabled={cooldown}>發送</button>
                </div>
              )}

              {showSongRequestModal && (
                <div className="song-request-modal-overlay" onClick={() => setShowSongRequestModal(false)}>
                  <div className="song-request-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="song-request-modal-title">🎵 點播歌曲</div>
                    <input
                      autoFocus
                      className="song-request-modal-input"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="貼上YouTube連結"
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        playVideo();
                        setShowSongRequestModal(false);
                      }}
                    />
                    <div className="song-request-modal-actions">
                      <button onClick={() => setShowSongRequestModal(false)}>取消</button>
                      <button
                        className="song-request-modal-submit"
                        onClick={() => { playVideo(); setShowSongRequestModal(false); }}
                      >
                        送出點播
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(NF || roomConfig.new_section) && isMember && (
                <div className="trade-apple">
                  <div className="trade-apple-label" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {level >= AML && (
                      <button className="admin-btn" onClick={() => setShowAppleSetting(true)}>⚙️ 設定</button>
                    )}
                    {level >= AML && (
                      <button
                        className="admin-btn"
                        disabled={marqueeActive || invisible}
                        onClick={() => socket.emit("startMarquee", { token, room: RN })}
                        title={invisible ? "隱身模式下無法開始跑馬燈" : marqueeActive ? "跑馬燈進行中" : "開始跑馬燈抽獎"}
                      >
                        {marqueeActive ? "🎰 進行中…" : "🎰 跑馬燈"}
                      </button>
                    )}
                    {level >= AML && (
                      <button
                        className="admin-btn"
                        disabled={pushCardActive || invisible}
                        onClick={() => socket.emit("startPushCard", { token, room: RN })}
                        title={invisible ? "隱身模式下無法開始推牌遊戲" : pushCardActive ? "推牌遊戲進行中" : "開始推牌遊戲"}
                      >
                        {pushCardActive ? "🃏 進行中…" : "🃏 推牌"}
                      </button>
                    )}
                    {!roomConfig.new_section && <SurpriseHistoryPanel token={token} />}
                    {roomConfig.currency_name === "金幣" && <>{roomConfig.currency_name}樂園{" "}</>}
                    <img src={`/gifts/${roomConfig.currency_icon}`} alt={roomConfig.currency_name} style={{ width: 20, height: 20, marginTop: -5 }} />{" "}
                    當前{roomConfig.currency_name}數量：{apples}
                  </div>

                  {!invisible && !roomConfig.new_section && (
                    <>
                      <select value={target} onChange={(e) => setTarget(e.target.value)}>
                        <option value="">選擇對象</option>
                        {userList
                          .filter((u) => u.name !== name && u.type === "account")
                          .map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>

                      <input
                        type="number"
                        min={1}
                        max={(level < ANL && perTransferLimit > 0) ? Math.min(apples, perTransferLimit) : apples}
                        value={appleAmount}
                        onChange={(e) => {
                          const maxVal = (level < ANL && perTransferLimit > 0) ? Math.min(apples, perTransferLimit) : apples;
                          setAppleAmount(Math.max(1, Math.min(maxVal, Math.floor(Number(e.target.value)))));
                        }}
                        className="apple-amount-input"
                      />

                      <button disabled={sendingApple} onClick={transferApple} className="apple-send-btn">
                        送{roomConfig.currency_name}{" "}
                        <img src={`/gifts/${roomConfig.currency_icon}`} alt={roomConfig.currency_name} style={{ width: 20, height: 20, marginTop: -5 }} />
                      </button>

                      {level >= AML && roomConfig.open_peony && (
                        <button disabled={sendingPeony} onClick={sendPeony} className="apple-send-btn" style={{ backgroundColor: "#87CEEB" }}>
                          送金牡丹{" "}
                          <img src="/gifts/peony.gif" alt="金牡丹" style={{ width: 20, height: 20, marginTop: -5 }} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* 右側使用者列表 & 影片 */}
        <div className="chat-right">
          <div className="youtube-container">
            <VideoSafeBoundary>
              <VideoPlayer
                video={currentVideo}
                extractVideoID={extractVideoID}
                onClose={() => {
                  setClosedVideoId(extractVideoID(currentVideo?.url));
                  setCurrentVideo(null);
                }}
              />
            </VideoSafeBoundary>
          </div>

          {/* ✅ UserList 包 AppErrorBoundary */}
          <AppErrorBoundary label="使用者列表">
            <UserList
              userList={userList}
              target={target}
              setTarget={setTarget}
              setChatMode={setChatMode}
              chatMode={chatMode}
              onSelectTarget={selectTarget}
              userListCollapsed={userListCollapsed}
              setUserListCollapsed={setUserListCollapsed}
              kickUser={kickUser}
              kickAndBlockUser={kickAndBlockUser}
              muteUser={muteUser}
              gamesBusy={gamesBusy}
              onRpsChallenge={invisible ? undefined : onRpsChallenge}
              onPingpongChallenge={invisible ? undefined : onPingpongChallenge}
              onSnowballThrow={invisible ? undefined : onSnowballThrow}
              myLevel={level}
              myName={name}
              filteredUsers={filteredUsers}
              setFilteredUsers={setFilteredUsers}
              focusInput={focusInput}
              token={token}
            />
          </AppErrorBoundary>
        </div>
      </div>

      {/* 猜拳遊戲浮動元件 */}
      <RPS
        socket={socket}
        room={room}
        name={name}
        pendingTarget={rpsPending}
        onClearPending={() => setRpsPending(null)}
        onActiveChange={setRpsActive}
      />

      {/* 乒乓球遊戲浮動元件 */}
      <PingPong
        socket={socket}
        room={room}
        name={name}
        pendingTarget={pingpongPending}
        onClearPending={() => setPingpongPending(null)}
        onActiveChange={setPingpongActive}
      />

      {showAppleSetting && (
        <DeferredPanel>
          <AdminSettingsModal
            open={showAppleSetting}
            onClose={() => setShowAppleSetting(false)}
            token={token}
            BACKEND={BACKEND}
          />
        </DeferredPanel>
      )}

      {/* 撈金蘋果遊戲覆蓋層（全螢幕，有遊戲時才渲染） */}
      <DeferredPanel>
        {NF && !roomConfig.new_section && (
          <GoldAppleGame
            socket={socket}
            token={token}
            name={name}
            setApples={setApples}
          />
        )}
      </DeferredPanel>

      {/* 打金蘋果遊戲（打地鼠風格，有遊戲時才渲染） */}
      <DeferredPanel>
        {NF && !roomConfig.new_section && (
          <WhackAppleGame
            socket={socket}
            token={token}
            name={name}
            setApples={setApples}
          />
        )}
      </DeferredPanel>

      {/* 夾蘋果機遊戲（夾娃娃機風格，有遊戲時才渲染） */}
      <DeferredPanel>
        {NF && !roomConfig.new_section && (
          <ClawMachineGame
            socket={socket}
            token={token}
            name={name}
            setApples={setApples}
          />
        )}
      </DeferredPanel>

      {/* 櫻桃樹接櫻桃遊戲（new_section 模式專用，取代舊版撈金蘋果遊戲一）；
          遊樂場關閉時改由挖寶遊戲取代 */}
      <DeferredPanel>
        {roomConfig.new_section && roomConfig.playground_enabled && (
          <CherryTreeGame
            socket={socket}
            token={token}
            name={name}
            setApples={setApples}
          />
        )}
      </DeferredPanel>

      {/* 挖寶遊戲（new_section 模式且遊樂場關閉時取代接櫻桃） */}
      <DeferredPanel>
        {roomConfig.new_section && !roomConfig.playground_enabled && (
          <DigTreasureGame
            socket={socket}
            token={token}
            name={name}
            setApples={setApples}
          />
        )}
      </DeferredPanel>

      {/* 跑馬燈抽獎遊戲（管理員手動觸發），右下角小卡片顯示狀態，不擋畫面；
          跟觸發按鈕（trade-apple 那段）用同一個條件，new_section 房間也要看得到 */}
      <DeferredPanel>
        {(NF || roomConfig.new_section) && (
          <MarqueeGame
            socket={socket}
            name={name}
            userList={userList}
          />
        )}
      </DeferredPanel>

      {/* 推牌遊戲（管理員手動觸發），右下角小卡片顯示狀態，不擋畫面；玩法/版面參考跑馬燈 */}
      <DeferredPanel>
        {(NF || roomConfig.new_section) && (
          <PushCardGame
            socket={socket}
            token={token}
            name={name}
          />
        )}
      </DeferredPanel>
    </>
  );
}
