// LevelTitleSettings.jsx — 等級稱謂/圖案/進場歡呼編輯器（LevelTitleEditor，放在「🛡 管理 → 等級管理 →
// 等級稱謂/圖案」子分頁，由 LevelTitlePanel 負責讀寫）+ 高階玩家進場歡迎詞（預設匯出 VipWelcomeSettings，
// 放在「🛡 管理 → 房間設定」，跟房間設定同一顆儲存鈕）。
// 等級稱謂只有金幣房、櫻桃房開放；還沒設定過時，後端會帶出櫻桃房原始的預設稱謂/圖案，管理者可以直接改。
//   等級區間：稱謂、等級圖案（在線名單顯示）、進場歡呼配色、該區間進場要不要歡呼
//   個人專屬：按帳號指定稱謂/圖案（優先於區間），給同級的高階/管理層分別取不同稱謂，避免撞名
import { roomConfig } from "../../shared/roomConfig";
import { TONE_OPTIONS, DEFAULT_CHERRY_LEVEL_TITLES } from "../../shared/levelTitles";

const box = { border: "1px solid #e0e0e0", borderRadius: 8, padding: "10px 12px", background: "#fafafa", display: "flex", flexDirection: "column", gap: 8 };
const input = { padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13, color: "#222", background: "#fff" };
const smallBtn = { padding: "3px 10px", border: "1px solid #bbb", borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 12, color: "#333" };
const note = { fontSize: 12, color: "#888" };

// 金幣房第一次設定時的建議區間：50~97 每 10 級一區 + 98~99（稱謂、圖案留空的區間存檔時會被略過）
function coinStarterRanges() {
  const out = [];
  for (let lo = 50; lo <= 90; lo += 10) out.push({ min: lo, max: Math.min(lo + 9, 97), title: "", icon: "", tone: "gold", cheer: lo >= 60 });
  out.push({ min: 98, max: 99, title: "", icon: "👑", tone: "boss", cheer: true });
  return out;
}

