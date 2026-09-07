import { roomConfig } from "./roomConfig";
export function expForNextLevel(level) { const MAX_LEVEL = (roomConfig.admin_min_level || 91) - 1; level = Math.min(level, MAX_LEVEL); return Math.floor(120 * level * level + 200); }

export const safeText = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    if (v.text) return String(v.text);
    if (v.name) return String(v.name);
    if (v.user) return String(v.user);
    if (v.message) return String(v.message);
    return JSON.stringify(v);
  }
  return String(v);
};

// 各小遊戲（接櫻桃/夾娃娃/撈金蘋果/挖寶/打地鼠/跑馬燈…）由後端排程自動廣播的
// 開始倒數／開始／結束公告，全部都是 systemMessage 純字串、沒有專屬 type 欄位可以篩，
// 只能靠文字內容比對——每個小遊戲的公告字串直接寫在 chatroom_backend/src/game/*.js 裡
const GAME_BROADCAST_PATTERNS = [
  /秒後/,                         // 各小遊戲「N 秒後開始／出現／抽出」倒數預告
  /遊戲(?:開始|結束|時間到)/,       // 各小遊戲開始／結束／時間到公告
  /^🔥 搶.+第一個點到的人/,         // 搶金蘋果（單顆）玩法預告
  /^🎉 .+搶到了.+獲得/,            // 搶金蘋果（單顆）結果
  /^🎉 恭喜 .+ 中了跑馬燈大獎/,     // 跑馬燈中獎結果
  /^🎰 跑馬燈結束，沒有人在線上/,   // 跑馬燈無人參加
];

export function isGameBroadcastMessage(text) {
  if (!text) return false;
  const s = String(text);
  return GAME_BROADCAST_PATTERNS.some((re) => re.test(s));
}