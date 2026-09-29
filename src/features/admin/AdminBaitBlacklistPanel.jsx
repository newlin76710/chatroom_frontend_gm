// AdminBaitBlacklistPanel.jsx — 捕魚免費魚餌黑名單（/admin/fishing-bait-blacklist*）：名單內的帳號
// 不會再拿到任何免費魚餌（後端 fishingGame.js 的 isBaitBlacklisted），前台不會有任何提示。
// 用來擋「小號刷大禮物換魚餌、再拿魚餌打小魚洗分」的套利帳號。
import { useState } from "react";
import "./AdminLoginLogPanel.css";

import { BACKEND } from "../../shared/roomConfig";
import DraggablePanel from "../../shared/DraggablePanel";

const fmt = (n) => Number(n || 0).toLocaleString("en-US");

export default function AdminBaitBlacklistPanel({ token }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [clearBait, setClearBait] = useState(true);
  const [busy, setBusy] = useState(false);

  const call = async (path, body) => {
    const res = await fetch(`${BACKEND}/admin/fishing-bait-blacklist${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "操作失敗");
    return data;
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const data = await call("");
      setList(data.list || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    loadList();
  };

  const handleAdd = async () => {
    if (!target.trim() || busy) return;
    setBusy(true);
    try {
      const data = await call("/add", { target: target.trim(), reason: reason.trim(), clearBait });
      alert(`已將 ${data.username}（ID ${data.userId}）加入魚餌黑名單${clearBait ? "，並清空現有魚餌" : ""}`);
      setTarget("");
      setReason("");
      loadList();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (row) => {
    if (!window.confirm(`確定要把 ${row.current_username || row.username}（ID ${row.user_id}）移出魚餌黑名單？`)) return;
    try {
      await call("/remove", { userId: row.user_id });
      loadList();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClear = async (row) => {
    if (!window.confirm(`確定要清空 ${row.current_username || row.username} 剩下的 ${row.free_shots} 次免費魚餌？`)) return;
    try {
      await call("/clear-bait", { userId: row.user_id });
      loadList();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <>
      <button className="admin-btn" onClick={handleOpen}>
        🚫 魚餌黑名單
      </button>

      {open && (
        <DraggablePanel title={<h3 style={{ margin: 0 }}>🚫 捕魚魚餌發放黑名單</h3>} onClose={() => setOpen(false)}>
          <div className="admin-filter-bar">
            <input
              placeholder="User ID 或暱稱"
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              style={{ width: "130px" }}
            />
            <input
              placeholder="原因（選填）"
              value={reason}
              onChange={e => setReason(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              style={{ width: "180px" }}
            />
            <label>
              <input type="checkbox" checked={clearBait} onChange={e => setClearBait(e.target.checked)} />
              同時清空現有魚餌
            </label>
            <button className="admin-btn" onClick={handleAdd} disabled={busy || !target.trim()}>
              {busy ? "處理中…" : "加入黑名單"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#666", margin: "4px 0 8px" }}>
            名單內的帳號送禮不會再換到免費魚餌（累計進度也不增加），前台不會跳任何提示。共 {list.length} 個帳號。
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>暱稱</th>
                  <th>剩餘魚餌</th>
                  <th>原因</th>
                  <th>加入者</th>
                  <th>加入時間（台灣）</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: "center" }}>載入中…</td></tr>
                ) : list.length > 0 ? list.map(row => (
                  <tr key={row.user_id}>
                    <td>{row.user_id}</td>
                    <td>
                      {row.current_username || row.username}
                      {row.current_username && row.current_username !== row.username && (
                        <span style={{ color: "#999", fontSize: 11 }}>（加入時：{row.username}）</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmt(row.free_shots)}</td>
                    <td>{row.reason || "—"}</td>
                    <td>{row.created_by || "—"}</td>
                    <td>{new Date(row.created_at).toLocaleString("zh-TW", { hour12: false })}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {Number(row.free_shots) > 0 && (
                        <button className="admin-btn" onClick={() => handleClear(row)}>清空魚餌</button>
                      )}
                      <button className="admin-btn" onClick={() => handleRemove(row)}>移除</button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ textAlign: "center" }}>黑名單是空的</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DraggablePanel>
      )}
    </>
  );
}
