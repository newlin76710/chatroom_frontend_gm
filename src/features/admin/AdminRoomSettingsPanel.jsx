import { useEffect, useState } from "react";

import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";

export default function AdminRoomSettingsPanel({ token }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND}/admin/settings?room=${RN}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => setSettings(data))
      .catch(() => alert("讀取設定失敗"));
  }, [token]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND}/admin/set-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...settings, room: RN }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "更新失敗"); return; }
      alert("更新成功！");
    } catch {
      alert("更新失敗");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div style={{ padding: 12, color: "#888" }}>讀取中…</div>;

  return (
    <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>房間中文名稱</span>
        <input
          type="text"
          value={settings.room_name || ""}
          onChange={e => setSettings(s => ({ ...s, room_name: e.target.value }))}
          style={{ flex: 1, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13 }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>開啟 AI 陪聊</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!settings.openai}
            onChange={e => setSettings(s => ({ ...s, openai: e.target.checked }))}
          />
          啟用
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>開放訪客登入</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={settings.openguest !== false}
            onChange={e => setSettings(s => ({ ...s, openguest: e.target.checked }))}
          />
          啟用
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>
          開啟{settings.currency_name === "金蘋果" ? "娛樂城" : "遊戲廳"}
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={settings.open_game !== false}
            onChange={e => setSettings(s => ({ ...s, open_game: e.target.checked }))}
          />
          啟用（推幣機/21點/輪盤/骰寶/老虎機/百家樂/賽車/殭屍生存戰/麻將/大老二/象棋）
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>聊天室顯示 IP</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={settings.show_ip !== false}
            onChange={e => setSettings(s => ({ ...s, show_ip: e.target.checked }))}
          />
          啟用
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>全訊息靠左顯示</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!settings.own_message_left}
            onChange={e => setSettings(s => ({ ...s, own_message_left: e.target.checked }))}
          />
          啟用
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>舊版聊天介面</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!settings.legacy_chat_ui}
            onChange={e => setSettings(s => ({ ...s, legacy_chat_ui: e.target.checked }))}
          />
          啟用（所有人使用舊版聊天操作列）
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>開啟隱形</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={settings.invisible_mode_enabled !== false}
            onChange={e => setSettings(s => ({ ...s, invisible_mode_enabled: e.target.checked }))}
          />
          啟用（99 級登入時可選擇本次是否隱形；關閉後 99 級一律正常登入）
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>可監看密語</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={settings.monitor_private_enabled !== false}
            onChange={e => setSettings(s => ({ ...s, monitor_private_enabled: e.target.checked }))}
          />
          啟用（99 級可看到所有人的密語；關閉後 99 級也看不到別人的密語）
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>發言間隔秒數</span>
        <input
          type="number"
          min={0}
          max={60}
          value={settings.message_cooldown_seconds ?? 1}
          onChange={e => setSettings(s => ({ ...s, message_cooldown_seconds: Number(e.target.value) }))}
          style={{ width: 70, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13 }}
        />
        <span style={{ fontSize: 12, color: "#888" }}>秒（0-60，發送訊息後需等待的秒數）</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>暱稱長度上限</span>
        <input
          type="number"
          min={1}
          max={50}
          value={settings.nickname_max_length ?? 10}
          onChange={e => setSettings(s => ({ ...s, nickname_max_length: Number(e.target.value) }))}
          style={{ width: 70, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13 }}
        />
        <span style={{ fontSize: 12, color: "#888" }}>
          （中文長度，中文最多 {Number(settings.nickname_max_length) || 10} 個字，英數字最多 {(Number(settings.nickname_max_length) || 10) * 2} 個字）
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>小站長等級門檻</span>
        <input
          type="number"
          min={roomConfig.admin_min_level || 91}
          max={roomConfig.admin_max_level || 99}
          value={settings.mini_admin_level ?? 98}
          onChange={e => setSettings(s => ({ ...s, mini_admin_level: Number(e.target.value) }))}
          style={{ width: 70, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13 }}
        />
        <span style={{ fontSize: 12, color: "#888" }}>
          （{roomConfig.admin_min_level || 91}-{roomConfig.admin_max_level || 99}，達此等級可設定遊戲/經濟類項目，但不可調整他人等級/金幣、不可更改聊天室設定、看不到發言紀錄）
        </span>
      </div>
      {settings.currency_name === "金蘋果" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>開啟金牡丹</span>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!settings.open_peony}
              onChange={e => setSettings(s => ({ ...s, open_peony: e.target.checked }))}
            />
            啟用
          </label>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>煙火冷卻分鐘數</span>
        <input
          type="number"
          min={0}
          value={settings.firework_cooldown_minutes ?? 0}
          onChange={e => setSettings(s => ({ ...s, firework_cooldown_minutes: Number(e.target.value) }))}
          style={{ width: 70, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13 }}
        />
        <span style={{ fontSize: 12, color: "#888" }}>分鐘（同一 IP 施放一次後要等幾分鐘才能再放；0 = 不限制）</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>雪球冷卻分鐘數</span>
        <input
          type="number"
          min={0}
          value={settings.snowball_cooldown_minutes ?? 10}
          onChange={e => setSettings(s => ({ ...s, snowball_cooldown_minutes: Number(e.target.value) }))}
          style={{ width: 70, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13 }}
        />
        <span style={{ fontSize: 12, color: "#888" }}>分鐘（50 級以上互動「丟雪球」，同一使用者丟出後要等幾分鐘才能再丟；0 = 不限制）</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>不開放跳板IP</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!settings.block_proxy_ip}
            onChange={e => setSettings(s => ({ ...s, block_proxy_ip: e.target.checked }))}
          />
          啟用（偵測到跳板/VPN IP 一律拒絕訪客與帳號登入）
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>不開放新會員</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!settings.block_new_accounts}
            onChange={e => setSettings(s => ({ ...s, block_new_accounts: e.target.checked }))}
          />
          啟用
        </label>
        <input
          type="number"
          min={1}
          max={365}
          value={settings.new_account_block_days ?? 7}
          onChange={e => setSettings(s => ({ ...s, new_account_block_days: Number(e.target.value) }))}
          disabled={!settings.block_new_accounts}
          style={{ width: 60, padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13 }}
        />
        <span style={{ fontSize: 12, color: "#888" }}>天內註冊的帳號無法登入（僅限帳號登入，不影響訪客）</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 110, fontSize: 13, color: "#444", flexShrink: 0 }}>相同IP可贈送</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={!!settings.same_ip_gift}
            onChange={e => setSettings(s => ({ ...s, same_ip_gift: e.target.checked }))}
          />
          相同IP可互送{roomConfig.currency_name}與禮物
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{
          alignSelf: "flex-start", padding: "6px 18px",
          background: "#1976d2", color: "#fff", border: "none",
          borderRadius: 6, cursor: "pointer", fontSize: 13,
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? "儲存中…" : "儲存"}
      </button>
    </div>
  );
}
