import { useEffect, useState } from "react";

import { BACKEND, RN } from "../../shared/roomConfig";

export default function QuickPhrasePanel({ token, onSelect }) {
  const [open, setOpen] = useState(false);
  const [phrases, setPhrases] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [value, setValue] = useState("");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 讀取列表
  const load = async () => {
    try {
      const res = await fetch(`${BACKEND}/api/quick-phrases?room=${RN}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPhrases(data.phrases || data); // 後端可能回 { phrases: [...] }
      }
    } catch (err) {
      console.error("載入常用語失敗:", err);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  // 新增或更新
  const save = async () => {
    if (!value.trim()) return;

    try {
      if (editingId && editingId !== "new") {
        // 更新
        const res = await fetch(`${BACKEND}/api/quick-phrases/update`, {
          method: "POST",
          headers,
          body: JSON.stringify({ id: editingId, content: value, room: RN }),
        });
        const data = await res.json();
        if (!data.phrase) alert(data.error || "更新失敗");
      } else {
        // 新增
        const res = await fetch(`${BACKEND}/api/quick-phrases/new`, {
          method: "POST",
          headers,
          body: JSON.stringify({ content: value, room: RN }),
        });
        const data = await res.json();
        if (!data.phrase) alert(data.error || "新增失敗");
      }
    } catch (err) {
      console.error("保存失敗:", err);
    }

    setValue("");
    setEditingId(null);
    load();
  };

  // 刪除
  const del = async (id) => {
    if (!confirm("刪除這個常用語？")) return;
    try {
      const res = await fetch(`${BACKEND}/api/quick-phrases/delete`, {
        method: "POST",
        headers,
        body: JSON.stringify({ id, room: RN }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error || "刪除失敗");
    } catch (err) {
      console.error("刪除失敗:", err);
    }
    load();
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ marginLeft: "6px", fontSize: "0.8rem" }}
      >
        💬 常用語
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "36px",
            right: 0,
            width: "240px",
            maxHeight: "260px",   // ⭐⭐⭐⭐⭐ 關鍵
            overflowY: "auto",    // ⭐⭐⭐⭐⭐ 關鍵
            background: "#111",
            border: "1px solid #333",
            borderRadius: "8px",
            padding: "8px",
            zIndex: 99,
          }}
        >
          {phrases.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "4px",
              }}
            >
              <span
                style={{ flex: 1, cursor: "pointer", fontSize: "0.8rem" }}
                onClick={() => onSelect(p.content)}
              >
                {p.content}
              </span>
              <button
                onClick={() => {
                  setEditingId(p.id);
                  setValue(p.content);
                }}
              >
                ✏️
              </button>
              <button onClick={() => del(p.id)}>🗑</button>
            </div>
          ))}

          {phrases.length < 20 && !editingId && (
            <button
              style={{ fontSize: "0.7rem", marginBottom: "4px" }}
              onClick={() => setEditingId("new")}
            >
              ➕ 新增
            </button>
          )}

          {(editingId || editingId === "new") && (
            <div style={{ marginTop: "6px" }}>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="輸入常用語"
                style={{ width: "100%", fontSize: "0.8rem" }}
              />
              <div style={{ textAlign: "right", marginTop: "4px" }}>
                <button onClick={save}>💾</button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setValue("");
                  }}
                >
                  ✖
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
