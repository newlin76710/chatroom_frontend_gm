import { useState } from "react";
import "./AdminLoginLogPanel.css"; // 直接沿用樣式

import { roomConfig, BACKEND } from "../../shared/roomConfig";
import { countryZh } from "../../shared/countryZh";

const countryFlag = code =>
  code?.length === 2
    ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
    : "";

export default function AdminOnlineIPPanel({ myLevel, token }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  if (myLevel < (roomConfig.admin_max_level || 99)) return null;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/admin/online-ips`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("載入失敗");
      setRows(await res.json());
    } catch (err) {
      console.error(err);
      alert("載入線上 IP 清單失敗");
    } finally {
      setLoading(false);
    }
  };

  const openPanel = () => {
    setOpen(true);
    load();
  };

  const totalUsers = rows.reduce((sum, r) => sum + r.users.length, 0);

  return (
    <>
      <button className="admin-btn" onClick={openPanel}>🌐 線上 IP</button>

      {open && (
        <div className="admin-overlay" onClick={() => setOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-header">
              <h3>目前線上使用者 IP（{rows.length} 個 IP / {totalUsers} 人）</h3>
              <button onClick={() => setOpen(false)}>✖</button>
            </div>

            <div style={{ padding: "10px 16px 0" }}>
              <button className="admin-btn" onClick={load} disabled={loading}>
                {loading ? "載入中…" : "重新整理"}
              </button>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>國家</th>
                    <th>人數</th>
                    <th>使用者</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0 ? (
                    rows.map((r) => (
                      <tr key={r.ip}>
                        <td>{r.ip}</td>
                        <td>{r.country ? `${countryFlag(r.country.countryCode)} ${countryZh(r.country.countryCode) ?? r.country.country}` : "-"}</td>
                        <td style={{ color: r.users.length > 1 ? "#d32f2f" : undefined, fontWeight: r.users.length > 1 ? 600 : undefined }}>
                          {r.users.length}
                        </td>
                        <td style={{ whiteSpace: "normal" }}>
                          {r.users.map((u, i) => (
                            <span key={i} style={{ marginRight: 8 }}>
                              {u.name}（{u.type === "account" ? "帳號" : "訪客"} Lv.{u.level ?? "-"}）
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center" }}>
                        {loading ? "載入中…" : "目前無線上使用者"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
