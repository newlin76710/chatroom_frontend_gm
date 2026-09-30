// cherryLevel.js — 櫻桃房判斷 + 櫻桃房「預設」等級稱號/圖案（給 /scatter-cherry-demo 展示頁用）。
// 實際聊天室的稱謂/圖案/進場歡呼已改成後台「房間設定 → 等級稱謂設定」可調（金幣房、櫻桃房共用），
// 查詢請用 shared/levelTitles.js 的 resolveLevelInfo；預設表集中在 levelTitles.js 的 DEFAULT_CHERRY_LEVEL_TITLES。
import { roomConfig } from "./roomConfig";
import { DEFAULT_CHERRY_LEVEL_TITLES } from "./levelTitles";

export const isCherryRoom = () => String(roomConfig.currency_name || "").includes("櫻桃");

const findRange = (level) => {
  const lv = Number(level) || 0;
  return DEFAULT_CHERRY_LEVEL_TITLES.ranges.find((r) => lv >= r.min && lv <= r.max) || null;
};

export function getCherryTitle(level) {
  const r = findRange(level);
  return r && r.title ? { min: r.min, max: r.max, title: r.title, tone: r.tone, noCheer: !r.cheer } : null;
}

export function getCherryLevelIcon(level) {
  return findRange(level)?.icon || "";
}
