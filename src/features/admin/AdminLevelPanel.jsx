// AdminUserLevelPanel.jsx
import { useEffect, useState } from "react";
import "./AdminLevelPanel.css";

import { roomConfig, BACKEND, RN } from "../../shared/roomConfig";
const PAGE_SIZE = 20;

export default function AdminLevelPanel({ token, myLevel, minLevel }) {
    const [open, setOpen] = useState(false);
    const [users, setUsers] = useState([]);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [keyword, setKeyword] = useState("");

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    if (!token || myLevel < minLevel) return null;

    /* ================= 載入使用者 ================= */
    const loadUsers = async (pageNum = 1, search = keyword) => {
        try {
            const res = await fetch(`${BACKEND}/admin/user-levels`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    page: pageNum,
                    pageSize: PAGE_SIZE,
                    keyword: search,
                    room: RN,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "查詢使用者失敗");
                return;
            }

            setUsers((data.users || []).map(u => ({
                ...u,
                editLevel: u.level,
                editExp: u.exp || 0,
                editGold: u.gold_apples || 0,
                editPeony: u.golden_peonies || 0,
            })));
            setPage(pageNum);
            setTotalCount(data.total || 0);
        } catch (err) {
            console.error(err);
            alert("查詢使用者失敗");
        }
    };

    /* ================= 修改等級 ================= */
    const handleLevelChange = async (username, newLevel) => {
        if (!window.confirm(`確定將 ${username} 的等級設為 ${newLevel} 嗎？`)) return;
        const reason = window.prompt("請輸入調整原因（必填）", "");
        if (!reason || !reason.trim()) { alert("調整原因為必填，操作已取消"); return; }

        try {
            const res = await fetch(`${BACKEND}/admin/set-user-level`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    username,
                    level: Number(newLevel),
                    reason,
                    room: RN,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "更新失敗");
                return;
            }

            alert("等級更新成功");
            setUsers(prev =>
                prev.map(u =>
                    u.username === username
                        ? { ...u, level: Number(newLevel), editLevel: Number(newLevel) }
                        : u
                )
            );
        } catch (err) {
            console.error(err);
            alert("更新失敗");
        }
    };

    /* ================= 修改金蘋果 ================= */
    const handleExpChange = async (username, newExp) => {
        if (!window.confirm(`確定將 ${username} 的積分設為 ${newExp} 嗎？`)) return;
        const reason = window.prompt("請輸入修改原因（必填）", "");
        if (!reason || !reason.trim()) { alert("修改原因必填"); return; }

        try {
            const res = await fetch(`${BACKEND}/admin/set-user-exp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    username,
                    exp: Number(newExp),
                    reason,
                    room: RN,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "更新失敗");
                return;
            }

            alert("積分已更新");
            setUsers(prev =>
                prev.map(u =>
                    u.username === username
                        ? { ...u, exp: Number(newExp), editExp: Number(newExp) }
                        : u
                )
            );
        } catch (err) {
            console.error(err);
            alert("更新失敗");
        }
    };

    /* ================= 修改金牡丹 ================= */
    const handlePeonyChange = async (username, newPeony) => {
        if (!window.confirm(`確定將 ${username} 的金牡丹設為 ${newPeony} 嗎？`)) return;
        const reason = window.prompt("請輸入調整原因（必填）", "");
        if (!reason || !reason.trim()) { alert("調整原因為必填，操作已取消"); return; }
        try {
            const res = await fetch(`${BACKEND}/admin/set-user-peonies`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ username, amount: Number(newPeony), reason }),
            });
            const data = await res.json();
            if (!res.ok) { alert(data.error || "更新失敗"); return; }
            alert("金牡丹更新成功");
            setUsers(prev =>
                prev.map(u =>
                    u.username === username
                        ? { ...u, golden_peonies: Number(newPeony), editPeony: Number(newPeony) }
                        : u
                )
            );
        } catch (err) {
            console.error(err);
            alert("更新失敗");
        }
    };

    const handleGoldChange = async (username, newGold) => {
        if (!window.confirm(`確定將 ${username} 的金蘋果設為 ${newGold} 顆嗎？`)) return;
        const reason = window.prompt("請輸入調整原因（必填）", "");
        if (!reason || !reason.trim()) { alert("調整原因為必填，操作已取消"); return; }

        try {
            const res = await fetch(`${BACKEND}/admin/set-user-gold`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    username,
                    gold_apples: Number(newGold),
                    reason,
                    room: RN,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "更新失敗");
                return;
            }

            alert("金蘋果更新成功");
            setUsers(prev =>
                prev.map(u =>
                    u.username === username
                        ? { ...u, gold_apples: Number(newGold), editGold: Number(newGold) }
                        : u
                )
            );
        } catch (err) {
            console.error(err);
            alert("更新失敗");
        }
    };

    /* ================= 分頁按鈕 ================= */
    const renderPageButtons = () => {
        const buttons = [];
        const maxButtons = 7;
        if (totalPages <= maxButtons) {
            for (let p = 1; p <= totalPages; p++) {
                buttons.push(
                    <button key={p} className="admin-btn" disabled={p === page} onClick={() => loadUsers(p)}>
                        {p}
                    </button>
                );
            }
        } else {
            buttons.push(
                <button key={1} className="admin-btn" disabled={page === 1} onClick={() => loadUsers(1)}>1</button>
            );

            let start = Math.max(2, page - 2);
            let end = Math.min(totalPages - 1, page + 2);

            if (start > 2) buttons.push(<span key="start-ellipsis">...</span>);
            for (let p = start; p <= end; p++) {
                buttons.push(
                    <button key={p} className="admin-btn" disabled={p === page} onClick={() => loadUsers(p)}>
                        {p}
                    </button>
                );
            }
            if (end < totalPages - 1) buttons.push(<span key="end-ellipsis">...</span>);

            buttons.push(
                <button key={totalPages} className="admin-btn" disabled={page === totalPages} onClick={() => loadUsers(totalPages)}>
                    {totalPages}
                </button>
            );
        }

        return buttons;
    };

    return (
        <>
            <button className="admin-btn" onClick={() => { setOpen(true); loadUsers(1); }}>
                🛡 管理使用者等級 {roomConfig.new_function && "& 金蘋果 & 金牡丹"}
            </button>

            {open && (
                <div className="admin-overlay" onClick={() => setOpen(false)}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()}>
                        <div className="admin-header">
                            <h3>使用者管理</h3>
                            <button onClick={() => setOpen(false)}>✖</button>
                        </div>

                        <div style={{ marginBottom: "10px" }}>
                            <input
                                placeholder="搜尋使用者"
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                            />
                            <button className="admin-btn" onClick={() => loadUsers(1, keyword)}>
                                搜尋
                            </button>
                        </div>

                        <div className="admin-table-wrapper">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>帳號</th>
                                        <th>等級</th>
                                        <th>積分</th>
                                        {roomConfig.new_function && <th>金蘋果</th>}
                                        {roomConfig.new_function && <th>金牡丹</th>}
                                        <th>建立時間</th>
                                        <th>最近登入</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length > 0 ? users.map(u => (
                                        <tr key={u.id}>
                                            <td>{u.username}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={myLevel}
                                                    value={u.editLevel}
                                                    style={{ width: "50px", marginRight: "6px" }}
                                                    onChange={e =>
                                                        setUsers(prev =>
                                                            prev.map(x =>
                                                                x.id === u.id
                                                                    ? { ...x, editLevel: e.target.value }
                                                                    : x
                                                            )
                                                        )
                                                    }
                                                />
                                                <button
                                                    className="admin-btn"
                                                    onClick={() => handleLevelChange(u.username, u.editLevel)}
                                                    style={{ marginRight: "6px" }}
                                                >
                                                    修改
                                                </button>
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={u.editExp}
                                                    style={{ width: "70px", marginRight: "6px" }}
                                                    onChange={e =>
                                                        setUsers(prev =>
                                                            prev.map(x =>
                                                                x.id === u.id
                                                                    ? { ...x, editExp: e.target.value }
                                                                    : x
                                                            )
                                                        )
                                                    }
                                                />
                                                <button
                                                    className="admin-btn"
                                                    onClick={() => handleExpChange(u.username, u.editExp)}
                                                    style={{ marginRight: "6px" }}
                                                >
                                                    修改
                                                </button>
                                            </td>
                                            {roomConfig.new_function && (<td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={roomConfig.max_gold_apples ?? 999999999}
                                                    value={u.editGold}
                                                    style={{ width: "60px", marginRight: "6px" }}
                                                    onChange={e =>
                                                        setUsers(prev =>
                                                            prev.map(x =>
                                                                x.id === u.id
                                                                    ? { ...x, editGold: e.target.value }
                                                                    : x
                                                            )
                                                        )
                                                    }
                                                />
                                                <button
                                                    className="admin-btn"
                                                    onClick={() => handleGoldChange(u.username, u.editGold)}
                                                >
                                                    修改
                                                </button>
                                            </td>)}
                                            {roomConfig.new_function && (<td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={u.editPeony}
                                                    style={{ width: "60px", marginRight: "6px" }}
                                                    onChange={e =>
                                                        setUsers(prev =>
                                                            prev.map(x =>
                                                                x.id === u.id
                                                                    ? { ...x, editPeony: e.target.value }
                                                                    : x
                                                            )
                                                        )
                                                    }
                                                />
                                                <button
                                                    className="admin-btn"
                                                    onClick={() => handlePeonyChange(u.username, u.editPeony)}
                                                >
                                                    修改
                                                </button>
                                            </td>)}
                                            <td>{new Date(u.created_at).toLocaleString()}</td>
                                            <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "-"}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={roomConfig.new_function ? 7 : 5} style={{ textAlign: "center" }}>無資料</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="admin-pagination">
                            <button className="admin-btn" disabled={page <= 1} onClick={() => loadUsers(page - 1)}>
                                上一頁
                            </button>
                            {renderPageButtons()}
                            <button className="admin-btn" disabled={page >= totalPages} onClick={() => loadUsers(page + 1)}>
                                下一頁
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
