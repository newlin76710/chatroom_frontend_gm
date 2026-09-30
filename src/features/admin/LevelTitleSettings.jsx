// LevelTitleSettings.jsx — 等級稱謂 / 等級圖案 / 進場歡呼 / 進場歡迎詞 編輯器（LevelTitleEditor）。
// 由 LevelTitlePanel（🛡 管理 → 等級管理 →「🏷️ 等級稱謂/圖案管理」彈窗）負責讀寫。
// 只有金幣房、櫻桃房開放；還沒設定過時，後端會帶出櫻桃房原始的預設稱謂/圖案/歡迎詞，管理者可以直接改。
//   等級區間：稱謂、等級圖案（在線名單顯示）、進場歡呼（是否歡呼＋配色）、進場歡迎詞
//   個人專屬：按帳號指定稱謂/圖案/歡迎詞（優先於區間），給同級的高階/管理層分別取不同稱謂，避免撞名
import { TONE_OPTIONS, DEFAULT_CHERRY_LEVEL_TITLES, DEFAULT_WELCOME, WELCOME_STYLE_OPTIONS } from "../../shared/levelTitles";

const input = { padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13, color: "#222", background: "#fff" };
const smallBtn = { padding: "3px 10px", border: "1px solid #bbb", borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 12, color: "#333" };
const note = { fontSize: 12, color: "#888" };
const rowBox = { display: "flex", flexDirection: "column", gap: 4, padding: "6px 0", borderBottom: "1px dashed #e5e5e5" };
const line = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };
const sectionTitle = { fontSize: 13, color: "#444", fontWeight: 600, marginTop: 6 };

function previewWelcome(template, title, username, level) {
  return String(template || "")
    .replace(/\{title\}/g, () => title || `LV.${level}`)
    .replace(/\{username\}/g, () => username)
    .replace(/\{level\}/g, () => String(level));
}

