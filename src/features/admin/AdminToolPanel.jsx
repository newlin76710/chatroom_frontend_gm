import { useState, useEffect } from "react";
import AdminLoginLogPanel from "./AdminLoginLogPanel";
import MessageLogPanel from "../chat/MessageLogPanel";
import AdminLevelPanel from "./AdminLevelPanel";
import AdminIPPanel from "./AdminIPPanel";
import AdminNicknamePanel from "./AdminNicknamePanel";
import AdminAdjustmentLogPanel from "./AdminAdjustmentLogPanel";
import AdminRoomSettingsPanel from "./AdminRoomSettingsPanel";
import "./AdminToolPanel.css";

import { roomConfig } from "../../shared/roomConfig";

export default function AdminToolPanel({ myName, myLevel, token, userList, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const [tab, setTab] = useState("login"); // default

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
        <div className={`admin-popup ${myLevel < (roomConfig.admin_max_level || 99) ? "small" : ""}`}>
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

            {myLevel >= (roomConfig.admin_max_level || 99) && (
              <button
                className={tab === "ip" ? "active" : ""}
                onClick={() => setTab("ip")}
              >
                IP 管制
              </button>
            )}
          </div>

          {/* Content */}
          <div className="admin-content">
            {tab === "roomsettings" && <AdminRoomSettingsPanel token={token} />}
            {tab === "login" && <AdminLoginLogPanel token={token} />}
            {tab === "message" && <MessageLogPanel myName={myName} myLevel={myLevel} token={token} userList={userList}/>}
            {tab === "level" && <AdminLevelPanel token={token} myLevel={myLevel} />}
            {tab === "ip" && <AdminIPPanel token={token} myLevel={myLevel} />}
            {tab === "adjustment" && <AdminAdjustmentLogPanel token={token} />}
            {tab === "nickname" && <AdminNicknamePanel myLevel={myLevel} token={token} myName={myName} />}
          </div>
        </div>
      )}
    </div>
  );
}
