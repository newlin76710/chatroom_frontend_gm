// QuickRoseButton.jsx — 送花快捷（僅金幣模式），跟金幣雨/慶典模式並列的左下角浮動按鈕。
// 直接送給目前選定的聊天對象（ChatApp 的 target），省去打開商城的步驟；可自選數量
// （預設選項或自訂輸入），數量越多越有機會觸及送花特效門檻，不在冷卻中就會播放全螢幕特效。
import { useState } from "react";
import "./QuickRoseButton.css";
import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";

const QUANTITY_PRESETS = [1, 10, 99, 520, 999];
const MAX_QUANTITY = 999;

export default function QuickRoseButton({ token, targetName }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(99);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (roomConfig.currency_name !== "金幣") return null;

  const send = async () => {
    if (!targetName) {
      setErrorMsg("請先在使用者列表選擇送花對象");
      return;
    }
    const qty = Math.max(1, Math.min(MAX_QUANTITY, Math.floor(Number(quantity)) || 1));
    if (sending) return;

    try {
      setSending(true);
      setErrorMsg("");
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
          quantity: qty,
          isPrivate: false,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "送花失敗");
        return;
      }

      setOpen(false);
      alert(`🌹 已送出 ${qty} 朵玫瑰給 ${targetName}！`);
    } catch (err) {
      setErrorMsg("此功能尚未開放!");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="qrb-corner">
      {!open ? (
        <button className="qrb-trigger" onClick={() => setOpen(true)} title={`送花給 ${targetName || "?"}`}>
          🌹送花
        </button>
      ) : (
        <div className="qrb-panel">
          <div className="qrb-header">
            <span className="qrb-title">🌹 送花給 {targetName || "?"}</span>
            <button className="qrb-close" onClick={() => { setOpen(false); setErrorMsg(""); }}>✖</button>
          </div>

          <div className="qrb-presets">
            {QUANTITY_PRESETS.map((n) => (
              <button
                key={n}
                className={`qrb-preset-btn${quantity === n ? " qrb-preset-selected" : ""}`}
                onClick={() => setQuantity(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <input
            type="number"
            className="qrb-qty-input"
            min={1}
            max={MAX_QUANTITY}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Math.min(MAX_QUANTITY, Math.floor(Number(e.target.value)) || 1)))}
          />

          {errorMsg && <p className="qrb-error">{errorMsg}</p>}

          <button className="qrb-send-btn" disabled={sending} onClick={send}>
            {sending ? "送出中…" : `送出 ${quantity} 朵`}
          </button>
        </div>
      )}
    </div>
  );
}