export function LevelTitleEditor({ settings, setSettings }) {
  const lt = settings.level_titles || { ranges: [], users: [], cheer_enabled: false, welcome_enabled: false };
  const ranges = lt.ranges || [];
  const users = lt.users || [];
  const setLT = (next) => setSettings((s) => ({
    ...s,
    level_titles: {
      ranges, users,
      cheer_enabled: !!lt.cheer_enabled,
      welcome_enabled: !!lt.welcome_enabled,
      ...next,
    },
  }));

  const updRange = (idx, key, val) => setLT({ ranges: ranges.map((r, i) => (i === idx ? { ...r, [key]: val } : r)) });
  const updUser = (idx, key, val) => setLT({ users: users.map((u, i) => (i === idx ? { ...u, [key]: val } : u)) });
  const num = (v) => (v === "" ? "" : Math.max(0, Math.floor(Number(v)) || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, color: "#222" }}>
      <span style={note}>
        僅金幣房、櫻桃房開放，還沒設定過時預設使用櫻桃房原始的稱謂/圖案。等級圖案顯示在在線名單；
        滑鼠移到頭像、圖案或暱稱上會以提示框顯示【稱謂】。區間由上往下比對，第一個符合的生效；
        稱謂、圖案、歡迎詞都留空的區間不會存。
      </span>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={!!lt.cheer_enabled} onChange={(e) => setLT({ cheer_enabled: e.target.checked })} />
        啟用進場歡呼（有勾「歡呼」的區間、或有個人專屬稱謂的玩家進場時，聊天室顯示「熱烈歡迎 ○○ 駕到！」橫幅）
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={!!lt.welcome_enabled} onChange={(e) => setLT({ welcome_enabled: e.target.checked })} />
        啟用進場歡迎詞（有填歡迎詞的區間或帳號進入大廳時，全場聊天室自動廣播）
      </label>
      <span style={note}>
        歡迎詞可用變數：{"{title}"} 等級稱謂（沒有稱謂時顯示 LV.等級）、{"{username}"} 暱稱、{"{level}"} 等級。留空＝這個區間不廣播。
        歡迎詞旁可選呈現動畫：一般文字，或粉紅／金紅／紫藍／尊爵金／一般配色的動畫橫幅。
      </span>

      <div style={sectionTitle}>等級區間</div>
      {ranges.map((r, idx) => (
        <div key={idx} style={rowBox}>
          <div style={line}>
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
          <div style={line}>
            <span style={{ fontSize: 12, color: "#666", minWidth: 44 }}>歡迎詞</span>
            <input type="text" maxLength={200} placeholder="留空＝不廣播，例如：歡迎【{title}】{username} 尊榮降臨！"
              style={{ ...input, flex: 1, minWidth: 200 }}
              value={r.welcome || ""} onChange={(e) => updRange(idx, "welcome", e.target.value)} />
            <select style={{ ...input, padding: "4px 6px" }} value={r.welcome_style || "plain"} title="歡迎詞的呈現動畫"
              onChange={(e) => updRange(idx, "welcome_style", e.target.value)} disabled={!r.welcome}>
              {WELCOME_STYLE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {!r.welcome && (
              <button type="button" style={smallBtn} onClick={() => updRange(idx, "welcome", DEFAULT_WELCOME)}>帶入範本</button>
            )}
          </div>
          {r.welcome && (
            <span style={{ ...note, paddingLeft: 50 }}>預覽：👑 {previewWelcome(r.welcome, r.title, "小明", r.max || r.min)}</span>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={smallBtn} onClick={() => {
          const last = ranges[ranges.length - 1];
          const lo = last ? Number(last.max) + 1 : 50;
          setLT({ ranges: [...ranges, { min: lo, max: lo + 9, title: "", icon: "", tone: "gold", cheer: false, welcome: "", welcome_style: "plain" }] });
        }}>＋ 新增區間</button>
        <button type="button" style={smallBtn} onClick={() => {
          if (ranges.length && !window.confirm("要還原成預設稱謂/圖案/歡迎詞（櫻桃房原始設定），覆蓋目前的等級區間嗎？")) return;
          setLT({ ranges: DEFAULT_CHERRY_LEVEL_TITLES.ranges.map((r) => ({ ...r })), cheer_enabled: true });
        }}>還原預設（櫻桃房原始設定）</button>
      </div>

      <div style={sectionTitle}>個人專屬（按帳號，優先於區間；適合 98~99 級高階/管理層）</div>
      {users.map((u, idx) => (
        <div key={idx} style={rowBox}>
          <div style={line}>
            <input type="text" placeholder="帳號（暱稱）" style={{ ...input, width: 120 }}
              value={u.username || ""} onChange={(e) => updUser(idx, "username", e.target.value)} />
            <span>→</span>
            <input type="text" maxLength={8} placeholder="圖案" title="專屬等級圖案（選填，留空沿用區間圖案）" style={{ ...input, width: 52, textAlign: "center" }}
              value={u.icon || ""} onChange={(e) => updUser(idx, "icon", e.target.value)} />
            <input type="text" maxLength={12} placeholder="例如：星夜大總管" style={{ ...input, flex: 1, minWidth: 110 }}
              value={u.title || ""} onChange={(e) => updUser(idx, "title", e.target.value)} />
            <button type="button" style={smallBtn} onClick={() => setLT({ users: users.filter((_, i) => i !== idx) })}>✕</button>
          </div>
          <div style={line}>
            <span style={{ fontSize: 12, color: "#666", minWidth: 44 }}>歡迎詞</span>
            <input type="text" maxLength={200} placeholder="選填，留空沿用所在等級區間的歡迎詞"
              style={{ ...input, flex: 1, minWidth: 200 }}
              value={u.welcome || ""} onChange={(e) => updUser(idx, "welcome", e.target.value)} />
            <select style={{ ...input, padding: "4px 6px" }} value={u.welcome_style || "plain"} title="歡迎詞的呈現動畫"
              onChange={(e) => updUser(idx, "welcome_style", e.target.value)} disabled={!u.welcome}>
              {WELCOME_STYLE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {u.welcome && (
            <span style={{ ...note, paddingLeft: 50 }}>預覽：👑 {previewWelcome(u.welcome, u.title, u.username || "小明", 99)}</span>
          )}
        </div>
      ))}
      <div>
        <button type="button" style={smallBtn} onClick={() => setLT({ users: [...users, { username: "", title: "", icon: "", welcome: "", welcome_style: "plain" }] })}>＋ 新增個人專屬</button>
      </div>
    </div>
  );
}
