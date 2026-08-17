import { useCallback, useRef } from "react";

// 通用可拖曳浮動視窗：預設由 CSS 置中（transform: translate(-50%, -50%)），
// 一旦開始拖曳就改用絕對 px 座標定位。把回傳的 onPointerDown 掛在拖曳把手（例如標題列）上，
// 而不是整個視窗，這樣視窗內容本身的點擊/操作才不會被誤判成拖曳。
export function useDraggableWindow() {
  const windowRef = useRef(null);
  const stateRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });

  const onPointerMove = useCallback((e) => {
    if (!stateRef.current.dragging || !windowRef.current) return;
    const x = e.clientX - stateRef.current.offsetX;
    const y = e.clientY - stateRef.current.offsetY;
    windowRef.current.style.left = `${x}px`;
    windowRef.current.style.top = `${y}px`;
    windowRef.current.style.transform = "none";
  }, []);

  const onPointerUp = useCallback(() => {
    stateRef.current.dragging = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = useCallback((e) => {
    if (e.target.closest("button, input, textarea, select, a")) return;
    if (!windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    stateRef.current.dragging = true;
    stateRef.current.offsetX = e.clientX - rect.left;
    stateRef.current.offsetY = e.clientY - rect.top;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, [onPointerMove, onPointerUp]);

  return { windowRef, onPointerDown };
}
