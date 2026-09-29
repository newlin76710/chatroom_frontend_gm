// AdminGiftCommissionLogPanel.jsx — 送禮抽成紀錄（/admin/gift-commission-logs）：每筆送禮一筆，
// 記禮物總價、後台扣除比例、系統抽成、受贈者實得，以及這筆送禮換到的捕魚免費魚餌次數，對帳用。
import { useState } from "react";
import "./AdminLoginLogPanel.css";

import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";
import DraggablePanel from "../../shared/DraggablePanel";

const PAGE_SIZE = 50;
// 對應後端 transferGold.js 的禮物 itemId
const GIFT_OPTIONS = [
  { value: "diamond", label: "💎 鑽石" },
  { value: "plane", label: "✈️ 飛機" },
  { value: "car", label: "🚗 跑車" },
  { value: "cruise", label: "🛳️ 郵輪" },
  { value: "rose", label: "🌹 玫瑰" },
  { value: "chocolate", label: "🍫 巧克力" },
  { value: "cake", label: "🎂 蛋糕" },
];
const GIFT_LABELS = Object.fromEntries(GIFT_OPTIONS.map(o => [o.value, o.label]));

const toUtc = (localDatetime) => {
  if (!localDatetime) return undefined;
  const normalized = localDatetime.length === 16 ? localDatetime + ":00" : localDatetime;
  return new Date(normalized).toISOString();
};
const fmt = (n) => Number(n || 0).toLocaleString("en-US");

export default function AdminGiftCommissionLogPanel({ token }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState({ total: 0, totalPrice: 0, totalCommission: 0, totalCredited: 0, totalBait: 0 });
  const [loading, setLoading] = useState(false);
  const [sender, setSender] = useState("");
  const [receiver, setReceiver] = useState("");
  const [item, setItem] = useState("");
  const [baitOnly, setBaitOnly] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const totalPages = Math.ceil(summary.total / PAGE_SIZE);
  const unit = roomConfig.currency_name;

  const loadLogs = async (pageNum = 1) => {
    setLoading(true);
    try {
      const body = { page: pageNum, pageSize: PAGE_SIZE, room: RN };
      if (sender.trim()) body.sender = sender.trim();
      if (receiver.trim()) body.receiver = receiver.trim();
      if (item) body.item = item;
      if (baitOnly) body.baitOnly = true;
      const fromUtc = toUtc(fromDate);
      const toUtcDate = toUtc(toDate);
      if (fromUtc) body.from = fromUtc;
      if (toUtcDate) body.to = toUtcDate;

      const res = await fetch(`${BACKEND}/admin/gift-commission-logs`, {
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
        totalPrice: data.totalPrice || 0,
        totalCommission: data.totalCommission || 0,
        totalCredited: data.totalCredited || 0,
        totalBait: data.totalBait || 0,
      });
    } catch (err) {
      console.error(err);
      alert("查詢送禮抽成紀錄失敗");
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

  const onEnter = e => e.key === "Enter" && loadLogs(1);

  return (
    <>
      <button className="admin-btn" onClick={handleOpen}>
        🎁 送禮抽成紀錄
      </button>

      {open && (
        <DraggablePanel title={<h3 style={{ margin: 0 }}>🎁 送禮抽成紀錄</h3>} onClose={() => setOpen(false)}>
          <div className="admin-filter-bar">
            <input placeholder="送禮者" value={sender} onChange={e => setSender(e.target.value)} onKeyDown={onEnter} style={{ width: "100px" }} />
            <input placeholder="受贈者" value={receiver} onChange={e => setReceiver(e.target.value)} onKeyDown={onEnter} style={{ width: "100px" }} />
            <select value={item} onChange={e => setItem(e.target.value)}>
              <option value="">全部禮物</option>
              {GIFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <label>
              <input type="checkbox" checked={baitOnly} onChange={e => setBaitOnly(e.target.checked)} />
              只看有換魚餌
            </label>
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
            共 {fmt(summary.total)} 筆・禮物總額 {fmt(summary.totalPrice)}・系統抽成 {fmt(summary.totalCommission)}・受贈者實得 {fmt(summary.totalCredited)} {unit}・換出魚餌 {fmt(summary.totalBait)} 次
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>送禮時間（台灣）</th>
                  <th>送禮者</th>
                  <th>受贈者</th>
                  <th>禮物</th>
                  <th>禮物總價</th>
                  <th>扣除比例</th>
                  <th>系統抽成</th>
                  <th>受贈者實得</th>
                  <th>換到魚餌</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? logs.map(l => (
                  <tr key={l.id}>
                    <td>{new Date(l.created_at).toLocaleString("zh-TW", { hour12: false })}</td>
                    <td>{l.sender}</td>
                    <td>{l.receiver}</td>
                    <td>
                      {GIFT_LABELS[l.item_type] || l.item_type} ×{fmt(l.quantity)}
                      {l.is_combo && <span style={{ color: "#d9480f" }}>・連送組合</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmt(l.total_price)}</td>
                    <td style={{ textAlign: "right" }}>{l.deduction_pct}%</td>
                    <td style={{ textAlign: "right" }}>{fmt(l.commission)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(l.receiver_credited)}</td>
                    <td style={{ textAlign: "right" }}>{l.bait_added > 0 ? `🍤 ${l.bait_added}` : "—"}</td>
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
