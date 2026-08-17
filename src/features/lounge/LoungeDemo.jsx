import { useState } from "react";
import LoungePanel from "./LoungePanel";
import socket from "../../shared/socket";

export default function LoungeDemo() {
  const [text, setText] = useState("");

  return (
    <main style={{
      minHeight: "100vh",
      padding: "18px",
      background: "linear-gradient(180deg, #101615, #0a0f0d 62%, #060807)",
      color: "#eee",
    }}>
      <p style={{ opacity: 0.7, fontSize: 14 }}>
        這是休閒廳「可拖曳視窗」修改的展示頁：拖曳標題列可以移動視窗，底下的假聊天輸入框全程可以正常打字，不會被擋住。
      </p>

      <LoungePanel socket={socket} room="demo" name="demo" apples={999} open onClose={() => {}} />

      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        padding: 12, background: "#111", display: "flex", gap: 8,
        borderTop: "1px solid #333",
      }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="這裡是假的聊天輸入框，試試看能不能打字"
          style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #555", background: "#1a1a1a", color: "#fff" }}
        />
        <button style={{ padding: "10px 16px" }}>發送</button>
      </div>
    </main>
  );
}
