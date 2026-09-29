// session.js — 登入狀態檢查 / 導回登入頁的共用工具
// 頁面重新整理（手動、錯誤自動重整、斷線重連）後都要先確認「現在到底還是不是登入狀態」，
// 不能直接拿 sessionStorage 裡的舊 token 去 joinRoom：帳號被別處搶登後，舊 token 早就失效，
// 原本卻會照樣進房、把新登入的裝置踢掉，接著又被踢回來，造成互踢/無限重整。
import { BACKEND, RN } from "./roomConfig";

const LOGIN_NOTICE_KEY = "loginNotice";

export function getSessionToken() {
  try {
    return sessionStorage.getItem("token") || sessionStorage.getItem("guestToken") || null;
  } catch {
    return null;
  }
}

// 清掉登入資料並導回登入頁；notice 會在登入頁顯示一次（說明為什麼被登出）
export function goLogin(notice) {
  try {
    sessionStorage.clear();
    if (notice) sessionStorage.setItem(LOGIN_NOTICE_KEY, notice);
  } catch { /* ignore */ }
  // replace：不留下 /chat 的歷史紀錄，避免按「上一頁」又回到失效的聊天室
  window.location.replace("/login");
}

export function peekLoginNotice() {
  try {
    return sessionStorage.getItem(LOGIN_NOTICE_KEY) || "";
  } catch {
    return "";
  }
}

export function takeLoginNotice() {
  try {
    const n = sessionStorage.getItem(LOGIN_NOTICE_KEY);
    if (n) sessionStorage.removeItem(LOGIN_NOTICE_KEY);
    return n || "";
  } catch {
    return "";
  }
}

// 向後端確認 token 是否仍有效
//   "none"    — 本地沒有 token（尚未登入）
//   "valid"   — 有效，data 為 /auth/me 回傳內容
//   "invalid" — 後端明確回 401/403（已被搶登或連線到期）
//   "unknown" — 網路錯誤/逾時/5xx，無法判斷
export async function checkSession({ timeoutMs = 6000 } = {}) {
  const token = getSessionToken();
  if (!token) return { status: "none" };
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${BACKEND}/auth/me?room=${encodeURIComponent(RN)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl?.signal,
    });
    if (res.status === 401 || res.status === 403) return { status: "invalid" };
    if (!res.ok) return { status: "unknown" };
    const data = await res.json();
    // 後端若補發了新 token，舊的已經作廢，要立刻換掉
    const fresh = data?.newToken || data?.token;
    if (fresh && fresh !== token) {
      try {
        const key = sessionStorage.getItem("token") ? "token" : "guestToken";
        sessionStorage.setItem(key, fresh);
      } catch { /* ignore */ }
    }
    return { status: "valid", data, token: fresh || token };
  } catch {
    return { status: "unknown" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const SESSION_EXPIRED_NOTICE = "帳號已在其他地方登入，或連線已到期，請重新登入";
