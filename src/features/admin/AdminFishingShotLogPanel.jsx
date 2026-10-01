// AdminFishingShotLogPanel.jsx — 捕魚甩竿下注明細（/admin/fishing-shot-logs）：每一竿一筆，
// 含下注、傷害、是否打死、派彩、滾入血池金額與當下血池，對帳用。後端批次寫入，最新資料約延遲 2 秒。
import { useState } from "react";
import "./AdminLoginLogPanel.css";

import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";
import DraggablePanel from "../../shared/DraggablePanel";
import { FISH_OPTIONS, ROD_NAMES } from "./AdminFishingLogPanel";

const PAGE_SIZE = 50;

const toUtc = (localDatetime) => {
  if (!localDatetime) return undefined;
  const normalized = localDatetime.length === 16 ? localDatetime + ":00" : localDatetime;
  return new Date(normalized).toISOString();
};
const fmt = (n) => Number(n || 0).toLocaleString("en-US");

export default function AdminFishingShotLogPanel({ token }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState({ total: 0, totalBet: 0, totalPayout: 0, totalPool: 0, totalKilled: 0 });
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [fish, setFish] = useState("");
  const [rod, setRod] = useState("");
  const [result, setResult] = useState("");
  const [bait, setBait] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const totalPages = Math.ceil(summary.total / PAGE_SIZE);

  const loadLogs = async (pageNum = 1) => {
    setLoading(true);
    try {
      const body = { page: pageNum, pageSize: PAGE_SIZE, room: RN };
      if (username.trim()) body.username = username.trim();
      if (fish) body.fish = fish;
      if (rod !== "") body.rod = Number(rod);
      if (result) body.result = result;
      if (bait) body.bait = bait;
      const fromUtc = toUtc(fromDate);
      const toUtcDate = toUtc(toDate);
      if (fromUtc) body.from = fromUtc;
      if (toUtcDate) body.to = toUtcDate;

      const res = await fetch(`${BACKEND}/admin/fishing-shot-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "查詢失敗"); return; }
      setLogs(data.logs || []);
      setPage(data.page || 1);
      setSummary({
        total: data.total || 0,
        totalBet: data.totalBet || 0,
        totalPayout: data.totalPayout || 0,
        totalPool: data.totalPool || 0,
        totalKilled: data.totalKilled || 0,
      });
    } catch (err) {
      console.error(err);
      alert("查詢甩竿明細失敗");
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

  const net = summary.totalBet - summary.totalPayout;

  return (
    <>
      <button className="admin-btn" onClick={handleOpen}>
        🎣 甩竿下注明細
      </button>

      {open && (
        <DraggablePanel title={<h3 style={{ margin: 0 }}>🎣 甩竿下注明細</h3>} onClose={() => setOpen(false)}>
          <div className="admin-filter-bar">
            <input
              placeholder="玩家暱稱"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && loadLogs(1)}
              style={{ width: "110px" }}
            />
            <select value={fish} onChange={e => setFish(e.target.value)}>
              <option value="">全部魚種</option>
              {FISH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={rod} onChange={e => setRod(e.target.value)}>
              <option value="">全部釣竿</option>
              {ROD_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
            <select value={result} onChange={e => setResult(e.target.value)}>
              <option value="">全部結果</option>
              <option value="killed">只看打死</option>
              <option value="miss">只看未打死</option>
            </select>
            <select value={bait} onChange={e => setBait(e.target.value)}>
              <option value="">付費＋魚餌</option>
              <option value="paid">只看付費</option>
              <option value="bait">只看免費魚餌</option>
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
            共 {fmt(summary.total)} 竿（打死 {fmt(summary.totalKilled)}）・下注 {fmt(summary.totalBet)}・派彩 {fmt(summary.totalPayout)}・
            滾入血池 {fmt(summary.totalPool)} {roomConfig.currency_name}・
            下注−派彩 <b style={{ color: net >= 0 ? "#2b8a3e" : "#c92a2a" }}>{fmt(net)}</b>
            <span style={{ display: "block", opacity: 0.8 }}>派彩含 BOSS 尾刀大獎（從血池撥出）；紀錄約延遲 2 秒寫入</span>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>時間（台灣）</th>
                  <th>玩家暱稱</th>
                  <th>目標</th>
                  <th>釣竿／下注</th>
                  <th>傷害</th>
                  <th>結果</th>
                  <th>派彩</th>
                  <th>滾入血池</th>
                  <th>血池餘額</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? logs.map(l => (
                  <tr key={l.id} style={l.killed && l.is_boss ? { background: "#fff6d6", fontWeight: 700 } : undefined}>
                    <td>{new Date(l.created_at).toLocaleString("zh-TW", { hour12: false })}</td>
                    <td>{l.username}</td>
                    <td>{l.is_boss ? `BOSS・${l.fish_name}` : l.fish_name}</td>
                    <td>
                      {l.used_bait
                        ? <span style={{ color: "#d9480f" }}>🍤 免費魚餌</span>
                        : <>{ROD_NAMES[l.rod_idx] || `第 ${l.rod_idx + 1} 支`}・{fmt(l.rod_bet)}</>}
                    </td>
                    {/* 一般魚改成每竿機率擊殺後沒有傷害（存 0），只有 BOSS 有 */}
                    <td style={{ textAlign: "right" }}>{l.damage > 0 ? fmt(l.damage) : "—"}</td>
                    <td>{l.killed ? "✅ 打死" : "—"}</td>
                    <td style={{ textAlign: "right" }}>{l.payout > 0 ? fmt(l.payout) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{fmt(l.pool_contribution)}</td>
                    <td style={{ textAlign: "right" }}>{l.pool_after != null ? fmt(l.pool_after) : "—"}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center" }}>無資料</td>
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
