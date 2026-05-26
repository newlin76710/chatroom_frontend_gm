// AdminPeoniesPanel.jsx — 金牡丹管理（僅 level 99）
import { useState } from "react";
import { BACKEND } from "../../shared/roomConfig";

const PAGE_SIZE = 20;

export default function AdminPeoniesPanel({ token }) {
  // ── 查詢 / 設定 ──
  const [searchUser, setSearchUser] = useState("");
  const [currentInfo, setCurrentInfo] = useState(null);
  const [newAmount, setNewAmount] = useState("");
  const [loadingUser, setLoadingUser] = useState(false);

  // ── 紀錄 ──
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logFilter, setLogFilter] = useState("");
  const [loadingLogs, setLoadingLogs] = useState(false);

  const totalPages = Math.ceil(logsTotal / PAGE_SIZE);

  /* ── 查詢使用者目前金牡丹 ── */
  const fetchUser = async () => {
    if (!searchUser.trim()) return;
    setLoadingUser(true);
    setCurrentInfo(null);
    try {
      const res = await fetch(
        `${BACKEND}/admin/user-peonies?username=${encodeURIComponent(searchUser.trim())}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) { alert(data.error || "查詢失敗"); return; }
      setCurrentInfo(data);
      setNewAmount(String(data.golden_peonies));
    } catch {
      alert("查詢失敗");
    } finally {
      setLoadingUser(false);
    }
  };

  /* ── 設定金牡丹 ── */
  const handleSet = async () => {
    if (!currentInfo) { alert("請先查詢使用者"); return; }
    const amt = parseInt(newAmount, 10);
    if (isNaN(amt) || amt < 0) { alert("請輸入有效數量（非負整數）"); return; }
    const reason = window.prompt(`請輸入調整 ${currentInfo.username} 金牡丹的原因（必填）`, "");
    if (!reason || !reason.trim()) { alert("原因為必填，操作已取消"); return; }
    try {
      const res = await fetch(`${BACKEND}/admin/set-user-peonies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: currentInfo.username, amount: amt, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "操作失敗"); return; }
      alert(`${currentInfo.username} 金牡丹已更新為 ${amt}`);
      setCurrentInfo(prev => ({ ...prev, golden_peonies: amt }));
      loadLogs(1, logFilter);
    } catch {
      alert("操作失敗");
    }
  };

  /* ── 載入紀錄 ── */
  const loadLogs = async (page = 1, username = logFilter) => {
    setLoadingLogs(true);
    try {
      const body = { page, pageSize: PAGE_SIZE };
      if (username.trim()) body.username = username.trim();
      const res = await fetch(`${BACKEND}/admin/peony-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "查詢失敗"); return; }
      setLogs(data.logs || []);
      setLogsTotal(data.total || 0);
      setLogsPage(page);
    } catch {
      alert("載入紀錄失敗");
    } finally {
      setLoadingLogs(false);
    }
  };

  return (
    <div style={{ padding: "8px" }}>

      {/* 查詢 + 設定區 */}
      <div style={{ marginBottom: 16, padding: "10px", background: "#fff0f6", borderRadius: 8, border: "1px solid #ffadd2" }}>
        <div style={{ fontWeight: "bold", marginBottom: 8, color: "#a8071a", display: "flex", alignItems: "center", gap: 6 }}>
          <img src="/gifts/peony.gif" alt="金牡丹" style={{ width: 20, height: 20 }} />
          金牡丹調整
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input
            placeholder="輸入帳號"
            value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchUser()}
            style={{ flex: 1 }}
          />
          <button className="admin-btn" onClick={fetchUser} disabled={loadingUser}>
            {loadingUser ? "查詢中…" : "查詢"}
          </button>
        </div>

        {currentInfo && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "#555" }}>
              <strong>{currentInfo.username}</strong>
              &nbsp;目前金牡丹：
              <strong style={{ color: "#c0392b" }}>{currentInfo.golden_peonies}</strong>
            </span>
            <input
              type="number"
              min="0"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              style={{ width: 70 }}
              onKeyDown={e => e.key === "Enter" && handleSet()}
            />
            <button className="admin-btn" onClick={handleSet}>設定</button>
          </div>
        )}
      </div>

      {/* 紀錄查詢 */}
      <div style={{ marginBottom: 8, display: "flex", gap: 6 }}>
        <input
          placeholder="篩選帳號（留空查全部）"
          value={logFilter}
          onChange={e => setLogFilter(e.target.value)}
          onKeyDown={e => e.key === "Enter" && loadLogs(1, logFilter)}
          style={{ flex: 1 }}
        />
        <button className="admin-btn" onClick={() => loadLogs(1, logFilter)} disabled={loadingLogs}>
          {loadingLogs ? "載入中…" : "查詢紀錄"}
        </button>
      </div>

      {logs.length > 0 && (
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
                {logs.map(log => (
                  <tr key={log.id}>
                    <td>{log.username}</td>
                    <td style={{ color: log.amount_changed >= 0 ? "#389e0d" : "#cf1322", fontWeight: "bold" }}>
                      {log.amount_changed >= 0 ? `+${log.amount_changed}` : log.amount_changed}
                    </td>
                    <td>{log.new_total}</td>
                    <td>{log.granted_by}</td>
                    <td>{log.reason}</td>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-pagination" style={{ marginTop: 8 }}>
            <button className="admin-btn" disabled={logsPage <= 1} onClick={() => loadLogs(logsPage - 1)}>上一頁</button>
            <span style={{ padding: "0 8px", fontSize: 12 }}>{logsPage} / {totalPages || 1}</span>
            <button className="admin-btn" disabled={logsPage >= totalPages} onClick={() => loadLogs(logsPage + 1)}>下一頁</button>
          </div>
        </>
      )}

      {!loadingLogs && logs.length === 0 && logsTotal === 0 && (
        <div style={{ color: "#999", fontSize: 12, textAlign: "center", padding: "16px 0" }}>
          點「查詢紀錄」顯示金牡丹異動記錄
        </div>
      )}
    </div>
  );
}
