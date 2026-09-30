// LevelTitlePanel.jsx — 「🛡 管理 → 等級管理 → 等級稱謂/圖案」子分頁（僅金幣房、櫻桃房，僅 admin_max_level）。
// 自己讀 /admin/settings、只把 level_titles 送回 /admin/set-settings，不會動到其他設定。
import { useEffect, useState } from "react";
import { BACKEND, RN } from "../../shared/roomConfig";
import { LevelTitleEditor } from "./LevelTitleSettings";

export default function LevelTitlePanel({ token }) {
  const [settings, setSettings] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/admin/settings?room=${RN}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const picked = { level_titles: data.level_titles || { ranges: [], users: [], cheer_enabled: false } };
        setSettings(picked);
        setOriginal(picked);
      })
      .catch(() => alert("讀取設定失敗"));
  }, [token]);

  if (!settings) return <div style={{ padding: 12, color: "#888" }}>讀取中…</div>;

  const dirty = JSON.stringify(settings.level_titles) !== JSON.stringify(original.level_titles);

  const save = async () => {
    if (!dirty) { alert("沒有變更"); return; }
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
    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 12, color: "#222" }}>
      <LevelTitleEditor settings={settings} setSettings={setSettings} />
      <button
        onClick={save}
        disabled={saving}
        style={{
          alignSelf: "flex-start", padding: "6px 18px", background: "#1976d2", color: "#fff",
          border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "儲存中…" : "儲存等級稱謂/圖案"}
      </button>
    </div>
  );
}
