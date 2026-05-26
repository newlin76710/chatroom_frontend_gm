import { useEffect, useState } from "react";

import { BACKEND, RN } from "../../shared/roomConfig";

const PEONY_PAGE_SIZE = 20;

export default function AdminRoomSettingsPanel({ token }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  // 金牡丹紀錄
  const [peonyLogs, setPeonyLogs] = useState([]);
  const [peonyTotal, setPeonyTotal] = useState(0);
  const [peonyPage, setPeonyPage] = useState(1);
  const [peonyLoading, setPeonyLoading] = useState(false);
  const [peonyLoaded, setPeonyLoaded] = useState(false);

  const peonyTotalPages = Math.ceil(peonyTotal / PEONY_PAGE_SIZE);

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

  const loadPeonyLogs = async (pageNum = 1) => {
    setPeonyLoading(true);
    try {
      const res = await fetch(`${BACKEND}/admin/peony-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ page: pageNum, pageSize: PEONY_PAGE_SIZE }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "查詢失敗"); return; }
      setPeonyLogs(data.logs || []);
      setPeonyTotal(data.total || 0);
      setPeonyPage(pageNum);
      setPeonyLoaded(true);
    } catch {
      alert("載入金牡丹紀錄失敗");
    } finally {
      setPeonyLoading(false);
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
          style={{ flex: 1, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13 }}
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
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>開啟金牡丹</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!settings.open_peony}
            onChange={e => {
              setSettings(s => ({ ...s, open_peony: e.target.checked }));
              if (e.target.checked && !peonyLoaded) loadPeonyLogs(1);
            }}
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

      {settings.open_peony && (
        <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: "bold", color: "#a8071a" }}>
              🌸 金牡丹紀錄
            </span>
            {peonyLoaded && (
              <span style={{ fontSize: 12, color: "#666" }}>共 {peonyTotal} 筆</span>
            )}
            <button
              className="admin-btn"
              style={{ fontSize: 12, padding: "2px 10px" }}
              onClick={() => loadPeonyLogs(1)}
              disabled={peonyLoading}
            >
              {peonyLoading ? "載入中…" : "重新載入"}
            </button>
          </div>

          {peonyLoaded && (
            <>
              <div className="admin-table-wrapper">
                <table className="admin-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>帳號</th>
                      <th>異動</th>
                      <th>新總量</th>
                      <th>操作者</th>
                      <th>原因</th>
                      <th>時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peonyLogs.length > 0 ? peonyLogs.map(l => (
                      <tr key={l.id}>
                        <td>{l.username}</td>
                        <td style={{ color: l.amount_changed >= 0 ? "#389e0d" : "#cf1322", fontWeight: "bold" }}>
                          {l.amount_changed >= 0 ? `+${l.amount_changed}` : l.amount_changed}
                        </td>
                        <td>{l.new_total}</td>
                        <td>{l.granted_by}</td>
                        <td>{l.reason}</td>
                        <td>{new Date(l.created_at).toLocaleString("zh-TW", { hour12: false })}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "#999" }}>無紀錄</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {peonyTotalPages > 1 && (
                <div className="admin-pagination" style={{ marginTop: 6 }}>
                  <button className="admin-btn" disabled={peonyPage <= 1} onClick={() => loadPeonyLogs(peonyPage - 1)}>上一頁</button>
                  <span style={{ padding: "0 8px", fontSize: 12 }}>{peonyPage} / {peonyTotalPages}</span>
                  <button className="admin-btn" disabled={peonyPage >= peonyTotalPages} onClick={() => loadPeonyLogs(peonyPage + 1)}>下一頁</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
