// MessageLogPanel.jsx
import { useState } from "react";
import "./MessageLogPanel.css";

import { roomConfig, BACKEND, RN } from "../../shared/roomConfig";
import { countryZh } from "../../shared/countryZh";
import DraggablePanel from "../../shared/DraggablePanel";
const PAGE_SIZE = 20;

const countryFlag = code =>
  code?.length === 2
    ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
    : "";

// local → UTC
const toUtc = (localDatetime) => {
  if (!localDatetime) return undefined;

  const normalized =
    localDatetime.length === 16
      ? localDatetime + ":00"
      : localDatetime;

  return new Date(normalized).toISOString();
};

export default function MessageLogPanel({
  myName,
  myLevel,
  token,
  userList = [],
}) {
  const [logs, setLogs] = useState([]);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [searchUsername, setSearchUsername] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchTarget, setSearchTarget] = useState("");
  const [conversationMode, setConversationMode] = useState(false); // 雙向對話（含公開）：username/target 互為對象

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // 點某筆發言查看「當時前後 N 分鐘」公開頻道上下文
  const [context, setContext] = useState(null); // { anchorId, windowMinutes, logs, loading }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (!token || myLevel < (roomConfig.admin_max_level || 99)) return null;

  const loadLogs = async (pageNum = 1) => {
    try {
      const body = {
        page: pageNum,
        pageSize: PAGE_SIZE,
      };

      if (searchUsername) body.username = searchUsername;
      if (searchTarget) body.target = searchTarget;
      if (searchKeyword) body.keyword = searchKeyword;
      if (conversationMode && searchUsername && searchTarget) body.conversation = true;

      const fromUtc = toUtc(fromDate);
      const toUtcDate = toUtc(toDate);

      if (fromUtc) body.from = fromUtc;
      if (toUtcDate) body.to = toUtcDate;
      body.room = RN;

      const res = await fetch(`${BACKEND}/admin/message-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "查詢失敗");
        return;
      }

      setLogs(data.logs || []);
      setPage(data.page || 1);
      setTotalCount(data.total || 0);
    } catch (err) {
      console.error(err);
      alert("查詢發言紀錄失敗");
    }
  };

  const loadContext = async (log, windowMinutes = 5) => {
    setContext({ anchorId: log.id, windowMinutes, logs: [], loading: true });
    try {
      const res = await fetch(`${BACKEND}/admin/message-logs/context`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: log.id, room: RN, windowMinutes }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "查詢失敗");
        setContext(null);
        return;
      }

      setContext({ anchorId: log.id, windowMinutes, logs: data.logs || [], loading: false });
    } catch (err) {
      console.error(err);
      alert("查詢上下文失敗");
      setContext(null);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setPage(1);
    //loadLogs(1); // 打開時直接查詢
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
        💬 管理發言紀錄
      </button>

      {open && (
        <DraggablePanel title="發言紀錄" onClose={() => setOpen(false)}>
            {/* 搜尋區 */}
            <div className="admin-search">
              <input
                type="text"
                list="msglog-username-datalist"
                placeholder="使用者 ID"
                value={searchUsername}
                onChange={(e) =>
                  setSearchUsername(e.target.value)
                }
              />

              <input
                type="text"
                list="msglog-target-datalist"
                placeholder="對象 ID（雙向對話用）"
                value={searchTarget}
                onChange={(e) =>
                  setSearchTarget(e.target.value)
                }
              />

              <datalist id="msglog-username-datalist">
                {userList.filter((u) => u.type !== "AI").map((u) => <option key={u.id} value={u.name} />)}
              </datalist>
              <datalist id="msglog-target-datalist">
                {userList.filter((u) => u.type !== "AI").map((u) => <option key={u.id} value={u.name} />)}
              </datalist>

              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }} title="同時撈出「使用者→對象」與「對象→使用者」的私聊，並一併撈出兩人各自的公開發言，依時間排序，方便還原糾紛上下文">
                <input
                  type="checkbox"
                  checked={conversationMode}
                  onChange={(e) => setConversationMode(e.target.checked)}
                  disabled={!searchUsername || !searchTarget}
                />
                雙向對話（含公開）
              </label>

              <input
                type="text"
                className="keyword"
                placeholder="關鍵字"
                value={searchKeyword}
                onChange={(e) =>
                  setSearchKeyword(e.target.value)
                }
              />

              {/* datetime-local */}
              <input
                type="datetime-local"
                value={fromDate}
                onChange={(e) =>
                  setFromDate(e.target.value)
                }
              />

              <input
                type="datetime-local"
                value={toDate}
                onChange={(e) =>
                  setToDate(e.target.value)
                }
              />

              <button
                className="admin-btn"
                onClick={() => loadLogs(1)}
              >
                搜尋
              </button>
            </div>

            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>使用者</th>
                    <th>對象</th>
                    <th>內容</th>
                    <th>類型</th>
                    <th>IP</th>
                    <th>時間（台灣）</th>
                    <th>上下文</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.length > 0 ? (
                    logs.map((l) => (
                      <tr key={l.id}>
                        <td>{l.username}</td>
                        <td>{l.target || "-"}</td>

                        <td
                          style={{
                            maxWidth: 300,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {l.message}
                        </td>

                        <td>
                          {l.mode === "private"
                            ? "私聊"
                            : "公開"}
                        </td>

                        <td>
                          {l.ip || "-"}
                          {l.country && <span style={{ marginLeft: 4, color: "#aaa" }}>{countryFlag(l.country.countryCode)} {countryZh(l.country.countryCode) ?? l.country.country}</span>}
                        </td>

                        <td>
                          {new Date(l.created_at).toLocaleString("zh-TW", {hour12: false,})}
                        </td>

                        <td>
                          <button className="admin-btn" onClick={() => loadContext(l, 5)} title="查看當時前後幾分鐘公開頻道的完整對話，還原當下上下文">
                            🔍 查看
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
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
        </DraggablePanel>
      )}

      {context && (
        <DraggablePanel
          title={`上下文（前後 ${context.windowMinutes} 分鐘，公開頻道）`}
          onClose={() => setContext(null)}
          width={700}
        >
          <div className="admin-search">
            {[5, 10].map((m) => (
              <button
                key={m}
                className="admin-btn"
                style={{ backgroundColor: context.windowMinutes === m ? "#1565c0" : "#1976d2" }}
                onClick={() => loadContext({ id: context.anchorId }, m)}
              >
                前後 {m} 分鐘
              </button>
            ))}
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>使用者</th>
                  <th>對象</th>
                  <th>內容</th>
                  <th>時間（台灣）</th>
                </tr>
              </thead>
              <tbody>
                {context.loading ? (
                  <tr><td colSpan={4} style={{ textAlign: "center" }}>查詢中...</td></tr>
                ) : context.logs.length > 0 ? (
                  context.logs.map((l) => (
                    <tr key={l.id} style={l.id === context.anchorId ? { backgroundColor: "#ffe082" } : undefined}>
                      <td>{l.username}</td>
                      <td>{l.target || "-"}</td>
                      <td style={{ maxWidth: 300, whiteSpace: "pre-wrap" }}>{l.message}</td>
                      <td>{new Date(l.created_at).toLocaleString("zh-TW", { hour12: false })}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} style={{ textAlign: "center" }}>這段時間沒有公開頻道發言</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DraggablePanel>
      )}
    </>
  );
}
