import { useRef, useState } from "react";
import { useClickOutside } from "../../shared/hooks/useClickOutside";

const EMOTIONS = [
  "笑", "微笑", "大笑", "奸笑", "傻笑", "苦笑", "笑到流淚",
  "甜蜜蜜", "含情脈脈", "深情款款", "感動", "幸福", "高興", "興奮", "滿足", "渴望", "舒服", "溫柔",
  "遺憾", "悲傷", "嘟著嘴", "很委屈", "快要哭", "心情鬱卒", "淚流滿面", "手足無措", "很尷尬", "紅著臉",
  "吞吞吐吐", "拐彎抹角", "左右為難", "很懷疑", "很無辜", "傻乎乎", "流口水", "自言自語", "無精打采", "口吐白沫",
  "嚴肅", "認真", "訝異", "生氣", "大聲", "瞪大眼", "拳打腳踢", "不懷好意", "翻箱倒櫃", "正氣凜然",
  "毛手毛腳", "快要吐", "不舒服", "依依不捨",
];

export default function TextEmotionPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  const pick = (emotion) => {
    onChange(emotion);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="legacy-select-pink"
        onClick={() => setOpen((o) => !o)}
      >
        {value || "文字表情"} ▾
      </button>

      {open && (
        <div
          style={{
            position: "absolute", bottom: "32px", left: 0, width: 140,
            maxHeight: 260, overflowY: "auto",
            background: "#ffb3f0", border: "1px solid #cc66cc", borderRadius: 6,
            zIndex: 100, boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ padding: "6px 10px", fontSize: 12, fontWeight: "bold", color: "#333", borderBottom: "1px solid #e08fd8" }}>
            文字表情
          </div>
          <div
            onClick={() => pick("")}
            style={{
              padding: "6px 10px", fontSize: 13, cursor: "pointer",
              color: !value ? "#fff" : "#333",
              background: !value ? "#1976d2" : "transparent",
            }}
          >
            無
          </div>
          {EMOTIONS.map((emo) => (
            <div
              key={emo}
              onClick={() => pick(emo)}
              style={{
                padding: "6px 10px", fontSize: 13, cursor: "pointer",
                color: value === emo ? "#fff" : "#333",
                background: value === emo ? "#1976d2" : "transparent",
              }}
            >
              {emo}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
