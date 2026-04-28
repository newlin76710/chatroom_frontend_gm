// AdminAdjustmentLogPanel.jsx
import { useState } from "react";
import "./AdminLoginLogPanel.css";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";
const PAGE_SIZE = 50;

const toUtc = (localDatetime) => {
  if (!localDatetime) return undefined;
  const normalized = localDatetime.length === 16 ? localDatetime + ":00" : localDatetime;
  return new Date(normalized).toISOString();
};

const typeLabel = (t) => (t === "level" ? "等級" : t === "gold_apples" ? "金蘋果" : t);

export default function AdminAdjustmentLogPanel({ token }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [adminUser, setAdminUser] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [adjType, setAdjType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const loadLogs = async (pageNum = 1) => {
    try {
      const body = { page: pageNum, pageSize: PAGE_SIZE };
      if (adminUser.trim()) body.admin_username = adminUser.trim();
      if (targetUser.trim()) body.target_username = targetUser.trim();
      if (adjType) body.adjustment_type = adjType;
      const fromUtc = toUtc(fromDate);
      const toUtcDate = toUtc(toDate);
      if (fromUtc) body.from = fromUtc;
      if (toUtcDate) body.to = toUtcDate;

      const res = await fetch(`${BACKEND}/admin/adjustment-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) { alert(data.error || "查詢失敗"); return; }
      setLogs(data.logs || []);
      setPage(data.page || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error(err);
      alert("查詢調整紀錄失敗");
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setPage(1);
    loadLogs(1);
  };

  const handlePage = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    loadLogs(newPage);
  };

  const renderPageButtons = () => {
    const maxButtons = 10;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);
    const buttons = [];
    for (let i = start; i <= end; i++) {
      buttons.push(
        <button
          key={i}
          className="admin-btn"
          style={{ backgroundColor: i === page ? "#1565c0" : "#1976d2" }}
          onClick={() => handlePage(i)}
          disabled={i === page}
        >
          {i}
        </button>
      );
    }
    return buttons;
  };

  return (
    <>
      <button className="admin-btn" onClick={handleOpen}>
        🛡 調整紀錄
      </button>

      {open && (
        <div className="admin-overlay" onClick={() => setOpen(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-header">
              <h3>等級 / 金蘋果調整紀錄</h3>
              <button onClick={() => setOpen(false)}>✖</button>
            </div>

            <div className="admin-filter-bar">
              <input
                placeholder="管理員帳號"
                value={adminUser}
                onChange={e => setAdminUser(e.target.value)}
                style={{ width: "110px" }}
              />
              <input
                placeholder="目標帳號"
                value={targetUser}
                onChange={e => setTargetUser(e.target.value)}
                style={{ width: "110px" }}
              />
              <select value={adjType} onChange={e => setAdjType(e.target.value)}>
                <option value="">全部類型</option>
                <option value="level">等級</option>
                <option value="gold_apples">金蘋果</option>
              </select>
              <label>
                起：
                <input type="datetime-local" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </label>
              <label>
                迄：
                <input type="datetime-local" value={toDate} onChange={e => setToDate(e.target.value)} />
              </label>
              <button className="admin-btn" onClick={() => loadLogs(1)}>查詢</button>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>管理員</th>
                    <th>目標帳號</th>
                    <th>類型</th>
                    <th>調整前</th>
                    <th>調整後</th>
                    <th>原因</th>
                    <th>時間（台灣）</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length > 0 ? logs.map(l => (
                    <tr key={l.id}>
                      <td>{l.admin_username}</td>
                      <td>{l.target_username}</td>
                      <td>{typeLabel(l.adjustment_type)}</td>
                      <td>{l.old_value ?? "-"}</td>
                      <td>{l.new_value}</td>
                      <td>{l.reason || "-"}</td>
                      <td>{new Date(l.created_at).toLocaleString("zh-TW", { hour12: false })}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center" }}>無資料</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="admin-pagination">
                <button className="admin-btn" onClick={() => handlePage(page - 1)} disabled={page <= 1}>上一頁</button>
                {renderPageButtons()}
                <button className="admin-btn" onClick={() => handlePage(page + 1)} disabled={page >= totalPages}>下一頁</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
