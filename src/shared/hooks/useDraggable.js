// useDraggable.js — 浮動視窗拖曳（滑鼠 + 手機/平板觸控通用）
// 原本各面板只綁 mousedown/mousemove，手機跟平板完全拖不動；改用 Pointer Events 一次涵蓋滑鼠、觸控、觸控筆，
// 並把視窗夾在畫面內（至少露出標題列），避免拖出畫面外找不回來。
//
// 用法：
//   const { panelRef, handleProps, initialStyle } = useDraggable({ x: 20, y: 80 });
//   <div ref={panelRef} style={initialStyle}>
//     <div {...handleProps}>標題列（按鈕不會觸發拖曳）</div>
//   </div>
import { useCallback, useEffect, useRef } from "react";

const EDGE = 8;          // 與畫面邊緣保留的距離
const MIN_VISIBLE = 60;  // 視窗至少要留在畫面內的寬度

const HAS_POINTER = typeof window !== "undefined" && "PointerEvent" in window;

function isSmallScreen() {
  return typeof window !== "undefined" && window.innerWidth <= 768;
}

export default function useDraggable(initial = { x: 20, y: 80 }) {
  const panelRef = useRef(null);
  // 手機/平板直向螢幕一開始就靠左上，不要一打開就有一半在畫面外
  const pos = useRef(
    isSmallScreen() ? { x: EDGE, y: Math.min(initial.y, 60) } : { x: initial.x, y: initial.y }
  );
  const drag = useRef(null);

  const apply = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth || 0;
    const h = el.offsetHeight || 0;
    // 視窗比畫面小就完整夾在畫面內；比畫面大（例如很寬的表格）則至少露出 MIN_VISIBLE
    const minX = w <= vw - EDGE * 2 ? EDGE : Math.min(EDGE, vw - w - EDGE);
    const maxX = w <= vw - EDGE * 2 ? vw - w - EDGE : vw - MIN_VISIBLE;
    const maxY = Math.max(EDGE, (h <= vh - EDGE * 2 ? vh - h : vh - 44) - EDGE);
    pos.current.x = Math.min(Math.max(pos.current.x, minX), Math.max(minX, maxX));
    pos.current.y = Math.min(Math.max(pos.current.y, EDGE), maxY);
    el.style.left = pos.current.x + "px";
    el.style.top = pos.current.y + "px";
  }, []);

  const onPointerMove = useCallback((e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    e.preventDefault();
    pos.current.x = e.clientX - d.offsetX;
    pos.current.y = e.clientY - d.offsetY;
    apply();
  }, [apply]);

  const onPointerUp = useCallback((e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = useCallback((e) => {
    // 標題列上的按鈕（關閉等）照常點擊，不觸發拖曳
    if (e.target.closest("button, input, select, textarea, a")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    drag.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - pos.current.x,
      offsetY: e.clientY - pos.current.y,
    };
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
  }, [onPointerMove, onPointerUp]);

  // ─── 觸控後備：少數舊版手機瀏覽器 / App 內建瀏覽器沒有 Pointer Events，標題列完全拖不動 ───
  const onTouchMove = useCallback((e) => {
    const d = drag.current;
    const t = e.touches && e.touches[0];
    if (!d || !t) return;
    e.preventDefault();
    pos.current.x = t.clientX - d.offsetX;
    pos.current.y = t.clientY - d.offsetY;
    apply();
  }, [apply]);

  const onTouchEnd = useCallback(() => {
    drag.current = null;
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
    document.removeEventListener("touchcancel", onTouchEnd);
  }, [onTouchMove]);

  const onTouchStart = useCallback((e) => {
    if (HAS_POINTER) return; // 有 Pointer Events 時交給 onPointerDown，避免重複處理
    if (e.target.closest("button, input, select, textarea, a")) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    drag.current = { pointerId: "touch", offsetX: t.clientX - pos.current.x, offsetY: t.clientY - pos.current.y };
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
  }, [onTouchMove, onTouchEnd]);

  // 掛上後先夾一次；旋轉螢幕/視窗縮放/手機鍵盤彈出時也重新夾回畫面內
  useEffect(() => {
    const id = requestAnimationFrame(apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [apply, onPointerMove, onPointerUp, onTouchMove, onTouchEnd]);

  // panelRef 用 callback ref：視窗每次重新打開（重新掛載）都立刻夾回畫面內
  const setPanelRef = useCallback((el) => {
    panelRef.current = el;
    if (el) requestAnimationFrame(apply);
  }, [apply]);

  return {
    panelRef: setPanelRef,
    handleProps: {
      onPointerDown,
      onTouchStart,
      // touch-action: none 讓瀏覽器不要把拖動手勢拿去捲動頁面
      style: { touchAction: "none", cursor: "move" },
    },
    initialStyle: { left: pos.current.x, top: pos.current.y },
  };
}
