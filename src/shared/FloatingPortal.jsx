// FloatingPortal.jsx — 把浮動管理視窗直接掛到 <body>，並在手機/平板加上半透明遮罩。
// 原本管理彈窗是渲染在聊天輸入列裡面，手機上會被祖先元素（捲動容器、transform 等）影響
// position: fixed 的定位基準，造成頂端/右上角 ✖ 被切掉、拖不動；掛到 body 就不受任何祖先影響。
// 遮罩只在觸控/窄螢幕顯示（桌機維持可以邊開面板邊看聊天），點遮罩就收起視窗。
import { createPortal } from "react-dom";
import "./FloatingPortal.css";

export default function FloatingPortal({ children, onBackdropClick, className = "" }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`floating-portal ${className}`}>
      <div className="floating-portal-backdrop" onClick={onBackdropClick} />
      {children}
    </div>,
    document.body
  );
}
