// levelTitles.js — 金幣房／櫻桃房共用的「等級稱謂設定」（roomConfig.level_titles，在 🛡 管理 → 房間設定 裡編輯）
// 格式、查詢規則跟後端 chatroom_backend/src/share/levelTitles.js 一致：
//   ranges：[{ min, max, title, icon, tone, cheer }] 等級區間的稱謂／等級圖案／進場歡呼配色／該區間進場是否歡呼
//   users ：[{ username, title, icon }] 按帳號指定專屬稱謂／圖案（優先於區間）
//   cheer_enabled：進場歡呼橫幅總開關
// 後端 /api/room-config 回傳的已經是「實際生效」的設定（櫻桃房沒設定過會帶預設表）；
// 沒設定過時兩種房間的預設都是櫻桃房原始設定；這裡的 DEFAULT_CHERRY_LEVEL_TITLES 只給還沒拿到後端設定時當後備。
import { roomConfig } from "./roomConfig";

export const TONE_OPTIONS = [
  { value: "angel", label: "粉紅" },
  { value: "gold", label: "金紅" },
  { value: "staff", label: "紫藍" },
  { value: "boss", label: "尊爵金" },
  { value: "member", label: "一般" },
];

export const DEFAULT_CHERRY_LEVEL_TITLES = {
  ranges: [
    { min: 99, max: 99, title: "總站長", icon: "👑", tone: "boss", cheer: true },
    { min: 98, max: 98, title: "副總站長", icon: "💎", tone: "boss", cheer: true },
    { min: 97, max: 97, title: "小站長", icon: "🏆", tone: "boss", cheer: true },
    { min: 96, max: 96, title: "指揮官", icon: "🔱", tone: "staff", cheer: true },
    { min: 91, max: 95, title: "書記官", icon: "🔱", tone: "staff", cheer: true },
    { min: 81, max: 90, title: "金天使", icon: "⭐", tone: "gold", cheer: true },
    { min: 71, max: 80, title: "大天使", icon: "🌺", tone: "angel", cheer: true },
    { min: 61, max: 70, title: "小天使", icon: "🍒", tone: "angel", cheer: true },
    { min: 50, max: 60, title: "高級會員", icon: "🎖️", tone: "member", cheer: false },
    { min: 41, max: 49, title: "", icon: "🌸", tone: "member", cheer: false },
    { min: 31, max: 40, title: "", icon: "🌷", tone: "member", cheer: false },
    { min: 21, max: 30, title: "", icon: "🌼", tone: "member", cheer: false },
    { min: 11, max: 20, title: "", icon: "🍀", tone: "member", cheer: false },
    { min: 1, max: 10, title: "", icon: "🌱", tone: "member", cheer: false },
  ],
  users: [],
  cheer_enabled: true,
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

// 回傳 { title, icon, tone, cheer }：帳號專屬的稱謂/圖案優先，沒填的欄位再用等級區間補
export function resolveLevelInfo(username, level) {
  const empty = { title: "", icon: "", tone: "", cheer: false };
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
    tone: range?.tone || "gold",
    // 進場歡呼：總開關開啟，且（有專屬稱謂 或 所在區間有勾歡呼）
    cheer: !!cfg.cheer_enabled && (!!user?.title || !!range?.cheer),
  };
}

export function resolveLevelTitle(username, level) {
  return resolveLevelInfo(username, level).title;
}
