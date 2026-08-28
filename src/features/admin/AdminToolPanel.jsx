import { useState, useEffect, useRef } from "react";
import AdminLoginLogPanel from "./AdminLoginLogPanel";
import MessageLogPanel from "../chat/MessageLogPanel";
import AdminLevelPanel from "./AdminLevelPanel";
import AdminIPPanel from "./AdminIPPanel";
import AdminOnlineIPPanel from "./AdminOnlineIPPanel";
import AdminNicknamePanel from "./AdminNicknamePanel";
import AdminAdjustmentLogPanel from "./AdminAdjustmentLogPanel";
import AdminRoomSettingsPanel from "./AdminRoomSettingsPanel";
import "./AdminToolPanel.css";

import { roomConfig } from "../../shared/roomConfig";

export default function AdminToolPanel({ myName, myLevel, token, userList, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  const [tab, setTab] = useState("login"); // default

  // ─── 可自由拖曳（不受聊天輸入區位置限制） ───────────────────────────────
  const popupRef = useRef(null);
  const pos = useRef({ x: 20, y: 80, offsetX: 0, offsetY: 0, dragging: false });

  const onDragMouseDown = (e) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    pos.current.dragging = true;
    pos.current.offsetX = e.clientX - pos.current.x;
    pos.current.offsetY = e.clientY - pos.current.y;
    document.addEventListener("mousemove", onDragMouseMove);
    document.addEventListener("mouseup", onDragMouseUp);
  };
  const onDragMouseMove = (e) => {
    if (!pos.current.dragging) return;
    e.preventDefault();
    pos.current.x = e.clientX - pos.current.offsetX;
    pos.current.y = e.clientY - pos.current.offsetY;
    if (popupRef.current) {
      popupRef.current.style.left = pos.current.x + "px";
      popupRef.current.style.top = pos.current.y + "px";
    }
  };
  const onDragMouseUp = () => {
    pos.current.dragging = false;
    document.removeEventListener("mousemove", onDragMouseMove);
    document.removeEventListener("mouseup", onDragMouseUp);
  };

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
        <div
          ref={popupRef}
          className={`admin-popup ${myLevel < (roomConfig.admin_max_level || 99) ? "small" : ""}`}
          style={{ left: pos.current.x, top: pos.current.y }}
        >
          <div className="admin-popup-header" onMouseDown={onDragMouseDown}>
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
            {tab === "level" && <AdminLevelPanel token={token} myLevel={myLevel} />}
            {tab === "ip" && <AdminIPPanel token={token} myLevel={myLevel} />}
            {tab === "onlineip" && <AdminOnlineIPPanel token={token} myLevel={myLevel} />}
            {tab === "adjustment" && <AdminAdjustmentLogPanel token={token} />}
            {tab === "nickname" && <AdminNicknamePanel myLevel={myLevel} token={token} myName={myName} />}
          </div>
        </div>
      )}
    </div>
  );
}