export function LevelTitleEditor({ settings, setSettings }) {
  const lt = settings.level_titles || { ranges: [], users: [], cheer_enabled: false };
  const ranges = lt.ranges || [];
  const users = lt.users || [];
  const setLT = (next) => setSettings((s) => ({
    ...s,
    level_titles: { ranges, users, cheer_enabled: !!lt.cheer_enabled, ...next },
  }));

  const updRange = (idx, key, val) => setLT({ ranges: ranges.map((r, i) => (i === idx ? { ...r, [key]: val } : r)) });
  const updUser = (idx, key, val) => setLT({ users: users.map((u, i) => (i === idx ? { ...u, [key]: val } : u)) });
  const num = (v) => (v === "" ? "" : Math.max(0, Math.floor(Number(v)) || 0));

  return (
      <div style={box}>
        <strong style={{ fontSize: 14, color: "#333" }}>🏷️ 等級稱謂 / 等級圖案 / 進場歡呼</strong>
        <span style={note}>
          僅金幣房、櫻桃房開放，還沒設定過時預設使用櫻桃房原始的稱謂/圖案。等級圖案顯示在在線名單；滑鼠移到頭像、圖案或暱稱上會以提示框顯示【稱謂】。
          區間由上往下比對，第一個符合的生效；稱謂與圖案都留空的區間不會存。
        </span>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={!!lt.cheer_enabled} onChange={(e) => setLT({ cheer_enabled: e.target.checked })} />
          啟用進場歡呼（有勾「歡呼」的區間、或有個人專屬稱謂的玩家進場時，聊天室顯示「熱烈歡迎 ○○ 駕到！」橫幅）
        </label>

        <div style={{ fontSize: 13, color: "#444", fontWeight: 600 }}>等級區間</div>
        {ranges.map((r, idx) => (
          <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", paddingBottom: 4, borderBottom: "1px dashed #e5e5e5" }}>
            <input type="number" min={1} style={{ ...input, width: 58 }} value={r.min} onChange={(e) => updRange(idx, "min", num(e.target.value))} />
            <span>~</span>
            <input type="number" min={1} style={{ ...input, width: 58 }} value={r.max} onChange={(e) => updRange(idx, "max", num(e.target.value))} />
            <span>級</span>
            <input type="text" maxLength={8} placeholder="圖案" title="等級圖案（表情符號，例如 👑 🔱 🍒）" style={{ ...input, width: 52, textAlign: "center" }}
              value={r.icon || ""} onChange={(e) => updRange(idx, "icon", e.target.value)} />
            <input type="text" maxLength={12} placeholder="稱謂（最多 12 字）" style={{ ...input, flex: 1, minWidth: 110 }}
              value={r.title || ""} onChange={(e) => updRange(idx, "title", e.target.value)} />
            <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, cursor: "pointer" }} title="這個區間的玩家進場時要不要顯示歡呼橫幅">
              <input type="checkbox" checked={!!r.cheer} onChange={(e) => updRange(idx, "cheer", e.target.checked)} />歡呼
            </label>
            <select style={{ ...input, padding: "4px 6px" }} value={r.tone || "gold"} title="進場歡呼橫幅配色"
              onChange={(e) => updRange(idx, "tone", e.target.value)} disabled={!r.cheer}>
              {TONE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button type="button" style={smallBtn} onClick={() => setLT({ ranges: ranges.filter((_, i) => i !== idx) })}>✕</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" style={smallBtn} onClick={() => {
            const last = ranges[ranges.length - 1];
            const lo = last ? Number(last.max) + 1 : 50;
            setLT({ ranges: [...ranges, { min: lo, max: lo + 9, title: "", icon: "", tone: "gold", cheer: false }] });
          }}>＋ 新增區間</button>
          {ranges.length === 0 && (
            <button type="button" style={smallBtn} onClick={() => setLT({ ranges: coinStarterRanges(), cheer_enabled: true })}>
              帶入 50~97 每 10 級一區 + 98~99
            </button>
          )}
          <button type="button" style={smallBtn} onClick={() => {
            if (ranges.length && !window.confirm("要還原成預設稱謂/圖案，覆蓋目前的等級區間嗎？")) return;
            setLT({ ranges: DEFAULT_CHERRY_LEVEL_TITLES.ranges.map((r) => ({ ...r })), cheer_enabled: true });
          }}>還原預設</button>
        </div>

        <div style={{ fontSize: 13, color: "#444", fontWeight: 600, marginTop: 6 }}>個人專屬稱謂（按帳號，優先於區間；適合 98~99 級高階/管理層）</div>
        {users.map((u, idx) => (
          <div key={idx} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input type="text" placeholder="帳號（暱稱）" style={{ ...input, width: 120 }}
              value={u.username || ""} onChange={(e) => updUser(idx, "username", e.target.value)} />
            <span>→</span>
            <input type="text" maxLength={8} placeholder="圖案" title="專屬等級圖案（選填，留空沿用區間圖案）" style={{ ...input, width: 52, textAlign: "center" }}
              value={u.icon || ""} onChange={(e) => updUser(idx, "icon", e.target.value)} />
            <input type="text" maxLength={12} placeholder="例如：星夜大總管" style={{ ...input, flex: 1, minWidth: 110 }}
              value={u.title || ""} onChange={(e) => updUser(idx, "title", e.target.value)} />
            <button type="button" style={smallBtn} onClick={() => setLT({ users: users.filter((_, i) => i !== idx) })}>✕</button>
          </div>
        ))}
        <div>
          <button type="button" style={smallBtn} onClick={() => setLT({ users: [...users, { username: "", title: "", icon: "" }] })}>＋ 新增個人稱謂</button>
        </div>
      </div>
  );
}

// 高階玩家進場歡迎詞（放在「🛡 管理 → 房間設定」，所有房間都可用）
export default function VipWelcomeSettings({ settings, setSettings }) {
  const num = (v) => (v === "" ? "" : Math.max(0, Math.floor(Number(v)) || 0));
  const AML = roomConfig.admin_max_level || 99;
  const template = settings.vip_welcome_template ?? "歡迎【{title}】{username} 尊榮降臨！";
  const preview = template
    .replace(/\{title\}/g, () => "星夜大總管")
    .replace(/\{username\}/g, () => "小明")
    .replace(/\{level\}/g, () => String(AML));

  return (
      <div style={box}>
        <strong style={{ fontSize: 14, color: "#333" }}>👑 高階玩家進場歡迎詞</strong>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={!!settings.vip_welcome_enabled}
            onChange={(e) => setSettings((s) => ({ ...s, vip_welcome_enabled: e.target.checked }))} />
          啟用（等級達門檻的玩家進入大廳時，全場聊天室自動廣播）
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#444" }}>門檻等級</span>
          <input type="number" min={1} style={{ ...input, width: 70 }} value={settings.vip_welcome_level ?? 91}
            onChange={(e) => setSettings((s) => ({ ...s, vip_welcome_level: num(e.target.value) }))} />
          <span style={note}>級（含）以上</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#444" }}>歡迎詞</span>
          <input type="text" maxLength={200} style={{ ...input, flex: 1, minWidth: 200 }} value={template}
            onChange={(e) => setSettings((s) => ({ ...s, vip_welcome_template: e.target.value }))} />
        </div>
        <span style={note}>
          可用變數：{"{title}"} 等級稱謂（沒設定時顯示 LV.等級）、{"{username}"} 暱稱、{"{level}"} 等級。預覽：👑 {preview}
        </span>
      </div>
  );
}
