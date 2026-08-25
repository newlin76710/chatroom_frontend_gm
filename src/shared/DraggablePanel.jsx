// DraggablePanel.jsx
// 共用的可自由拖曳浮動視窗，取代原本蓋住整個聊天室的全螢幕遮罩（.admin-overlay/.admin-modal）
import { useRef } from "react";
import "./DraggablePanel.css";

// 每開一個新面板就錯開一點初始位置，避免多個面板疊在同一個點上
let openCount = 0;

export default function DraggablePanel({ title, onClose, children, width = 1400 }) {
  const panelRef = useRef(null);
  const pos = useRef(null);
  if (!pos.current) {
    const step = (openCount++ % 6) * 24;
    pos.current = { x: 40 + step, y: 40 + step, offsetX: 0, offsetY: 0, dragging: false };
  }

  const onMouseDown = (e) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    pos.current.dragging = true;
    pos.current.offsetX = e.clientX - pos.current.x;
    pos.current.offsetY = e.clientY - pos.current.y;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };
  const onMouseMove = (e) => {
    if (!pos.current.dragging) return;
    e.preventDefault();
    pos.current.x = e.clientX - pos.current.offsetX;
    pos.current.y = e.clientY - pos.current.offsetY;
    if (panelRef.current) {
      panelRef.current.style.left = pos.current.x + "px";
      panelRef.current.style.top = pos.current.y + "px";
    }
  };
  const onMouseUp = () => {
    pos.current.dragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      ref={panelRef}
      className="draggable-panel"
      style={{ left: pos.current.x, top: pos.current.y, width }}
    >
      <div className="draggable-panel-header" onMouseDown={onMouseDown}>
        {typeof title === "string" ? <h3>{title}</h3> : title}
        <button onClick={onClose}>✖</button>
      </div>
      <div className="draggable-panel-body">
        {children}
      </div>
    </div>
  );
}
