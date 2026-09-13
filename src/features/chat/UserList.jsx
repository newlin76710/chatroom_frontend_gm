// UserList.jsx
import React, { useCallback } from "react";
import { getAiAvatar } from "../../shared/aiConfig";
import "./UserList.css";
import { roomConfig } from "../../shared/roomConfig";
import { SNOWBALL_MIN_LEVEL } from "../../shared/constants";

// 單一使用者列抽成獨立、模組層級的 memo 元件，且只吃基本型別 (string/number/boolean) 當 props。
// 忙碌房間裡 updateUsers 幾乎每次都會給一個全新的使用者陣列（就算內容沒變），
// 若整列吃「使用者物件」當 props，物件參照每次都不同，memo 形同虛設。
// 改吃基本型別後，即使外層陣列/物件參照改變，只要這個使用者實際顯示的值沒變，
// React.memo 的淺層比較就能正確跳過這一列的重新渲染。
const UserRow = React.memo(function UserRow({
  name,
  level,
  gender,
  type,
  avatarUrl,
  goldenPeonies,
  isSelf,
  isTarget,
  isFiltered,
  isMenuOpen,
  canKick,
  canBan,
  showManage,
  hasRpsChallenge,
  hasPingpongChallenge,
  hasSnowballThrow,
  hasFilterToggle,
  gamesBusy,
  myLevel,
  onRowClick,
  onToggleMenu,
  onRpsChallenge,
  onPingpongChallenge,
  onSnowballThrow,
  onToggleFilter,
  onKickUser,
  onMuteUser,
  onKickAndBlockUser,
  onPeonyHover,
}) {
  const ANL = roomConfig.admin_min_level || 91;
  const AML = roomConfig.admin_max_level || 99;
  const MINI_AML = roomConfig.mini_admin_level || 98;
  const isAI = type === "AI";
  const color = gender === "男" ? "#A7C7E7" : gender === "女" ? "#F8C8DC" : "#00aa00";

  return (
    <div
      className={`user-item ${isTarget ? "selected" : ""}`}
      onClick={() => onRowClick(name)}
    >
      {avatarUrl && <img src={avatarUrl} alt={name} className="user-avatar" />}

      <span className="user-name" style={{ color }}>
        {name}
      </span>
      {!isAI && level >= SNOWBALL_MIN_LEVEL && level < ANL && (
        <span className="ul-premium-badge" title="高級會員">🎖️</span>
      )}
      {!isAI && level >= AML && (
        <span className="ul-owner-badge" title="大站長">👑</span>
      )}
      {!isAI && level === MINI_AML && level < AML && (
        <span className="ul-mini-owner-badge" title="小站長">🥈</span>
      )}
      {!isAI && level >= ANL && level < AML && level !== MINI_AML && (
        <span className="ul-admin-badge" title="管理員">🔱</span>
      )}
      &nbsp;
      {isAI ? "AI" : type === "guest" ? 1 : level}

      {roomConfig.open_peony && goldenPeonies > 0 && (
        <span
          className="ul-peony-badge"
          onMouseEnter={(e) => onPeonyHover(e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => onPeonyHover(null)}
        >
          <img src="/gifts/peony.gif" alt="金牡丹" className="ul-peony-icon" />
          {goldenPeonies}
        </span>
      )}

      {showManage && (
        <div className="ul-admin-wrap">
          <button
            className="ul-admin-trigger"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(name);
            }}
          >
            互動
          </button>

          {isMenuOpen && (
            <div className="ul-admin-panel">
              {hasRpsChallenge && (
                <button
                  className="ul-admin-rps"
                  disabled={gamesBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRpsChallenge(name);
                    onToggleMenu(null);
                  }}
                >
                  ✊ 猜拳
                </button>
              )}

              {hasPingpongChallenge && (
                <button
                  className="ul-admin-pingpong"
                  disabled={gamesBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPingpongChallenge(name);
                    onToggleMenu(null);
                  }}
                >
                  🏓 乒乓球
                </button>
              )}

              {hasSnowballThrow && myLevel >= SNOWBALL_MIN_LEVEL && (
                <button
                  className="ul-admin-snowball"
                  title={`冷卻時間：約 ${roomConfig.snowball_cooldown_minutes ?? 10} 分鐘`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSnowballThrow(name);
                    onToggleMenu(null);
                  }}
                >
                  ❄️ 丟雪球
                </button>
              )}

              {hasFilterToggle && (
                <button
                  className="ul-admin-filter"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFilter(name);
                    onToggleMenu(null);
                  }}
                >
                  {isFiltered ? "🔊 解除過濾" : "🙈 過濾"}
                </button>
              )}

              {canKick && (
                <>
                  <button
                    className="ul-admin-kick"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`確定踢出 ${name}?`)) {
                        onKickUser(name);
                        onToggleMenu(null);
                      }
                    }}
                  >
                    👢 踢出
                  </button>
                  <button
                    className="ul-admin-mute"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`禁言 ${name} 30秒?`)) {
                        onMuteUser(name);
                        onToggleMenu(null);
                      }
                    }}
                  >
                    🔇 禁言30秒
                  </button>
                </>
              )}

              {canBan && (
                <button
                  className="ul-admin-ban"
                  onClick={(e) => {
                    e.stopPropagation();
                    const reason = window.prompt(`請輸入徹底封鎖 ${name} 的原因（必填）`, "");
                    if (!reason || !reason.trim()) {
                      window.alert("封鎖原因必填，操作已取消");
                      return;
                    }
                    if (window.confirm(`確定徹底封鎖 ${name}？這會踢出並封鎖 IP 與暱稱。`)) {
                      onKickAndBlockUser?.(name, reason.trim());
                      onToggleMenu(null);
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
});

function UserList({
  userList = [],
  target,
  setTarget,
  setChatMode,
  chatMode,
  onSelectTarget,
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
  onRpsChallenge,
  onPingpongChallenge,
  onSnowballThrow,
  gamesBusy,
}) {
  const ANL = roomConfig.admin_min_level || 91;
  const AML = roomConfig.admin_max_level || 99;
  const OPENAI = roomConfig.openai;
  const [openMenu, setOpenMenu] = React.useState(null);
  const [peonyPopup, setPeonyPopup] = React.useState(null); // { x, y }

  const visibleUsers = userList.filter(u => OPENAI || u.type !== "AI");
  const maleCount = visibleUsers.filter(u => u.type !== "AI" && u.gender === "男").length;
  const femaleCount = visibleUsers.filter(u => u.type !== "AI" && u.gender === "女").length;

  const handleRowClick = useCallback((name) => {
    if (onSelectTarget) {
      onSelectTarget(name);
    } else {
      setChatMode(chatMode === "private" ? "private" : "publicTarget");
      setTarget(name);
      focusInput?.();
    }
  }, [onSelectTarget, chatMode, setChatMode, setTarget, focusInput]);

  const handleToggleMenu = useCallback((name) => {
    setOpenMenu((prev) => (name === null ? null : prev === name ? null : name));
  }, []);

  const handleToggleFilter = useCallback((userName) => {
    if (!setFilteredUsers) return;
    setFilteredUsers((prev) =>
      prev.includes(userName) ? prev.filter((u) => u !== userName) : [...prev, userName]
    );
  }, [setFilteredUsers]);

  const handlePeonyHover = useCallback((rect) => {
    if (!rect) { setPeonyPopup(null); return; }
    const imgW = 120, imgH = 80;
    const x = Math.min(rect.left + rect.width / 2 - imgW / 2, window.innerWidth - imgW - 12);
    const y = rect.top - imgH - 14;
    setPeonyPopup({ x: Math.max(4, x), y: Math.max(4, y) });
  }, []);

  return (
    <>
    <div className={`user-list ${userListCollapsed ? "collapsed" : ""}`}>
      <div
        className="user-list-header"
        onClick={() => setUserListCollapsed(!userListCollapsed)}
      >
        在線：{visibleUsers.length} 人
        <span className="ul-gender-count" style={{ color: "#A7C7E7" }}>♂{maleCount}人</span>
        <span className="ul-gender-count" style={{ color: "#F8C8DC" }}>♀{femaleCount}人</span>
        <span className="ul-capacity-count">容量:{roomConfig.room_capacity ?? 100}人</span>
      </div>

      {!userListCollapsed &&
        visibleUsers.map((u) => {
          const isSelf = u.name === myName;
          const isAI = u.type === "AI";
          const canKick = myLevel >= ANL && u.level < myLevel && !isSelf && !!kickUser;
          const canBan = myLevel >= AML && u.level < myLevel && !isSelf && !!kickAndBlockUser;
          const showManage = !isSelf && !isAI;
          const avatarUrl = u.avatar || getAiAvatar(u.name);

          return (
            <UserRow
              key={u.name}
              name={u.name}
              level={u.level}
              gender={u.gender}
              type={u.type}
              avatarUrl={avatarUrl}
              goldenPeonies={u.golden_peonies}
              isSelf={isSelf}
              isTarget={u.name === target}
              isFiltered={filteredUsers.includes(u.name)}
              isMenuOpen={openMenu === u.name}
              canKick={canKick}
              canBan={canBan}
              showManage={showManage}
              hasRpsChallenge={!!onRpsChallenge}
              hasPingpongChallenge={!!onPingpongChallenge}
              hasSnowballThrow={!!onSnowballThrow}
              hasFilterToggle={!!setFilteredUsers}
              gamesBusy={gamesBusy}
              myLevel={myLevel}
              onRowClick={handleRowClick}
              onToggleMenu={handleToggleMenu}
              onRpsChallenge={onRpsChallenge}
              onPingpongChallenge={onPingpongChallenge}
              onSnowballThrow={onSnowballThrow}
              onToggleFilter={handleToggleFilter}
              onKickUser={kickUser}
              onMuteUser={muteUser}
              onKickAndBlockUser={kickAndBlockUser}
              onPeonyHover={handlePeonyHover}
            />
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

export default React.memo(UserList);
