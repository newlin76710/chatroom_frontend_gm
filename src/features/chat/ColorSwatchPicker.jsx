import { useRef, useState } from "react";
import { useClickOutside } from "../../shared/hooks/useClickOutside";

// 具名顏色清單（仿舊版「文字顏色」下拉選單樣式：選項文字本身即為該顏色）
const NAMED_COLORS = [
  { name: "白雪紛飛", hex: "#FFFFFF" },
  { name: "黃金歲月", hex: "#EE7B17" },
  { name: "紅袍飄飄", hex: "#FF4444" },
  { name: "紫金繡帖", hex: "#B366FF" },
  { name: "冷若冰霜", hex: "#66FFFF" },
  { name: "紅粉佳人", hex: "#FF6699" },
  { name: "翠綠碧波", hex: "#33CC99" },
  { name: "鮮甜橘子", hex: "#FF9933" },
  { name: "利市大吉", hex: "#FF3333" },
  { name: "純淨泉水", hex: "#99EFFF" },
  { name: "粉紅妲己", hex: "#FF66CC" },
  { name: "嬌豔牡丹", hex: "#FF1493" },
  { name: "蜜瓜鮮奶", hex: "#CCFF99" },
  { name: "加州青檸", hex: "#99FF33" },
  { name: "健康膚色", hex: "#FFCC99" },
  { name: "芒果布丁", hex: "#FFB347" },
  { name: "酸辣綺夢", hex: "#FF6633" },
  { name: "柔情似水", hex: "#66CCFF" },
  { name: "淺紫鳶尾", hex: "#B08FCE" },
  { name: "天空藍調", hex: "#4DA6FF" },
  { name: "森林綠意", hex: "#339966" },
  { name: "玫瑰紅顏", hex: "#FF3366" },
  { name: "粉紅胭脂", hex: "#FF3399" },
  { name: "緋紅晚霞", hex: "#E63950" },
  { name: "油炸番茄", hex: "#FF5733" },
  { name: "核桃鬆餅", hex: "#B5895B" },
  { name: "清香草原", hex: "#7CB342" },
  { name: "卡其制服", hex: "#BDB76B" },
  { name: "卡布其諾", hex: "#8B5E3C" },
  { name: "海洋之藍", hex: "#2196F3" },
  { name: "興奮過藍", hex: "#4169E1" },
  { name: "正宗喜紅", hex: "#D32F2F" },
  { name: "紅的發紫", hex: "#99004D" },
  { name: "皮卡丘黃", hex: "#E9F521" },
];

export default function ColorSwatchPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setOpen(false), open);
  const current = NAMED_COLORS.find((c) => c.hex.toLowerCase() === (value || "").toLowerCase());

  const pick = (hex) => {
    onChange(hex);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="選擇聊天顏色"
        style={{
          fontSize: "0.8rem", padding: "4px 8px", borderRadius: 4,
          border: "1px solid #cc66cc", background: "#f5a0f5", color: "#111",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <span
          style={{
            width: 12, height: 12, borderRadius: 2, flexShrink: 0,
            background: current?.hex || value, border: "1px solid #333",
          }}
        />
        <span>{current ? current.name : "文字顏色"}</span>
        <span style={{ fontSize: "0.65rem" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute", bottom: "32px", left: 0, width: 140,
            maxHeight: 260, overflowY: "auto",
            background: "#000", border: "1px solid #555", borderRadius: 6,
            zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ padding: "6px 10px", fontSize: 12, fontWeight: "bold", color: "#ccc", borderBottom: "1px solid #333" }}>
            文字顏色
          </div>
          {NAMED_COLORS.map((c) => (
            <div
              key={c.name}
              onClick={() => pick(c.hex)}
              style={{
                padding: "6px 10px", fontSize: 13, fontWeight: "bold", color: c.hex,
                cursor: "pointer",
                background: current?.hex === c.hex ? "#333" : "transparent",
              }}
            >
              {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
