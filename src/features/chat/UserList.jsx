// UserList.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAiAvatar } from "../../shared/aiConfig";
import "./UserList.css";
import { roomConfig } from "../../shared/roomConfig";
import { SNOWBALL_MIN_LEVEL, BOARD_URL } from "../../shared/constants";
import { getLevelTitleConfig, resolveLevelInfo } from "../../shared/levelTitles";

// 單一使用者列抽成獨立、模組層級的 memo 元件，且只吃基本型別 (string/number/boolean) 當 props。
// 忙碌房間裡 updateUsers 幾乎每次都會給一個全新的使用者陣列（就算內容沒變），
// 若整列吃「使用者物件」當 props，物件參照每次都不同，memo 形同虛設。
// 改吃基本型別後，即使外層陣列/物件參照改變，只要這個使用者實際顯示的值沒變，
// React.memo 的淺層比較就能正確跳過這一列的重新渲染。
const NO_LEVEL_INFO = { title: "", icon: "" };

// 「互動 → 留言」：到留言板查這位會員名下的板（新版會員板＋舊版同名/已連結的板，最主要的排第一），快取 1 分鐘
const BOARD_CACHE_MS = 60_000;
const boardCache = new Map(); // name → { at, boards }
async function fetchMemberBoards(name) {
  const hit = boardCache.get(name);
  if (hit && Date.now() - hit.at < BOARD_CACHE_MS) return hit.boards;
  const res = await fetch(`${BOARD_URL}/api/chat-boards?name=${encodeURIComponent(name)}`);
  const data = await res.json();
  const boards = Array.isArray(data?.boards) ? data.boards : [];
  boardCache.set(name, { at: Date.now(), boards });
  return boards;
}

// 選單打開時才去查（不是每個名單列都查）；查完直接渲染成連結，點了是使用者手勢開新分頁，不會被擋
function useMemberBoards(name, enabled) {
  const [state, setState] = useState({ name: null, boards: null });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetchMemberBoards(name)
      .then((boards) => alive && setState({ name, boards }))
      .catch(() => alive && setState({ name, boards: [] }));
    return () => { alive = false; };
  }, [name, enabled]);
  return state.name === name ? state.boards : null; // null = 查詢中
}

const UserRow = React.memo(function UserRow({
  name,
  level,
  levelTitle,
  levelIcon,
  customBadges,
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
  // 後台「等級稱謂」：不直接顯示在名字前，滑鼠移到頭像/等級圖案/暱稱上才用提示框顯示
  const titleTip = levelTitle ? `【${levelTitle}】${name}（Lv.${level}）` : undefined;
  // 留言板只有正式帳號會有（訪客、AI、系統假人都沒有）
  const canHaveBoard = type !== "guest" && type !== "virtual" && !isAI;
  const memberBoards = useMemberBoards(name, isMenuOpen && canHaveBoard);

  return (
    <div
      className={`user-item ${isTarget ? "selected" : ""}`}
      onClick={() => onRowClick(name)}
    >
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={name}
          className="user-avatar"
          loading="lazy"
          decoding="async"
          title={titleTip}
        />
      )}

      <span className="user-name" style={{ color }} title={titleTip}>
        {name}
      </span>
      {/* 金幣/櫻桃房有等級稱謂設定時：等級圖案用後台設定；其他房間維持原本固定的徽章 */}
      {customBadges && !isAI && type !== "guest" && levelIcon && (
        <span className="ul-cherry-badge" title={titleTip || `Lv.${level}`}>
          {levelIcon}
        </span>
      )}
      {!customBadges && !isAI && level >= SNOWBALL_MIN_LEVEL && level < ANL && (
        <span className="ul-premium-badge" title={titleTip || "高級會員"}>🎖️</span>
      )}
      {!customBadges && !isAI && level >= AML && (
        <span className="ul-owner-badge" title={titleTip || "大站長"}>👑</span>
      )}
      {!customBadges && !isAI && level === MINI_AML && level < AML && (
        <span className="ul-mini-owner-badge" title={titleTip || "小站長"}>🥈</span>
      )}
      {!customBadges && !isAI && level >= ANL && level < AML && level !== MINI_AML && (
        <span className="ul-admin-badge" title={titleTip || "管理員"}>🔱</span>
      )}
      &nbsp;
      {isAI ? "AI" : type === "guest" ? 1 : level}

      {roomConfig.open_peony && goldenPeonies > 0 && (
        <span
          className="ul-peony-badge"
          onMouseEnter={(e) => onPeonyHover(e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => onPeonyHover(null)}
        >
          <img src="/gifts/peony.gif" alt="金牡丹" className="ul-peony-icon" loading="lazy" decoding="async" />
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

              {canHaveBoard && memberBoards === null && (
                <button className="ul-admin-board" disabled onClick={(e) => e.stopPropagation()}>📝 留言…</button>
              )}
              {/* 點了直接開新視窗到她的留言板；名下有多個板時開最主要的那個（新版板 → 已連結舊板 → 最近有留言的同名舊板） */}
              {canHaveBoard && memberBoards?.length > 0 && (
                <a
                  className="ul-admin-board"
                  href={`${BOARD_URL}/b/${memberBoards[0].id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${memberBoards[0].title}（板號 ${memberBoards[0].id}）`}
                  onClick={(e) => { e.stopPropagation(); onToggleMenu(null); }}
                >
                  📝 留言
                </a>
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
  // eslint-disable-next-line no-unused-vars -- 後台改等級稱謂時由 ChatApp 遞增，讓 memo 過的名單重新算稱謂
  levelTitlesVersion = 0,
}) {
  const ANL = roomConfig.admin_min_level || 91;
  const AML = roomConfig.admin_max_level || 99;
  const OPENAI = roomConfig.openai;
  const customBadges = !!getLevelTitleConfig();
  const [openMenu, setOpenMenu] = React.useState(null);
  const [peonyPopup, setPeonyPopup] = React.useState(null); // { x, y }

  // 合併成一次迴圈：房間人數一多，updateUsers 幾乎每秒都會給一個新陣列參照，
  // 三次獨立 filter() 掃全表的成本就會跟著廣播頻率疊加起來。
  const { visibleUsers, maleCount, femaleCount } = useMemo(() => {
    const visible = [];
    let male = 0, female = 0;
    for (const u of userList) {
      if (!OPENAI && u.type === "AI") continue;
      visible.push(u);
      if (u.type !== "AI") {
        if (u.gender === "男") male++;
        else if (u.gender === "女") female++;
      }
    }
    return { visibleUsers: visible, maleCount: male, femaleCount: female };
  }, [userList, OPENAI]);

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
          const levelInfo = isAI ? NO_LEVEL_INFO : resolveLevelInfo(u.name, u.type === "guest" ? 0 : u.level);

          return (
            <UserRow
              key={u.name}
              name={u.name}
              level={u.level}
              levelTitle={levelInfo.title}
              levelIcon={levelInfo.icon}
              customBadges={customBadges}
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
