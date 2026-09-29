// AdminFishingPoolLogPanel.jsx — 捕魚 BOSS／血池紀錄（/admin/fishing-pool-logs）：BOSS 登場、
// 擊殺（尾刀玩家＋大獎）、終極 BOSS 全場金幣雨、管理員重設血池，每筆都附異動前後的血池金額。
// 每一竿滾入血池的小額累積不在這裡，看「甩竿下注明細」的「滾入血池」欄。
import { useState } from "react";
import "./AdminLoginLogPanel.css";

import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";
import DraggablePanel from "../../shared/DraggablePanel";

const PAGE_SIZE = 50;
const EVENT_LABELS = {
  boss_spawn: "⚠️ BOSS 登場",
  boss_kill: "💰 BOSS 擊殺",
  dragon_rain: "🧧 全場金幣雨",
  pool_reset: "🔄 血池重設",
};
const BOSS_LABELS = ["一級", "二級", "三級", "終極"];

const toUtc = (localDatetime) => {
  if (!localDatetime) return undefined;
  const normalized = localDatetime.length === 16 ? localDatetime + ":00" : localDatetime;
  return new Date(normalized).toISOString();
};
const fmt = (n) => Number(n || 0).toLocaleString("en-US");

export default function AdminFishingPoolLogPanel({ token }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState({ total: 0, totalJackpot: 0, totalRain: 0 });
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [event, setEvent] = useState("");
  const [bossTier, setBossTier] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const totalPages = Math.ceil(summary.total / PAGE_SIZE);

  const loadLogs = async (pageNum = 1) => {
    setLoading(true);
    try {
      const body = { page: pageNum, pageSize: PAGE_SIZE, room: RN };
      if (username.trim()) body.username = username.trim();
      if (event) body.event = event;
      if (bossTier) body.bossTier = Number(bossTier);
      const fromUtc = toUtc(fromDate);
      const toUtcDate = toUtc(toDate);
      if (fromUtc) body.from = fromUtc;
      if (toUtcDate) body.to = toUtcDate;

      const res = await fetch(`${BACKEND}/admin/fishing-pool-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "查詢失敗"); return; }
      setLogs(data.logs || []);
      setPage(data.page || 1);
      setSummary({ total: data.total || 0, totalJackpot: data.totalJackpot || 0, totalRain: data.totalRain || 0 });
    } catch (err) {
      console.error(err);
      alert("查詢 BOSS／血池紀錄失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    loadLogs(1);
  };

  const handlePage = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    loadLogs(newPage);
  };

  const userLabel = (l) => {
    if (!l.username) return l.event === "boss_spawn" ? "（自動）" : "—";
    if (l.event === "boss_spawn") return `${l.username}（召喚）`;
    if (l.event === "boss_kill" || l.event === "dragon_rain") return `${l.username}（尾刀）`;
    return l.username;
  };

  const amountLabel = (l) => {
    if (l.event === "boss_spawn") return "—";
    if (l.event === "pool_reset") return `${l.amount >= 0 ? "+" : ""}${fmt(l.amount)}`;
    if (l.event === "dragon_rain") return `${fmt(l.amount)}（${fmt(l.recipients)} 人均分）`;
    return fmt(l.amount);
  };

  return (
    <>
      <button className="admin-btn" onClick={handleOpen}>
        🐉 BOSS／血池紀錄
      </button>

      {open && (
        <DraggablePanel title={<h3 style={{ margin: 0 }}>🐉 BOSS／血池紀錄</h3>} onClose={() => setOpen(false)}>
          <div className="admin-filter-bar">
            <input
              placeholder="玩家暱稱"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && loadLogs(1)}
              style={{ width: "110px" }}
            />
            <select value={event} onChange={e => setEvent(e.target.value)}>
              <option value="">全部事件</option>
              {Object.entries(EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={bossTier} onChange={e => setBossTier(e.target.value)}>
              <option value="">全部 BOSS</option>
              {BOSS_LABELS.map((n, i) => <option key={i} value={i + 1}>{n} BOSS</option>)}
            </select>
            <label>
              起：
              <input type="datetime-local" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </label>
            <label>
              迄：
              <input type="datetime-local" value={toDate} onChange={e => setToDate(e.target.value)} />
            </label>
            <button className="admin-btn" onClick={() => loadLogs(1)} disabled={loading}>
              {loading ? "載入中…" : "查詢"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#666", margin: "4px 0 8px" }}>
            共 {fmt(summary.total)} 筆・尾刀大獎合計 {fmt(summary.totalJackpot)}・金幣雨合計 {fmt(summary.totalRain)} {roomConfig.currency_name}
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>時間（台灣）</th>
                  <th>事件</th>
                  <th>BOSS</th>
                  <th>玩家</th>
                  <th>金額</th>
                  <th>血池（前 → 後）</th>
                  <th>說明</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? logs.map(l => (
                  <tr key={l.id} style={l.event === "boss_kill" || l.event === "dragon_rain" ? { background: "#fff6d6", fontWeight: 700 } : undefined}>
                    <td>{new Date(l.created_at).toLocaleString("zh-TW", { hour12: false })}</td>
                    <td>{EVENT_LABELS[l.event] || l.event}</td>
                    <td>{l.boss_tier ? `${BOSS_LABELS[l.boss_tier - 1] || ""}・${l.boss_name || ""}` : "—"}</td>
                    <td>{userLabel(l)}</td>
                    <td style={{ textAlign: "right" }}>{amountLabel(l)}</td>
                    <td style={{ textAlign: "right" }}>
                      {l.pool_before != null ? fmt(l.pool_before) : "—"} → {l.pool_after != null ? fmt(l.pool_after) : "—"}
                    </td>
                    <td style={{ fontSize: 12 }}>{l.detail || ""}</td>
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
              <span style={{ margin: "0 8px" }}>{page} / {Math.max(1, totalPages)}</span>
              <button className="admin-btn" onClick={() => handlePage(page + 1)} disabled={page >= totalPages}>下一頁</button>
            </div>
          </div>
        </DraggablePanel>
      )}
    </>
  );
}
