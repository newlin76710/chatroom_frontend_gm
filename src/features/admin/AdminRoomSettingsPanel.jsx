import { useEffect, useState } from "react";

import { BACKEND, RN } from "../../shared/roomConfig";

export default function AdminRoomSettingsPanel({ token }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/admin/settings?room=${RN}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setSettings(data))
      .catch(() => alert("讀取設定失敗"));
  }, [token]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND}/admin/set-settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...settings, room: RN }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "更新失敗"); return; }
      alert("更新成功！");
    } catch {
      alert("更新失敗");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div style={{ padding: 12, color: "#888" }}>讀取中…</div>;

  return (
    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>房間中文名稱</span>
        <input
          type="text"
          value={settings.room_name || ""}
          onChange={e => setSettings(s => ({ ...s, room_name: e.target.value }))}
          style={{
            flex: 1, padding: "5px 8px", border: "1px solid #ccc",
            borderRadius: 5, fontSize: 13,
          }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>開啟 AI 陪聊</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!settings.openai}
            onChange={e => setSettings(s => ({ ...s, openai: e.target.checked }))}
          />
          啟用
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>開放訪客登入</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={settings.openguest !== false}
            onChange={e => setSettings(s => ({ ...s, openguest: e.target.checked }))}
          />
          啟用
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>聊天室顯示 IP</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={settings.show_ip !== false}
            onChange={e => setSettings(s => ({ ...s, show_ip: e.target.checked }))}
          />
          啟用
        </label>
      </div>
      <button
        onClick={save}
        disabled={saving}
        style={{
          alignSelf: "flex-start", padding: "6px 18px",
          background: "#1976d2", color: "#fff", border: "none",
          borderRadius: 6, cursor: "pointer", fontSize: 13,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "儲存中…" : "儲存"}
      </button>
    </div>
  );
}
