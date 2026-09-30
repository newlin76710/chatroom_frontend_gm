// levelTitles.js — 金幣房／櫻桃房共用的「等級稱謂設定」（roomConfig.level_titles，在 🛡 管理 → 等級管理 →
// 🏷️ 等級稱謂/圖案管理 編輯）。格式、查詢規則跟後端 chatroom_backend/src/share/levelTitles.js 一致：
//   ranges：[{ min, max, title, icon, welcome, welcome_style }] 等級區間的稱謂／圖案／進場歡迎文字／進場歡迎動畫
//   users ：[{ username, title, icon, welcome, welcome_style }] 按帳號指定（優先於區間）
//   welcome_enabled：進場歡迎總開關（進場歡迎由後端廣播，前端 MessageList 依 welcome_style 顯示橫幅）
// 沒設定過時兩種房間的預設都是櫻桃房原始設定；這裡的 DEFAULT_CHERRY_LEVEL_TITLES 只給還沒拿到後端設定時當後備。
import { roomConfig } from "./roomConfig";

// 進場歡迎動畫：一般文字，或各色動畫橫幅（對應 MessageList.css 的 cherry-enter-*）
export const WELCOME_STYLE_OPTIONS = [
  { value: "plain", label: "一般文字" },
  { value: "angel", label: "橫幅・粉紅" },
  { value: "gold", label: "橫幅・金紅" },
  { value: "staff", label: "橫幅・紫藍" },
  { value: "boss", label: "橫幅・尊爵金" },
  { value: "member", label: "橫幅・一般" },
];

export const CHEER_WELCOME = "熱烈歡迎 {icon} {title} {username} 駕到！";
export const DEFAULT_WELCOME = "歡迎【{title}】{username} 尊榮降臨！";

export const DEFAULT_CHERRY_LEVEL_TITLES = {
  ranges: [
    { min: 99, max: 99, title: "總站長",     icon: "👑", welcome: DEFAULT_WELCOME, welcome_style: "boss" },
    { min: 98, max: 98, title: "副總站長",   icon: "💎", welcome: DEFAULT_WELCOME, welcome_style: "boss" },
    { min: 97, max: 97, title: "小站長",     icon: "🏆", welcome: DEFAULT_WELCOME, welcome_style: "boss" },
    { min: 96, max: 96, title: "指揮官",     icon: "🔱", welcome: DEFAULT_WELCOME, welcome_style: "staff" },
    { min: 91, max: 95, title: "書記官",     icon: "🔱", welcome: DEFAULT_WELCOME, welcome_style: "staff" },
    { min: 81, max: 90, title: "櫻桃金天使", icon: "⭐", welcome: CHEER_WELCOME,   welcome_style: "gold" },
    { min: 71, max: 80, title: "櫻桃大天使", icon: "🌺", welcome: CHEER_WELCOME,   welcome_style: "angel" },
    { min: 61, max: 70, title: "櫻桃小天使", icon: "🍒", welcome: CHEER_WELCOME,   welcome_style: "angel" },
    { min: 50, max: 60, title: "高級會員",   icon: "🎖️", welcome: "", welcome_style: "plain" },
    { min: 41, max: 49, title: "", icon: "🌸", welcome: "", welcome_style: "plain" },
    { min: 31, max: 40, title: "", icon: "🌷", welcome: "", welcome_style: "plain" },
    { min: 21, max: 30, title: "", icon: "🌼", welcome: "", welcome_style: "plain" },
    { min: 11, max: 20, title: "", icon: "🍀", welcome: "", welcome_style: "plain" },
    { min: 1,  max: 10, title: "", icon: "🌱", welcome: "", welcome_style: "plain" },
  ],
  users: [],
  welcome_enabled: true,
};

// 只有金幣房、櫻桃房開放等級稱謂
export function isTitleRoom(currencyName = roomConfig.currency_name) {
  const c = String(currencyName || "");
  return c === "金幣" || c.includes("櫻桃");
}

export function getLevelTitleConfig() {
  if (!isTitleRoom()) return null;
  const cfg = roomConfig.level_titles;
  const hasContent = cfg && ((cfg.ranges?.length || 0) + (cfg.users?.length || 0) > 0 || cfg.configured);
  // 還沒拿到後端設定（展示頁/舊版後端）時，金幣房、櫻桃房都用櫻桃房原始設定當預設（跟後端一致）
  return hasContent ? cfg : DEFAULT_CHERRY_LEVEL_TITLES;
}

export function hasLevelTitles() {
  const cfg = getLevelTitleConfig();
  return !!cfg && ((cfg.ranges?.length || 0) + (cfg.users?.length || 0)) > 0;
}

// 回傳 { title, icon }：帳號專屬的稱謂/圖案優先，沒填的欄位再用等級區間補
export function resolveLevelInfo(username, level) {
  const empty = { title: "", icon: "" };
  const cfg = getLevelTitleConfig();
  if (!cfg) return empty;
  const lv = Number(level);
  const range = Number.isFinite(lv) && lv > 0
    ? (cfg.ranges || []).find((x) => lv >= Number(x.min) && lv <= Number(x.max))
    : null;
  const lower = String(username || "").trim().toLowerCase();
  const user = lower
    ? (cfg.users || []).find((x) => String(x.username || "").trim().toLowerCase() === lower)
    : null;
  return {
    title: user?.title || range?.title || "",
    icon: user?.icon || range?.icon || "",
  };
}

export function resolveLevelTitle(username, level) {
  return resolveLevelInfo(username, level).title;
}
