// QuickRoseButton.jsx — 999 朵玫瑰快捷發送（僅金幣模式），跟金幣雨/慶典模式並列的左下角浮動按鈕。
// 直接送給目前選定的聊天對象（ChatApp 的 target），省去打開商城選數量的步驟；
// 單價 5 × 999 = 4995，一次點擊必定觸及送花特效門檻（預設 999），不在冷卻中就會播放全螢幕特效。
import { useState } from "react";
import "./QuickRoseButton.css";
import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";

const QUICK_ROSE_QUANTITY = 999;

export default function QuickRoseButton({ token, targetName }) {
  const [sending, setSending] = useState(false);

  if (roomConfig.currency_name !== "金幣") return null;

  const send = async () => {
    if (!targetName) {
      alert("請先在使用者列表選擇送花對象");
      return;
    }
    if (sending) return;

    try {
      setSending(true);
      const res = await fetch(`${BACKEND}/api/shop/buy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          itemId: "rose",
          targetName,
          room: RN,
          quantity: QUICK_ROSE_QUANTITY,
          isPrivate: false,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "送花失敗");
        return;
      }

      let msg = `🌹 已送出 ${QUICK_ROSE_QUANTITY} 朵玫瑰給 ${targetName}！`;
      if (data.flowerEffectCooldownRemainingMinutes) {
        msg += `\n送花特效冷卻中，還需等待約 ${data.flowerEffectCooldownRemainingMinutes} 分鐘才會再次播放全螢幕特效`;
      }
      alert(msg);
    } catch (err) {
      alert("此功能尚未開放!");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="qrb-corner">
      <button
        className="qrb-trigger"
        onClick={send}
        disabled={sending}
        title={`快捷送 ${targetName || "?"} ${QUICK_ROSE_QUANTITY} 朵玫瑰`}
      >
        {sending ? "…" : "🌹999"}
      </button>
    </div>
  );
}
