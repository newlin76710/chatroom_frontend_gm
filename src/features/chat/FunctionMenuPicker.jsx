import { useRef, useState } from "react";
import { useClickOutside } from "../../shared/hooks/useClickOutside";

export default function FunctionMenuPicker({ items }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="legacy-select-pink"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: "pointer" }}
      >
        功能選單 ▾
      </button>

      {open && (
        <div
          style={{
            position: "absolute", bottom: "32px", left: 0, width: 150,
            maxHeight: 260, overflowY: "auto",
            background: "#fdf6c8", border: "1px solid #ccc", borderRadius: 6,
            zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ padding: "6px 10px", fontSize: 12, fontWeight: "bold", color: "#333", borderBottom: "1px solid #e0d68a" }}>
            功能選單
          </div>
          {items.map((item) => (
            <div
              key={item.label}
              onClick={() => { item.onClick(); setOpen(false); }}
              style={{ padding: "6px 10px", fontSize: 13, color: "#333", cursor: "pointer" }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
