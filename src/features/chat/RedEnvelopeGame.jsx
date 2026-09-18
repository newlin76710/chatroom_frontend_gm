// RedEnvelopeGame.jsx — 全場金幣雨／發紅包（僅金幣模式）。跟推牌/小瑪莉不同，這個是任何
// 玩家都能自己發動（不限管理員），所以做成獨立的左下角浮動按鈕，不用擠進管理員操作列。
// 玩家選金額扣款後，全場在線玩家會看到紅包雨動畫（ChatApp.jsx 的 enqueueEffect 播放），
// 個人實際領到多少則透過既有的 goldAwarded 事件顯示，這裡只負責發動的 UI。

import { useState, useEffect, useCallback, useRef } from "react";
import "./RedEnvelopeGame.css";

import { RN, roomConfig } from "../../shared/roomConfig";
import { useDraggableWindow } from "../../shared/hooks/useDraggableWindow";

export default function RedEnvelopeGame({ socket, token, name, apples }) {
  const { windowRef, onPointerDown } = useDraggableWindow();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [sending, setSending] = useState(false);
  const tokenRef = useRef(token);

  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    const onStart = ({ sender } = {}) => {
      if (sender !== name) return;
      setSending(false);
      setOpen(false);
      setSelected(null);
      setErrorMsg("");
    };
    const onError = ({ reason } = {}) => {
      setSending(false);
      setErrorMsg(reason || "發放失敗");
    };
    socket.on("redEnvelopeStart", onStart);
    socket.on("redEnvelopeError", onError);
    return () => {
      socket.off("redEnvelopeStart", onStart);
      socket.off("redEnvelopeError", onError);
    };
  }, [socket, name]);

  const send = useCallback(() => {
    if (!selected || sending) return;
    setSending(true);
    setErrorMsg("");
    socket.emit("startRedEnvelope", { token: tokenRef.current, room: RN, amount: selected });
  }, [socket, selected, sending]);

  if (roomConfig.currency_name !== "金幣") return null;

  const options = String(roomConfig.red_envelope_amount_options || "100,500,1000,5000")
    .split(",")
    .map((s) => Math.floor(Number(s.trim())))
    .filter((n) => Number.isFinite(n) && n > 0);

  return (
    <div className="reg-corner">
      {!open ? (
        <button className="reg-trigger" onClick={() => setOpen(true)} title="發紅包">🧧</button>
      ) : (
        <div className="reg-panel" ref={windowRef}>
          <div className="reg-header" onPointerDown={onPointerDown} title="按住拖曳">
            <span className="reg-title">🧧 發紅包</span>
            <button className="reg-close" onClick={() => { setOpen(false); setErrorMsg(""); }}>✖</button>
          </div>
          <p className="reg-desc">選擇要發放的金額，全場在線玩家均分/隨機領取</p>
          <div className="reg-options">
            {options.map((opt) => (
              <button
                key={opt}
                className={`reg-option-btn${selected === opt ? " reg-option-selected" : ""}`}
                disabled={apples != null && opt > apples}
                onClick={() => setSelected(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          {errorMsg && <p className="reg-error">{errorMsg}</p>}
          <button className="reg-send-btn" disabled={!selected || sending} onClick={send}>
            {sending ? "發放中…" : "確定發放"}
          </button>
        </div>
      )}
    </div>
  );
}
