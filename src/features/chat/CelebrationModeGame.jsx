// CelebrationModeGame.jsx — 專屬慶典模式（僅金幣模式）。跟金幣雨一樣是任何玩家都能自己
// 發動，做成獨立的浮動按鈕。選主題（生日/情人節/節慶/自訂文字）+ 金額扣款後觸發，全場
// 飄落特效由 ChatApp.jsx 的 enqueueEffect 播放，這裡只負責發起的 UI。

import { useState, useEffect, useCallback, useRef } from "react";
import "./CelebrationModeGame.css";

import { RN, roomConfig } from "../../shared/roomConfig";

const THEMES = [
  { key: "birthday", label: "🎂 生日" },
  { key: "valentine", label: "💕 情人節" },
  { key: "festival", label: "🎉 節慶" },
  { key: "custom", label: "✨ 自訂慶祝" },
];

const MAX_CUSTOM_TEXT_LENGTH = 60;

export default function CelebrationModeGame({ socket, token, name, apples }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState("birthday");
  const [customText, setCustomText] = useState("");
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [sending, setSending] = useState(false);
  const tokenRef = useRef(token);

  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    const onStart = ({ sender } = {}) => {
      if (sender !== name) return;
      setSending(false);
      setOpen(false);
      setCustomText("");
      setSelectedAmount(null);
      setErrorMsg("");
    };
    const onError = ({ reason } = {}) => {
      setSending(false);
      setErrorMsg(reason || "發起失敗");
    };
    socket.on("celebrationStart", onStart);
    socket.on("celebrationError", onError);
    return () => {
      socket.off("celebrationStart", onStart);
      socket.off("celebrationError", onError);
    };
  }, [socket, name]);

  const send = useCallback(() => {
    if (!selectedAmount || sending) return;
    if (theme === "custom" && !customText.trim()) {
      setErrorMsg("請填寫自訂祝福語");
      return;
    }
    setSending(true);
    setErrorMsg("");
    socket.emit("startCelebration", {
      token: tokenRef.current,
      room: RN,
      amount: selectedAmount,
      theme,
      customText: theme === "custom" ? customText.trim() : undefined,
    });
  }, [socket, selectedAmount, sending, theme, customText]);

  if (roomConfig.currency_name !== "金幣") return null;

  const options = String(roomConfig.celebration_amount_options || "100,500,1000")
    .split(",")
    .map((s) => Math.floor(Number(s.trim())))
    .filter((n) => Number.isFinite(n) && n > 0);

  return (
    <div className="cmg-corner">
      {!open ? (
        <button className="cmg-trigger" onClick={() => setOpen(true)} title="發起慶典">🎉</button>
      ) : (
        <div className="cmg-panel">
          <div className="cmg-header">
            <span className="cmg-title">🎉 專屬慶典模式</span>
            <button className="cmg-close" onClick={() => { setOpen(false); setErrorMsg(""); }}>✖</button>
          </div>

          <div className="cmg-theme-row">
            {THEMES.map((t) => (
              <button
                key={t.key}
                className={`cmg-theme-btn${theme === t.key ? " cmg-theme-selected" : ""}`}
                onClick={() => setTheme(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {theme === "custom" && (
            <input
              type="text"
              className="cmg-custom-input"
              value={customText}
              maxLength={MAX_CUSTOM_TEXT_LENGTH}
              placeholder="輸入自訂祝福語…"
              onChange={(e) => setCustomText(e.target.value)}
            />
          )}

          <div className="cmg-options">
            {options.map((opt) => (
              <button
                key={opt}
                className={`cmg-option-btn${selectedAmount === opt ? " cmg-option-selected" : ""}`}
                disabled={apples != null && opt > apples}
                onClick={() => setSelectedAmount(opt)}
              >
                {opt}
              </button>
            ))}
          </div>

          {errorMsg && <p className="cmg-error">{errorMsg}</p>}
          <button className="cmg-send-btn" disabled={!selectedAmount || sending} onClick={send}>
            {sending ? "發起中…" : "確定發起"}
          </button>
        </div>
      )}
    </div>
  );
}
