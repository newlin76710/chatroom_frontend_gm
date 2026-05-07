import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 全域攔截 fetch，偵測後端回 Invalid token 時派送事件
const _origFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const res = await _origFetch(...args);
  if (res.status === 401) {
    res.clone().json().then(data => {
      if (data?.error === "Invalid token") {
        window.dispatchEvent(new Event("invalidToken"));
      }
    }).catch(() => {});
  }
  return res;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
