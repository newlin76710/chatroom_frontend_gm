// CelebrationModeGame.jsx — 專屬慶典模式（僅金幣模式）。跟金幣雨一樣是任何玩家都能自己
// 發動，做成獨立的浮動按鈕。選主題（生日/情人節/節慶/自訂文字）+ 快選或自訂金額（不超過後台
// 單次上限）扣款後觸發，扣下的金幣依發起人自己選的「均分／隨機」分給全場；全場飄落特效由 ChatApp.jsx
// 的 enqueueEffect 播放，這裡只負責發起的 UI。

import { useState, useEffect, useCallback, useRef } from "react";
import "./CelebrationModeGame.css";

import { RN, roomConfig } from "../../shared/roomConfig";

const THEMES = [
  { key: "birthday", label: "🎂 生日" },
  { key: "valentine", label: "💕 情人節" },
  { key: "festival", label: "🎉 節慶" },
  { key: "christmas", label: "🎄 聖誕節" },
  { key: "newyear", label: "🎊 新年" },
  { key: "custom", label: "✨ 自訂慶祝" },
];

const MAX_CUSTOM_TEXT_LENGTH = 60;

// hidden：另一顆左下角按鈕（紅包/送花）展開時，這顆連同它的面板整個不渲染，避免蓋到對方的介面；
// isOpen/onOpenChange：面板開關狀態交給 ChatApp.jsx 統一管理，才能跟另外兩顆互斥
export default function CelebrationModeGame({ socket, token, name, apples, hidden, isOpen, onOpenChange }) {
  const [theme, setTheme] = useState("birthday");
  const [customText, setCustomText] = useState("");
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState("");
  const [distMode, setDistMode] = useState("even"); // 發起人選：均分 / 隨機
  const [errorMsg, setErrorMsg] = useState("");
  const [sending, setSending] = useState(false);
  const tokenRef = useRef(token);

  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    const onStart = ({ sender } = {}) => {
      if (sender !== name) return;
      setSending(false);
      onOpenChange(false);
      setCustomText("");
      setSelectedAmount(null);
      setCustomAmount("");
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
  }, [socket, name, onOpenChange]);

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
      mode: distMode,
    });
  }, [socket, selectedAmount, sending, theme, customText, distMode]);

  if (roomConfig.currency_name !== "金幣") return null;
  if (hidden) return null;

  const options = String(roomConfig.celebration_amount_options || "100,500,1000")
    .split(",")
    .map((s) => Math.floor(Number(s.trim())))
    .filter((n) => Number.isFinite(n) && n > 0);
  const maxAmount = Math.max(1, Number(roomConfig.celebration_max_amount) || 10000);

  // 跟後端 celebrationMode.js 的 tierForAmount 同一套：最便宜=基礎、最貴=豪華、中間=華麗
  const sortedOpts = [...new Set(options)].sort((a, b) => a - b);
  // 自訂金額也用同一把尺：不超過最便宜的選項＝基礎、達到最貴的選項＝豪華
  const tierLabel = (amt) => {
    if (sortedOpts.length <= 1) return "華麗";
    if (amt <= sortedOpts[0]) return "基礎";
    if (amt >= sortedOpts[sortedOpts.length - 1]) return "👑豪華";
    return "華麗";
  };

  return (
    <div className="cmg-corner">
      {!isOpen ? (
        <button className="cmg-trigger" onClick={() => onOpenChange(true)} title="發起慶典">🎉</button>
      ) : (
        <div className="cmg-panel">
          <div className="cmg-header">
            <span className="cmg-title">🎉 專屬慶典模式</span>
            <button className="cmg-close" onClick={() => { onOpenChange(false); setErrorMsg(""); }}>✖</button>
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
                onClick={() => { setSelectedAmount(opt); setCustomAmount(""); setErrorMsg(""); }}
              >
                {opt}
                <span className="cmg-tier-label">{tierLabel(opt)}</span>
              </button>
            ))}
          </div>

          <input
            type="number"
            className="cmg-custom-input"
            min={1}
            max={maxAmount}
            inputMode="numeric"
            placeholder={`自訂金額（上限 ${maxAmount}）`}
            value={customAmount}
            onChange={(e) => {
              const raw = e.target.value;
              setErrorMsg("");
              if (raw === "") { setCustomAmount(""); setSelectedAmount(null); return; }
              const n = Math.floor(Number(raw));
              if (!Number.isFinite(n) || n < 1) return;
              const clamped = Math.min(n, maxAmount);
              if (n > maxAmount) setErrorMsg(`單次慶典金額上限為 ${maxAmount}`);
              setCustomAmount(String(clamped));
              setSelectedAmount(clamped);
            }}
          />
          <div className="cmg-dist-row">
            <button
              type="button"
              className={`cmg-dist-btn${distMode === "even" ? " cmg-dist-selected" : ""}`}
              onClick={() => setDistMode("even")}
            >⚖️ 均分</button>
            <button
              type="button"
              className={`cmg-dist-btn${distMode === "random" ? " cmg-dist-selected" : ""}`}
              onClick={() => setDistMode("random")}
            >🎲 隨機</button>
          </div>
          <p className="cmg-dist-note">
            金額將由全場
            <strong>{distMode === "random" ? "隨機搶" : "平均分"}</strong>
            （份數依大廳顯示總人數計算）
            {customAmount && selectedAmount ? `｜${tierLabel(selectedAmount)}特效` : ""}
          </p>

          {errorMsg && <p className="cmg-error">{errorMsg}</p>}
          <button className="cmg-send-btn" disabled={!selectedAmount || sending} onClick={send}>
            {sending ? "發起中…" : selectedAmount ? `確定發起 ${selectedAmount}` : "確定發起"}
          </button>
        </div>
      )}
    </div>
  );
}
