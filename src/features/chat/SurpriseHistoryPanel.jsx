import { useEffect, useState } from "react";
import "./SurpriseHistoryPanel.css";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";

const fmt = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};

export default function SurpriseHistoryPanel({ token }) {
  const [open, setOpen]       = useState(false);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${BACKEND}/admin/surprise-history`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error("查詢樂透紀錄失敗", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
  };

  useEffect(() => {
    if (!open || !token) return;
    fetchLogs();
  }, [open, token]);

  if (!open) {
    return (
      <button className="surprise-history-btn" onClick={handleOpen} title="金蘋果樂透紀錄">
        🎊 樂透紀錄
      </button>
    );
  }

  return (
    <div className="surprise-history-modal">
      <div className="surprise-history-content">
        <h3 style={{ color: "#FFD700", marginBottom: 12 }}>🎊 金蘋果樂透紀錄（10日內）</h3>

        {loading ? (
          <div style={{ color: "#aaa" }}>讀取中...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #444", color: "#FFD700" }}>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>排程時間</th>
                <th style={{ textAlign: "left", padding: "4px 8px" }}>觸發時間</th>
                <th style={{ textAlign: "left", padding: "4px 8px", width: 132, whiteSpace: "nowrap" }}>得獎者</th>
                <th style={{ textAlign: "right", padding: "4px 8px", width: 108, whiteSpace: "nowrap" }}>金蘋果</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #333" }}>
                  <td style={{ padding: "4px 8px", color: "#ccc" }}>{fmt(r.scheduled_time)}</td>
                  <td style={{ padding: "4px 8px", color: "#ccc" }}>
                    {r.triggered_at ? fmt(r.triggered_at) : <span style={{ color: "#888" }}>待觸發</span>}
                  </td>
                  <td style={{ padding: "4px 8px", color: r.winner ? "#FFD700" : "#888", fontWeight: r.winner ? "bold" : "normal", whiteSpace: "nowrap" }}>
                    {r.winner || "（無人上麥）"}
                  </td>
                  <td style={{ padding: "4px 8px", textAlign: "right", color: r.winner ? "#FFD700" : "#888", whiteSpace: "nowrap" }}>
                    {r.winner ? (
                      <span className="surprise-history-reward">
                        +{r.amount}
                        <img src="/gifts/gold_apple.gif" alt="金蘋果" className="surprise-history-apple" />
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "#888", padding: 12 }}>尚無紀錄</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 14, textAlign: "right" }}>
          <button className="surprise-history-close-btn" onClick={() => setOpen(false)}>關閉</button>
        </div>
      </div>
    </div>
  );
}
