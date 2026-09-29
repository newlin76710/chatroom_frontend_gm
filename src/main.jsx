import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import RootErrorBoundary from "./shared/RootErrorBoundary";
import { autoReloadOnError, showAutoReloadNoticeIfAny } from "./shared/autoReload";

// 上一頁若是因錯誤自動重整過來的，跳出「連線到期，已自動重整頁面」提示
showAutoReloadNoticeIfAny();

// 改版後舊分頁 lazy 載入舊 chunk 失敗（Vite 會派送 vite:preloadError）：直接自動重整，
// 不等它變成錯誤畫面。preventDefault 讓 Vite 不再往外丟錯；防無限重整時則照常丟出交給錯誤邊界
window.addEventListener("vite:preloadError", (e) => {
  if (autoReloadOnError()) e.preventDefault();
});

// 全域攔截 fetch，偵測後端回 Invalid token 時派送事件
const _origFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const res = await _origFetch(...args);
  if (res.status === 401) {
    res.clone().json().then(data => {
      // 後端 authMiddleware 失效時回的是「連線到期，請重新登入」之類的訊息，不是 "Invalid token"
      const err = String(data?.error || "");
      if (err === "Invalid token" || /連線.*到期/.test(err)) {
        window.dispatchEvent(new Event("invalidToken"));
      }
    }).catch(() => {});
  }
  return res;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
