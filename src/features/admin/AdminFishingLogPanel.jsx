// AdminFishingLogPanel.jsx — 捕魚中獎紀錄（/admin/fishing-logs）：每打死一條魚/BOSS 一筆，
// 查帳與研究搶尾刀數據用。只有金幣房間有捕魚遊戲，但紀錄查詢不限制（切換過貨幣的房間也看得到舊紀錄）。
import { useState } from "react";
import "./AdminLoginLogPanel.css";

import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";
import DraggablePanel from "../../shared/DraggablePanel";

const PAGE_SIZE = 50;
const ROD_NAMES = ["初級竿", "中級竿", "高級竿", "王者竿", "帝王神竿"];
const BOSS_LABELS = ["一級", "二級", "三級", "終極"];
// 篩選用（對應後端 fishingGame.js 的魚種 key；"boss" = 所有 BOSS）
const FISH_OPTIONS = [
  { value: "boss", label: "所有 BOSS" },
  { value: "boss1", label: "🦑 一級 BOSS" },
  { value: "boss2", label: "🐊 二級 BOSS" },
  { value: "boss3", label: "🦖 三級 BOSS" },
  { value: "boss4", label: "🐉 終極 BOSS" },
  { value: "clownfish", label: "🐠 小丑魚" },
  { value: "puffer", label: "🐡 河豚" },
  { value: "turtle", label: "🐢 海龜" },
  { value: "swordfish", label: "🐟 劍魚" },
  { value: "octopus", label: "🐙 章魚" },
  { value: "shark", label: "🦈 大白鯊" },
  { value: "whale", label: "🐋 藍鯨" },
];

const toUtc = (localDatetime) => {
  if (!localDatetime) return undefined;
  const normalized = localDatetime.length === 16 ? localDatetime + ":00" : localDatetime;
  return new Date(normalized).toISOString();
};
const fmt = (n) => Number(n || 0).toLocaleString("en-US");

export default function AdminFishingLogPanel({ token }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPayout, setTotalPayout] = useState(0);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [fish, setFish] = useState("");
  const [rod, setRod] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const loadLogs = async (pageNum = 1) => {
    setLoading(true);
    try {
      const body = { page: pageNum, pageSize: PAGE_SIZE, room: RN };
      if (username.trim()) body.username = username.trim();
      if (fish) body.fish = fish;
      if (rod !== "") body.rod = Number(rod);
      const fromUtc = toUtc(fromDate);
      const toUtcDate = toUtc(toDate);
      if (fromUtc) body.from = fromUtc;
      if (toUtcDate) body.to = toUtcDate;

      const res = await fetch(`${BACKEND}/admin/fishing-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "查詢失敗"); return; }
      setLogs(data.logs || []);
      setPage(data.page || 1);
      setTotalCount(data.total || 0);
      setTotalPayout(data.totalPayout || 0);
    } catch (err) {
      console.error(err);
      alert("查詢捕魚中獎紀錄失敗");
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

  const fishLabel = (l) => {
    if (l.is_boss) return `${l.fish_emoji || ""} ${BOSS_LABELS[(l.boss_tier || 1) - 1] || ""} BOSS・${l.fish_name}`;
    return `${l.fish_emoji || ""} ${l.fish_name}${l.mult != null ? ` ×${Number(l.mult)}` : ""}`;
  };

  return (
    <>
      <button className="admin-btn" onClick={handleOpen}>
        🎣 捕魚中獎紀錄
      </button>

      {open && (
        <DraggablePanel title={<h3 style={{ margin: 0 }}>🎣 捕魚中獎紀錄</h3>} onClose={() => setOpen(false)}>
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
            <span style={{ fontSize: 12, color: "#666", marginLeft: 8 }}>
              共 {fmt(totalCount)} 筆，合計派彩 {fmt(totalPayout)} {roomConfig.currency_name}
            </span>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>獲獎時間（台灣）</th>
                  <th>玩家暱稱</th>
                  <th>擊殺魚種</th>
                  <th>獲得{roomConfig.currency_name}</th>
                  <th>使用釣竿</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? logs.map(l => (
                  <tr key={l.id} style={l.is_boss ? { background: "#fff6d6", fontWeight: 700 } : undefined}>
                    <td>{new Date(l.created_at).toLocaleString("zh-TW", { hour12: false })}</td>
                    <td>{l.username}</td>
                    <td>{fishLabel(l)}</td>
                    <td style={{ textAlign: "right" }}>{fmt(l.payout)}</td>
                    <td>
                      {fmt(l.rod_bet)}（{ROD_NAMES[l.rod_idx] || `第 ${l.rod_idx + 1} 支`}）
                      {l.used_bait && <span style={{ color: "#d9480f" }}>・🍤 免費魚餌</span>}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>無資料</td>
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
