// UserList.jsx
import React from "react";
import { aiAvatars } from "../../shared/aiConfig";
import "./UserList.css";
import { roomConfig } from "../../shared/roomConfig";

export default function UserList({
  userList = [],
  target,
  setTarget,
  setChatMode,
  userListCollapsed,
  setUserListCollapsed,
  kickUser,
  kickAndBlockUser,
  muteUser,
  myLevel,
  myName,
  filteredUsers = [],
  setFilteredUsers,
  focusInput,
  token,
}) {
  const ANL = roomConfig.admin_min_level || 91;
  const AML = roomConfig.admin_max_level || 99;
  const OPENAI = roomConfig.openai;
  const [openMenu, setOpenMenu] = React.useState(null);
  const [peonyPopup, setPeonyPopup] = React.useState(null); // { x, y }

  const toggleAdminMenu = (name) => {
    setOpenMenu(openMenu === name ? null : name);
  };

  const visibleUsers = userList.filter(u => OPENAI || u.type !== "AI");

  const toggleFilter = (userName) => {
    if (!setFilteredUsers) return;
    setFilteredUsers(
      filteredUsers.includes(userName)
        ? filteredUsers.filter(u => u !== userName)
        : [...filteredUsers, userName]
    );
  };

  const getUserColorByGender = (gender) => {
    if (gender === "男") return "#A7C7E7";
    if (gender === "女") return "#F8C8DC";
    return "#00aa00";
  };

  return (
    <>
    <div className={`user-list ${userListCollapsed ? "collapsed" : ""}`}>
      <div
        className="user-list-header"
        onClick={() => setUserListCollapsed(!userListCollapsed)}
      >
        在線：{visibleUsers.length} 人
      </div>

      {!userListCollapsed &&
        visibleUsers.map((u, idx) => {
          const avatarUrl = u.avatar || aiAvatars[u.name];
          const isFiltered = filteredUsers.includes(u.name);
          const isSelf = u.name === myName;
          const isAI = u.type === "AI";

          const canKick = myLevel >= ANL && u.level < myLevel && !isSelf && kickUser;
          const canBan = myLevel >= AML && u.level < myLevel && !isSelf && kickAndBlockUser;
          const showManage = !isSelf && !isAI;

          return (
            <div
              key={`${u.name}-${idx}`}
              className={`user-item ${u.name === target ? "selected" : ""}`}
              onClick={() => {
                setChatMode("private");
                setTarget(u.name);
                focusInput?.();
              }}
            >
              {avatarUrl && (
                <img src={avatarUrl} alt={u.name} className="user-avatar" />
              )}

              <span
                className="user-name"
                style={{ color: getUserColorByGender(u.gender) }}
              >
                {u.name}
              </span>
              &nbsp;
              {isAI ? "AI" : u.type === "guest" ? 1 : u.level}

              {roomConfig.open_peony && (u.golden_peonies > 0) && (
                <span
                  className="ul-peony-badge"
                  onMouseEnter={e => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const imgW = 120, imgH = 80;
                    const x = Math.min(r.left + r.width / 2 - imgW / 2, window.innerWidth - imgW - 12);
                    const y = r.top - imgH - 14;
                    setPeonyPopup({ x: Math.max(4, x), y: Math.max(4, y) });
                  }}
                  onMouseLeave={() => setPeonyPopup(null)}
                >
                  <img src="/gifts/peony.gif" alt="金牡丹" className="ul-peony-icon" />
                  {u.golden_peonies}
                </span>
              )}

              {showManage && (
                <div className="ul-admin-wrap">
                  <button
                    className="ul-admin-trigger"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAdminMenu(u.name);
                    }}
                  >
                    互動
                  </button>

                  {openMenu === u.name && (
                    <div className="ul-admin-panel">

                      {/* 過濾 — 所有人可用 */}
                      {setFilteredUsers && (
                        <button
                          className="ul-admin-filter"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFilter(u.name);
                            setOpenMenu(null);
                          }}
                        >
                          {isFiltered ? "🔊 解除過濾" : "🙈 過濾"}
                        </button>
                      )}

                      {/* 踢出 / 禁言 — level 91+ */}
                      {canKick && (
                        <>
                          <button
                            className="ul-admin-kick"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`確定踢出 ${u.name}?`)) {
                                kickUser(u.name);
                                setOpenMenu(null);
                              }
                            }}
                          >
                            👢 踢出
                          </button>
                          <button
                            className="ul-admin-mute"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`禁言 ${u.name} 30秒?`)) {
                                muteUser(u.name);
                                setOpenMenu(null);
                              }
                            }}
                          >
                            🔇 禁言30秒
                          </button>
                        </>
                      )}

                      {/* 封鎖 — level 99+ */}
                      {canBan && (
                        <button
                          className="ul-admin-ban"
                          onClick={(e) => {
                            e.stopPropagation();
                            const reason = window.prompt(`請輸入徹底封鎖 ${u.name} 的原因（必填）`, "");
                            if (!reason || !reason.trim()) {
                              window.alert("封鎖原因必填，操作已取消");
                              return;
                            }
                            if (window.confirm(`確定徹底封鎖 ${u.name}？這會踢出並封鎖 IP 與暱稱。`)) {
                              kickAndBlockUser?.(u.name, reason.trim());
                              setOpenMenu(null);
                            }
                          }}
                        >
                          ⛔ 徹底封鎖
                        </button>
                      )}

                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>

      {peonyPopup && (
        <div
          className="ul-peony-popup"
          style={{ left: peonyPopup.x, top: peonyPopup.y }}
        >
          <img src="/gifts/peony.gif" alt="金牡丹" />
        </div>
      )}
    </>
  );
}
