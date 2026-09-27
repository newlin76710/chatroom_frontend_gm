// autoReload.js — 錯誤邊界接到錯誤時自動重新整理，重整後跳出「連線到期，已自動重整頁面」提示。
// 最常見的情境是：前端重新部署後，分頁還開著舊版，點「賣場送禮」或左下角按鈕時要 lazy 載入的
// 舊檔名 chunk 已經不存在（Failed to fetch dynamically imported module），畫面就變成錯誤訊息/黑屏。
// 這種情況重新整理一次就好，所以直接幫玩家重整，不讓他們卡在錯誤畫面。
//
// 防無限重整：短時間內（RELOAD_GUARD_MS）已經自動重整過一次還是出錯，代表不是版本過期而是真的壞了，
// 這時回傳 false，讓錯誤邊界照舊顯示錯誤訊息，不再重整。

const RELOAD_AT_KEY = "autoReloadAt";
const NOTICE_KEY = "autoReloadNotice";
const RELOAD_GUARD_MS = 20_000;
const NOTICE_TEXT = "連線到期，已自動重整頁面";

export function autoReloadOnError() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_AT_KEY)) || 0;
    if (Date.now() - last < RELOAD_GUARD_MS) return false;
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
    sessionStorage.setItem(NOTICE_KEY, "1");
  } catch {
    return false; // sessionStorage 不能用就沒辦法防無限重整，乾脆不自動重整
  }
  window.location.reload();
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
