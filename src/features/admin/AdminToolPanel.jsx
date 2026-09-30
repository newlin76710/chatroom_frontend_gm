import { useState, useEffect } from "react";
import useDraggable from "../../shared/hooks/useDraggable";
import FloatingPortal from "../../shared/FloatingPortal";
import AdminLoginLogPanel from "./AdminLoginLogPanel";
import MessageLogPanel from "../chat/MessageLogPanel";
import AdminLevelPanel from "./AdminLevelPanel";
import AdminIPPanel from "./AdminIPPanel";
import AdminOnlineIPPanel from "./AdminOnlineIPPanel";
import AdminNicknamePanel from "./AdminNicknamePanel";
import AdminAdjustmentLogPanel from "./AdminAdjustmentLogPanel";
import AdminFishingLogPanel from "./AdminFishingLogPanel";
import AdminGiftCommissionLogPanel from "./AdminGiftCommissionLogPanel";
import AdminFishingShotLogPanel from "./AdminFishingShotLogPanel";
import AdminFishingPoolLogPanel from "./AdminFishingPoolLogPanel";
import AdminBaitBlacklistPanel from "./AdminBaitBlacklistPanel";
import AdminRoomSettingsPanel from "./AdminRoomSettingsPanel";
import LevelTitlePanel from "./LevelTitlePanel";
import { isTitleRoom } from "../../shared/levelTitles";
import "./AdminToolPanel.css";

import { roomConfig } from "../../shared/roomConfig";

export default function AdminToolPanel({ myName, myLevel, token, userList, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const [tab, setTab] = useState("login"); // default
  const [levelSubTab, setLevelSubTab] = useState("users"); // 等級管理子分頁：users | titles

  // ─── 可自由拖曳（滑鼠 + 手機/平板觸控，不受聊天輸入區位置限制） ───────────
  const { panelRef, handleProps, initialStyle } = useDraggable({ x: 20, y: 80 });

  // ⭐ 用 useEffect 在 mount 或 myLevel 改變時設定初始 tab
  useEffect(() => {
    if (myLevel >= (roomConfig.admin_min_level || 91) && myLevel < (roomConfig.admin_max_level || 99)) {
      setTab("nickname");
    } else if (myLevel >= (roomConfig.admin_max_level || 99)) {
      setTab("login");
    }
  }, [myLevel]);

  if (myLevel < (roomConfig.admin_min_level || 91)) return null;

  return (
    <div className="admin-tool">
      <button className="admin-btn" onClick={() => setOpen(o => !o)}>
        🛡 管理
      </button>

      {open && (
        <FloatingPortal className="admin-tool" onBackdropClick={() => setOpen(false)}>
        <div
          ref={panelRef}
          className={`admin-popup ${myLevel < (roomConfig.admin_max_level || 99) ? "small" : ""}`}
          style={initialStyle}
        >
          <div className="admin-popup-header" {...handleProps}>
            🛡 管理面板
            <button onClick={() => setOpen(false)}>✖</button>
          </div>
          {/* Tabs */}
          <div className="admin-tabs">
            {myLevel >= (roomConfig.admin_max_level || 99) && (
              <>
                <button
                  className={tab === "roomsettings" ? "active" : ""}
                  onClick={() => setTab("roomsettings")}
                >
                  房間設定
                </button>
                <button
                  className={tab === "login" ? "active" : ""}
                  onClick={() => setTab("login")}
                >
                  登入紀錄
                </button>
                <button
                  className={tab === "message" ? "active" : ""}
                  onClick={() => setTab("message")}
                >
                  發言紀錄
                </button>
                <button
                  className={tab === "level" ? "active" : ""}
                  onClick={() => setTab("level")}
                >
                  等級管理
                </button>
                <button
                  className={tab === "adjustment" ? "active" : ""}
                  onClick={() => setTab("adjustment")}
                >
                  調整紀錄
                </button>
                {roomConfig.currency_name === "金幣" && (
                  <button
                    className={tab === "fishing" ? "active" : ""}
                    onClick={() => setTab("fishing")}
                  >
                    捕魚紀錄
                  </button>
                )}
              </>
            )}

            {myLevel >= (roomConfig.admin_min_level || 91) && (
              <button
                className={tab === "nickname" ? "active" : ""}
                onClick={() => setTab("nickname")}
              >
                暱稱管理
              </button>
            )}

            {myLevel >= (roomConfig.admin_min_level || 91) && (
              <button
                className={tab === "ip" ? "active" : ""}
                onClick={() => setTab("ip")}
              >
                IP 管制
              </button>
            )}

            {myLevel >= (roomConfig.mini_admin_level || 98) && (
              <button
                className={tab === "onlineip" ? "active" : ""}
                onClick={() => setTab("onlineip")}
              >
                線上 IP
              </button>
            )}
          </div>

          {/* Content */}
          <div className="admin-content">
            {tab === "roomsettings" && <AdminRoomSettingsPanel token={token} />}
            {tab === "login" && <AdminLoginLogPanel token={token} />}
            {tab === "message" && <MessageLogPanel myName={myName} myLevel={myLevel} token={token} userList={userList}/>}
            {tab === "level" && (
              <>
                {/* 等級稱謂/圖案只開放金幣房、櫻桃房 */}
                {isTitleRoom() && (
                  <div className="admin-subtabs">
                    <button className={levelSubTab === "users" ? "active" : ""} onClick={() => setLevelSubTab("users")}>使用者等級</button>
                    <button className={levelSubTab === "titles" ? "active" : ""} onClick={() => setLevelSubTab("titles")}>等級稱謂/圖案</button>
                  </div>
                )}
                {(levelSubTab === "users" || !isTitleRoom()) && <AdminLevelPanel token={token} myLevel={myLevel} />}
                {levelSubTab === "titles" && isTitleRoom() && <LevelTitlePanel token={token} />}
              </>
            )}
            {tab === "ip" && <AdminIPPanel token={token} myLevel={myLevel} />}
            {tab === "onlineip" && <AdminOnlineIPPanel token={token} myLevel={myLevel} />}
            {tab === "adjustment" && <AdminAdjustmentLogPanel token={token} />}
            {tab === "fishing" && (
              <>
                <AdminFishingShotLogPanel token={token} />
                <AdminFishingLogPanel token={token} />
                <AdminFishingPoolLogPanel token={token} />
                <AdminGiftCommissionLogPanel token={token} />
                <AdminBaitBlacklistPanel token={token} />
              </>
            )}
            {tab === "nickname" && <AdminNicknamePanel myLevel={myLevel} token={token} myName={myName} />}
          </div>
        </div>
        </FloatingPortal>
      )}
    </div>
  );
}
