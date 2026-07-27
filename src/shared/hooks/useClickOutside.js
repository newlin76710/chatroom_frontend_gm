import { useEffect } from "react";

// 點擊 ref 範圍以外時呼叫 onOutside（只有在 active 為 true 時才監聽），用來關閉下拉/彈出面板
export function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, onOutside, ref]);
}
