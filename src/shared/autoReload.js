// autoReload.js — 錯誤邊界接到錯誤時自動重新整理，重整後跳出「連線到期，已自動重整頁面」提示。
// 最常見的情境是：前端重新部署後，分頁還開著舊版，點「賣場送禮」或左下角按鈕時要 lazy 載入的
// 舊檔名 chunk 已經不存在（Failed to fetch dynamically imported module），畫面就變成錯誤訊息/黑屏。
// 這種情況重新整理一次就好，所以直接幫玩家重整，不讓他們卡在錯誤畫面。
//
// 防無限重整：RELOAD_WINDOW_MS 內已經自動重整過 MAX_AUTO_RELOADS 次還是出錯，代表不是版本過期而是真的壞了
// （例如帳號已被搶登、狀態卡住），這時不再重整：在聊天室就直接清掉登入資料跳回登入頁，其他頁面則顯示錯誤訊息。
//
// 重整前會先確認登入狀態（見 session.js）：
//   - 沒有 token（尚未登入）→ 直接跳登入頁，不用重整
//   - token 已失效（被搶登/連線到期）→ 清掉登入資料跳登入頁；原本會重整回聊天室、拿舊 token 進房又出錯，一直循環
//   - 有效或無法判斷（網路不穩）→ 照常重整
import { checkSession, getSessionToken, goLogin, SESSION_EXPIRED_NOTICE } from "./session";

const RELOAD_LOG_KEY = "autoReloadLog";
const NOTICE_KEY = "autoReloadNotice";
const RELOAD_WINDOW_MS = 120_000;
const MAX_AUTO_RELOADS = 2;
const NOTICE_TEXT = "連線到期，已自動重整頁面";

let reloadingNow = false;

function isChatPage() {
  return window.location.pathname.startsWith("/chat");
}

export function autoReloadOnError() {
  if (reloadingNow) return true; // 多個錯誤邊界同時接到錯誤，只處理一次
  let log;
  try {
    const now = Date.now();
    log = JSON.parse(sessionStorage.getItem(RELOAD_LOG_KEY) || "[]").filter(
      (t) => Number.isFinite(t) && now - t < RELOAD_WINDOW_MS
    );
    if (log.length >= MAX_AUTO_RELOADS) {
      if (isChatPage()) {
        reloadingNow = true;
        goLogin("頁面連續發生錯誤，已登出，請重新登入");
        return true;
      }
      return false;
    }
    log.push(now);
    sessionStorage.setItem(RELOAD_LOG_KEY, JSON.stringify(log));
  } catch {
    return false; // sessionStorage 不能用就沒辦法防無限重整，乾脆不自動重整
  }
  reloadingNow = true;

  if (!isChatPage()) {
    try { sessionStorage.setItem(NOTICE_KEY, "1"); } catch { /* ignore */ }
    window.location.reload();
    return true;
  }
  if (!getSessionToken()) {
    goLogin(); // 尚未登入
    return true;
  }
  checkSession().then(({ status }) => {
    if (status === "invalid" || status === "none") {
      goLogin(SESSION_EXPIRED_NOTICE);
      return;
    }
    try { sessionStorage.setItem(NOTICE_KEY, "1"); } catch { /* ignore */ }
    window.location.reload();
  });
  return true;
}

// App 啟動時呼叫：上一頁是自動重整的話，跳出提示（純 DOM，不依賴 React 狀態）
export function showAutoReloadNoticeIfAny() {
  try {
    if (sessionStorage.getItem(NOTICE_KEY) !== "1") return;
    sessionStorage.removeItem(NOTICE_KEY);
  } catch {
    return;
  }
  const show = () => {
    const el = document.createElement("div");
    el.textContent = `🔄 ${NOTICE_TEXT}`;
    el.style.cssText = [
      "position:fixed", "top:16px", "left:50%", "transform:translateX(-50%)",
      "z-index:100000", "padding:10px 18px", "border-radius:8px",
      "background:rgba(20,20,20,0.92)", "color:#fff", "font-size:15px",
      "box-shadow:0 4px 16px rgba(0,0,0,0.4)", "pointer-events:none",
      "transition:opacity 0.4s", "max-width:calc(100vw - 32px)", "text-align:center",
    ].join(";");
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; }, 3600);
    setTimeout(() => el.remove(), 4000);
  };
  if (document.body) show();
  else window.addEventListener("DOMContentLoaded", show, { once: true });
}
