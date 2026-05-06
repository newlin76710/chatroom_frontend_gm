import { useEffect, useState } from "react";
import "./AdminLoginLogPanel.css"; // 直接沿用樣式

import { roomConfig, BACKEND, RN } from "../../shared/roomConfig";
import { countryZh } from "../../shared/countryZh";

const countryFlag = code =>
  code?.length === 2
    ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
    : "";
const PAGE_SIZE = 20;

export default function AdminIPPanel({ myLevel, token }) {
  const [open, setOpen] = useState(false);
  const [ips, setIps] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [newIP, setNewIP] = useState("");
  const [reason, setReason] = useState("");
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (myLevel < (roomConfig.admin_max_level || 99)) return null;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const loadIPs = async (pageNum = 1) => {
    try {
      const res = await fetch(`${BACKEND}/api/blocked-ips?room=${RN}`, { headers });
      if (!res.ok) throw new Error("載入失敗");
      const data = await res.json();
      setIps(data);
      setPage(pageNum);
      setTotalCount(data.length); // 目前簡單用總長度
    } catch (err) {
      console.error(err);
      alert("載入 IP 黑名單失敗");
    }
  };

  useEffect(() => {
    if (open) loadIPs(1);
  }, [open]);

  const blockIP = async () => {
    if (!newIP.trim()) return;
    try {
      const res = await fetch(`${BACKEND}/api/blocked-ips/block`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ip: newIP.trim(), reason: reason.trim(), room: RN }),
      });
      if (!res.ok) throw new Error("封鎖失敗");
      setNewIP("");
      setReason("");
      loadIPs(1);
    } catch (err) {
      console.error(err);
      alert("封鎖失敗");
    }
  };

  const unblockIP = async (id) => {
    if (!confirm("確定解除封鎖這個 IP？")) return;
    try {
      const res = await fetch(`${BACKEND}/api/blocked-ips/unblock`, {
        method: "POST",
        headers,
        body: JSON.stringify({ id, room: RN }),
      });
      if (!res.ok) throw new Error("解除失敗");
      loadIPs(page);
    } catch (err) {
      console.error(err);
      alert("解除封鎖失敗");
    }
  };

  const handlePage = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
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
      <button className="admin-btn" onClick={() => setOpen(true)}>🛡 IP 黑名單</button>

      {open && (
        <div className="admin-overlay" onClick={() => setOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-header">
              <h3>IP 黑名單管理</h3>
              <button onClick={() => setOpen(false)}>✖</button>
            </div>

            <div style={{ marginBottom: "8px" }}>
              <input
                placeholder="輸入 IP"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                style={{ width: "120px", marginRight: "4px" }}
              />
              <input
                placeholder="原因"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ width: "100px", marginRight: "4px" }}
              />
              <button onClick={blockIP}>封鎖</button>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>國家</th>
                    <th>原因</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {ips.length > 0 ? (
                    ips
                      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                      .map((ip) => (
                        <tr key={ip.id}>
                          <td>{ip.ip}</td>
                          <td>{ip.country ? `${countryFlag(ip.country.countryCode)} ${countryZh(ip.country.countryCode) ?? ip.country.country}` : "-"}</td>
                          <td>{ip.reason || "-"}</td>
                          <td>
                            <button onClick={() => unblockIP(ip.id)}>解除</button>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center" }}>無資料</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* 分頁 */}
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
