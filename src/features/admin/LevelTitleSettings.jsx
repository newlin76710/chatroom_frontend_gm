// LevelTitleSettings.jsx — 等級稱謂 / 等級圖案 / 進場歡迎 編輯器（LevelTitleEditor）。
// 由 LevelTitlePanel（🛡 管理 → 等級管理 →「🏷️ 等級稱謂/圖案管理」彈窗）負責讀寫。
//   等級區間：稱謂、等級圖案（在線名單顯示）、進場歡迎文字＋動畫（取代原本的進場歡呼）
//   個人專屬：按帳號指定稱謂/圖案/進場歡迎（優先於區間），給同級的高階/管理層分別設定，避免撞名
import { DEFAULT_CHERRY_LEVEL_TITLES, CHEER_WELCOME, WELCOME_STYLE_OPTIONS } from "../../shared/levelTitles";

const input = { padding: "5px 8px", border: "1px solid #ccc", borderRadius: 5, fontSize: 13, color: "#222", background: "#fff" };
const smallBtn = { padding: "3px 10px", border: "1px solid #bbb", borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 12, color: "#333" };
const note = { fontSize: 12, color: "#888" };
const rowBox = { display: "flex", flexDirection: "column", gap: 4, padding: "6px 0", borderBottom: "1px dashed #e5e5e5" };
const line = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };
const sectionTitle = { fontSize: 13, color: "#444", fontWeight: 600, marginTop: 6 };

function previewWelcome(template, title, icon, username, level) {
  return String(template || "")
    .replace(/\{title\}/g, () => title || `LV.${level}`)
    .replace(/\{icon\}/g, () => icon || "")
    .replace(/\{username\}/g, () => username)
    .replace(/\{level\}/g, () => String(level))
    .replace(/\s{2,}/g, " ")
    .trim();
}

// 歡迎文字＋動畫＋預覽（區間與個人專屬共用）
function WelcomeFields({ item, onChange, previewName, previewLevel, placeholder }) {
  const preview = item.welcome ? previewWelcome(item.welcome, item.title, item.icon, previewName, previewLevel) : "";
  const style = item.welcome_style || "plain";
  return (
    <>
      <div style={line}>
        <span style={{ fontSize: 12, color: "#666", minWidth: 56 }}>進場歡迎</span>
        <input type="text" maxLength={200} placeholder={placeholder}
          style={{ ...input, flex: 1, minWidth: 200 }}
          value={item.welcome || ""} onChange={(e) => onChange("welcome", e.target.value)} />
        <select style={{ ...input, padding: "4px 6px" }} value={style} title="進場歡迎的呈現動畫"
          onChange={(e) => onChange("welcome_style", e.target.value)} disabled={!item.welcome}>
          {WELCOME_STYLE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {!item.welcome && (
          <button type="button" style={smallBtn} onClick={() => onChange("welcome", CHEER_WELCOME)}>帶入範本</button>
        )}
      </div>
      {preview && (
        <div style={{ paddingLeft: 62 }}>
          {style === "plain" ? (
            <span style={note}>預覽：{preview}</span>
          ) : (
            <span className={`cherry-enter-banner cherry-enter-${style}`} style={{ fontSize: 12, padding: "3px 12px", animation: "none" }}>
              🎉 {preview} 🎉
            </span>
          )}
        </div>
      )}
    </>
  );
}

export function LevelTitleEditor({ settings, setSettings }) {
  const lt = settings.level_titles || { ranges: [], users: [], welcome_enabled: false };
  const ranges = lt.ranges || [];
  const users = lt.users || [];
  const setLT = (next) => setSettings((s) => ({
    ...s,
    level_titles: { ranges, users, welcome_enabled: !!lt.welcome_enabled, ...next },
  }));

  const updRange = (idx, key, val) => setLT({ ranges: ranges.map((r, i) => (i === idx ? { ...r, [key]: val } : r)) });
  const updUser = (idx, key, val) => setLT({ users: users.map((u, i) => (i === idx ? { ...u, [key]: val } : u)) });
  const num = (v) => (v === "" ? "" : Math.max(0, Math.floor(Number(v)) || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, color: "#222" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={!!lt.welcome_enabled} onChange={(e) => setLT({ welcome_enabled: e.target.checked })} />
        啟用進場歡迎（有填歡迎文字的區間或帳號進入大廳時，以選定的動畫全場顯示，取代一般的「進入聊天室」）
      </label>
      <span style={note}>
        歡迎文字可用變數：{"{title}"} 稱謂（沒有稱謂時顯示 LV.等級）、{"{icon}"} 等級圖案、{"{username}"} 暱稱、{"{level}"} 等級。留空＝不歡迎。
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
            <button type="button" style={smallBtn} onClick={() => setLT({ ranges: ranges.filter((_, i) => i !== idx) })}>✕</button>
          </div>
          <WelcomeFields
            item={r}
            onChange={(key, val) => updRange(idx, key, val)}
            previewName="小明"
            previewLevel={r.max || r.min}
            placeholder="留空＝不歡迎，例如：熱烈歡迎 {icon} {title} {username} 駕到！"
          />
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={smallBtn} onClick={() => {
          const last = ranges[ranges.length - 1];
          const lo = last ? Number(last.max) + 1 : 50;
          setLT({ ranges: [...ranges, { min: lo, max: lo + 9, title: "", icon: "", welcome: "", welcome_style: "plain" }] });
        }}>＋ 新增區間</button>
        <button type="button" style={smallBtn} onClick={() => {
          if (ranges.length && !window.confirm("要還原成預設稱謂/圖案/進場歡迎（櫻桃房原始設定），覆蓋目前的等級區間嗎？")) return;
          setLT({ ranges: DEFAULT_CHERRY_LEVEL_TITLES.ranges.map((r) => ({ ...r })), welcome_enabled: true });
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
          <WelcomeFields
            item={u}
            onChange={(key, val) => updUser(idx, key, val)}
            previewName={u.username || "小明"}
            previewLevel={99}
            placeholder="選填，留空沿用所在等級區間的進場歡迎"
          />
        </div>
      ))}
      <div>
        <button type="button" style={smallBtn} onClick={() => setLT({ users: [...users, { username: "", title: "", icon: "", welcome: "", welcome_style: "plain" }] })}>＋ 新增個人專屬</button>
      </div>
    </div>
  );
}
