// cherryLevel.js — 櫻桃房（貨幣名稱含「櫻桃」）專用的等級稱號與等級圖案。
// 稱號/圖案都集中在這兩張表，要調整直接改這裡即可。
import { roomConfig } from "./roomConfig";

export const isCherryRoom = () => String(roomConfig.currency_name || "").includes("櫻桃");

// 稱號（由高到低比對，第一個符合的就是）；tone 決定進場歡呼的配色
const TITLES = [
  { min: 99, max: 99, title: "總站長",     tone: "boss" },
  { min: 98, max: 98, title: "副總站長",   tone: "boss" },
  { min: 97, max: 97, title: "小站長",     tone: "boss" },
  { min: 96, max: 96, title: "指揮官",     tone: "staff" },
  { min: 91, max: 95, title: "書記官",     tone: "staff" },
  { min: 81, max: 90, title: "櫻桃金天使", tone: "gold" },
  { min: 71, max: 80, title: "櫻桃大天使", tone: "angel" },
  { min: 61, max: 70, title: "櫻桃小天使", tone: "angel" },
];

// 等級圖案：每一級距一個專屬圖案
const ICONS = [
  { min: 99, icon: "👑" }, // 總站長（原圖案）
  { min: 98, icon: "💎" }, // 副總站長
  { min: 97, icon: "🏆" }, // 小站長
  { min: 91, icon: "🔱" }, // 91–96 書記官/指揮官（原管理員圖案）
  { min: 81, icon: "⭐" }, // 櫻桃金天使
  { min: 71, icon: "🌺" }, // 櫻桃大天使
  { min: 61, icon: "🍒" }, // 櫻桃小天使
  { min: 50, icon: "🎖️" }, // 50–60 原高級會員獎牌
  { min: 41, icon: "🌸" },
  { min: 31, icon: "🌷" },
  { min: 21, icon: "🌼" },
  { min: 11, icon: "🍀" },
  { min: 1,  icon: "🌱" },
];

export function getCherryTitle(level) {
  const lv = Number(level) || 0;
  return TITLES.find((t) => lv >= t.min && lv <= t.max) || null;
}

export function getCherryLevelIcon(level) {
  const lv = Number(level) || 0;
  return ICONS.find((t) => lv >= t.min)?.icon || "";
}
