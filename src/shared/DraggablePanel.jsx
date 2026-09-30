// DraggablePanel.jsx
// 共用的可自由拖曳浮動視窗（各種紀錄面板、等級稱謂管理等），取代原本蓋住整個聊天室的全螢幕遮罩。
// 用 createPortal 掛到 <body>：這些面板常常是從 🛡 管理視窗裡打開的，如果留在管理視窗的 DOM 裡，
// iOS Safari 會被外層捲動區（-webkit-overflow-scrolling: touch）裁切，標題列跟 ✖ 被切掉、下方內容看不到。
// 拖曳改用 useDraggable（滑鼠 + 觸控通用，並夾在畫面內）。
import { useState } from "react";
import { createPortal } from "react-dom";
import useDraggable from "./hooks/useDraggable";
import "./DraggablePanel.css";

// 每開一個新面板就錯開一點初始位置，避免多個面板疊在同一個點上
let openCount = 0;

export default function DraggablePanel({ title, onClose, children, width = 1400 }) {
  // 只在面板第一次掛上時決定初始位置（寫在 render 裡會每次重繪都往下錯開）
  const [start] = useState(() => {
    const step = (openCount++ % 6) * 24;
    return { x: 40 + step, y: 40 + step };
  });
  const { panelRef, handleProps, initialStyle } = useDraggable(start);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panelRef}
      className="draggable-panel"
      style={{ ...initialStyle, width }}
    >
      <div className="draggable-panel-header" {...handleProps}>
        {typeof title === "string" ? <h3>{title}</h3> : title}
        <button onClick={onClose}>✖</button>
      </div>
      <div className="draggable-panel-body">
        {children}
      </div>
    </div>,
    document.body
  );
}
