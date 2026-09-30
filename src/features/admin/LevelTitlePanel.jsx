// LevelTitlePanel.jsx — 🛡 管理 → 等級管理 →「🏷️ 等級稱謂/圖案管理」按鈕 + 獨立彈窗（跟捕魚紀錄同一種開法）。
// 僅金幣房、櫻桃房（由 AdminToolPanel 判斷）。開啟時才讀 /admin/settings，
// 存檔只把 level_titles 送回 /admin/set-settings，不會動到其他設定。
import { useState } from "react";
import { BACKEND, RN } from "../../shared/roomConfig";
import DraggablePanel from "../../shared/DraggablePanel";
import { LevelTitleEditor } from "./LevelTitleSettings";

export default function LevelTitlePanel({ token }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    setSettings(null);
    try {
      const res = await fetch(`${BACKEND}/admin/settings?room=${RN}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "讀取設定失敗"); return; }
      const picked = { level_titles: data.level_titles || { ranges: [], users: [], cheer_enabled: false, welcome_enabled: false } };
      setSettings(picked);
      setOriginal(picked);
    } catch {
      alert("讀取設定失敗");
    }
  };

  const save = async () => {
    if (!settings) return;
    if (JSON.stringify(settings.level_titles) === JSON.stringify(original?.level_titles)) { alert("沒有變更"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND}/admin/set-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ level_titles: settings.level_titles, room: RN }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "更新失敗"); return; }
      setOriginal(settings);
      alert("更新成功！");
    } catch {
      alert("更新失敗");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="admin-btn" onClick={handleOpen}>
        🏷️ 等級稱謂/圖案管理
      </button>

      {open && (
        <DraggablePanel title={<h3 style={{ margin: 0 }}>🏷️ 等級稱謂 / 圖案 / 進場歡迎詞</h3>} onClose={() => setOpen(false)} width={900}>
          {!settings ? (
            <div style={{ padding: 12, color: "#888" }}>讀取中…</div>
          ) : (
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
              <LevelTitleEditor settings={settings} setSettings={setSettings} />
              <button
                onClick={save}
                disabled={saving}
                style={{
                  alignSelf: "flex-start", padding: "6px 18px", background: "#1976d2", color: "#fff",
                  border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "儲存中…" : "儲存"}
              </button>
            </div>
          )}
        </DraggablePanel>
      )}
    </>
  );
}
