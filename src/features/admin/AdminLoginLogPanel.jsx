// AdminLoginLogPanel.jsx
import { useState } from "react";
import "./AdminLoginLogPanel.css";

import { roomConfig, BACKEND, RN } from "../../shared/roomConfig";
import { countryZh } from "../../shared/countryZh";

const countryFlag = code =>
  code?.length === 2
    ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
    : "";
const PAGE_SIZE = 20;

// local → UTC
const toUtc = (localDatetime) => {
  if (!localDatetime) return undefined;

  const normalized =
    localDatetime.length === 16
      ? localDatetime + ":00"
      : localDatetime;

  return new Date(normalized).toISOString();
};

export default function AdminLoginLogPanel({
  myName,
  myLevel,
  token,
}) {
  const [logs, setLogs] = useState([]);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // ⭐ 改為 datetime-local
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (!token || myLevel < (roomConfig.admin_max_level || 99)) return null;

  const loadLogs = async (pageNum = 1) => {
    try {
      const body = {
        page: pageNum,
        pageSize: PAGE_SIZE,
      };

      const fromUtc = toUtc(fromDate);
      const toUtcDate = toUtc(toDate);

      if (fromUtc) body.from = fromUtc;
      if (toUtcDate) body.to = toUtcDate;
      body.room = RN;

      const res = await fetch(`${BACKEND}/admin/login-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "權限不足或查詢失敗");
        return;
      }

      setLogs(data.logs || []);
      setPage(data.page || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error(err);
      alert("查詢登入紀錄失敗");
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

    if (end - start < maxButtons - 1)
      start = Math.max(1, end - maxButtons + 1);

    const buttons = [];
    for (let i = start; i <= end; i++) {
      buttons.push(
        <button
          key={i}
          className="admin-btn"
          style={{
            backgroundColor: i === page ? "#1565c0" : "#1976d2",
          }}
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
        🛡 管理登入記錄
      </button>

      {open && (
        <div className="admin-overlay" onClick={() => setOpen(false)}>
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-header">
              <h3>登入紀錄</h3>
              <button onClick={() => setOpen(false)}>✖</button>
            </div>

            {/* ⭐ datetime-local 篩選 */}
            <div className="admin-filter-bar">
              <label>
                起：
                <input
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) =>
                    setFromDate(e.target.value)
                  }
                />
              </label>

              <label>
                迄：
                <input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) =>
                    setToDate(e.target.value)
                  }
                />
              </label>

              <button
                className="admin-btn"
                onClick={() => loadLogs(1)}
              >
                查詢
              </button>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>帳號</th>
                    <th>類型</th>
                    <th>IP</th>
                    <th>結果</th>
                    <th>原因</th>
                    <th>時間（台灣）</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.length > 0 ? (
                    logs.map((l) => (
                      <tr key={l.id}>
                        <td>{l.username}</td>
                        <td>{l.login_type}</td>
                        <td>
                          {l.ip_address}
                          {l.country && <span style={{ marginLeft: 4, color: "#aaa" }}>{countryFlag(l.country.countryCode)} {countryZh(l.country.countryCode) ?? l.country.country}</span>}
                        </td>
                        <td>{l.success ? "✅" : "❌"}</td>
                        <td>{l.fail_reason || "-"}</td>
                        <td>
                          {new Date(l.login_at).toLocaleString("zh-TW", {hour12: false,})}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        style={{ textAlign: "center" }}
                      >
                        無資料
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="admin-pagination">
                <button
                  className="admin-btn"
                  onClick={() => handlePage(page - 1)}
                  disabled={page <= 1}
                >
                  上一頁
                </button>

                {renderPageButtons()}

                <button
                  className="admin-btn"
                  onClick={() => handlePage(page + 1)}
                  disabled={page >= totalPages}
                >
                  下一頁
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
