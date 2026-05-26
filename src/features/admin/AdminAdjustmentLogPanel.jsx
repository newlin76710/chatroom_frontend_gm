// AdminAdjustmentLogPanel.jsx
import { useState } from "react";
import "./AdminLoginLogPanel.css";

import { BACKEND, RN } from "../../shared/roomConfig";
const PAGE_SIZE = 50;

const toUtc = (localDatetime) => {
  if (!localDatetime) return undefined;
  const normalized = localDatetime.length === 16 ? localDatetime + ":00" : localDatetime;
  return new Date(normalized).toISOString();
};

const typeLabel = (t) => (t === "level" ? "等級" : t === "exp" ? "積分" : t === "gold_apples" ? "金蘋果" : t);

export default function AdminAdjustmentLogPanel({ token }) {
  const [open, setOpen] = useState(false);
  const [logType, setLogType] = useState("adj"); // "adj" | "peony"

  // 調整紀錄
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [adminUser, setAdminUser] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [adjType, setAdjType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // 金牡丹紀錄
  const [peonyLogs, setPeonyLogs] = useState([]);
  const [peonyPage, setPeonyPage] = useState(1);
  const [peonyTotal, setPeonyTotal] = useState(0);
  const [peonyUserFilter, setPeonyUserFilter] = useState("");
  const [peonyLoading, setPeonyLoading] = useState(false);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const peonyTotalPages = Math.ceil(peonyTotal / PAGE_SIZE);

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
      body.room = RN;

      const res = await fetch(`${BACKEND}/admin/adjustment-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

  const loadPeonyLogs = async (pageNum = 1) => {
    setPeonyLoading(true);
    try {
      const body = { page: pageNum, pageSize: PAGE_SIZE };
      if (peonyUserFilter.trim()) body.username = peonyUserFilter.trim();
      const res = await fetch(`${BACKEND}/admin/peony-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "查詢失敗"); return; }
      setPeonyLogs(data.logs || []);
      setPeonyPage(data.page || 1);
      setPeonyTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      alert("查詢金牡丹紀錄失敗");
    } finally {
      setPeonyLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setPage(1);
    loadLogs(1);
  };

  const handleTabSwitch = (type) => {
    setLogType(type);
    if (type === "peony" && peonyLogs.length === 0) {
      loadPeonyLogs(1);
    }
  };

  const handlePage = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    loadLogs(newPage);
  };

  const handlePeonyPage = (newPage) => {
    if (newPage < 1 || newPage > peonyTotalPages) return;
    loadPeonyLogs(newPage);
  };

  const renderPageButtons = (curPage, total, onPage) => {
    const maxButtons = 10;
    let start = Math.max(1, curPage - Math.floor(maxButtons / 2));
    let end = Math.min(total, start + maxButtons - 1);
    if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);
    const buttons = [];
    for (let i = start; i <= end; i++) {
      buttons.push(
        <button
          key={i}
          className="admin-btn"
          style={{ backgroundColor: i === curPage ? "#1565c0" : "#1976d2" }}
          onClick={() => onPage(i)}
          disabled={i === curPage}
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0 }}>調整紀錄</h3>
                <button
                  className="admin-btn"
                  style={{ fontSize: 12, padding: "2px 10px", background: logType === "adj" ? "#1565c0" : "#1976d2" }}
                  onClick={() => handleTabSwitch("adj")}
                >
                  等級 / 金蘋果
                </button>
                <button
                  className="admin-btn"
                  style={{ fontSize: 12, padding: "2px 10px", background: logType === "peony" ? "#1565c0" : "#1976d2" }}
                  onClick={() => handleTabSwitch("peony")}
                >
                  🌸 金牡丹
                </button>
              </div>
              <button onClick={() => setOpen(false)}>✖</button>
            </div>

            {logType === "adj" && (
              <>
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
                    <option value="exp">積分</option>
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
                    {renderPageButtons(page, totalPages, handlePage)}
                    <button className="admin-btn" onClick={() => handlePage(page + 1)} disabled={page >= totalPages}>下一頁</button>
                  </div>
                </div>
              </>
            )}

            {logType === "peony" && (
              <>
                <div className="admin-filter-bar">
                  <input
                    placeholder="篩選帳號（留空查全部）"
                    value={peonyUserFilter}
                    onChange={e => setPeonyUserFilter(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && loadPeonyLogs(1)}
                    style={{ width: "150px" }}
                  />
                  <button className="admin-btn" onClick={() => loadPeonyLogs(1)} disabled={peonyLoading}>
                    {peonyLoading ? "載入中…" : "查詢"}
                  </button>
                  <span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>
                    共 {peonyTotal} 筆
                  </span>
                </div>

                <div className="admin-table-wrapper">
                  <table className="admin-table">
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
                          <td colSpan={6} style={{ textAlign: "center" }}>無資料</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <div className="admin-pagination">
                    <button className="admin-btn" onClick={() => handlePeonyPage(peonyPage - 1)} disabled={peonyPage <= 1}>上一頁</button>
                    {renderPageButtons(peonyPage, peonyTotalPages, handlePeonyPage)}
                    <button className="admin-btn" onClick={() => handlePeonyPage(peonyPage + 1)} disabled={peonyPage >= peonyTotalPages}>下一頁</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
