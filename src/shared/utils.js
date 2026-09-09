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

// 「隱藏遊戲推播」只用來濾掉賭場類的中獎廣播（21點/輪盤/百家樂/拉霸/骰寶/賽車/殭屍生存），
// 這些是純戰績洗版、玩家不需要靠這些訊息才能參與遊戲，全部都是 systemMessage 純字串、
// 沒有專屬 type 欄位可以篩，只能靠文字內容比對——公告字串直接寫在 chatroom_backend/src/game/*.js 裡
const GAME_BROADCAST_PATTERNS = [
  /在21點獲勝，贏得/,              // 21點中獎廣播（blackjackRouter.js）
  /在輪盤直注數字.+，獲得/,         // 輪盤中獎廣播（rouletteRouter.js）
  /在百家樂押.+獲勝，淨贏/,         // 百家樂中獎廣播（baccaratRouter.js）
  /在老虎機中贏得/,                // 拉霸中獎廣播（slot.js）
  /在骰寶中贏得/,                  // 骰寶中獎廣播（sicbo.js）
  /押中.+號車冠軍，獲得/,          // 賽車中獎廣播（carRaceRouter.js）
  /通過殭屍生存戰三關全破，獲得/,   // 殭屍生存全破獎勵廣播（zombieRunRouter.js）
];

// 排程型小遊戲（接櫻桃/夾娃娃/撈金蘋果/挖寶/打地鼠…）跟跑馬燈／推牌一樣，都是玩家需要
// 靠公告才知道「現在／等一下可以玩」的遊戲資訊（時間點是管理員在後台設定的），不是單純的
// 戰績洗版，所以不管「隱藏遊戲推播」有沒有開都一律顯示
const ALWAYS_VISIBLE_PATTERNS = [
  /跑馬燈/,
  /推牌/,
  /秒後/,                         // 各小遊戲「N 秒後開始／出現／抽出」倒數預告
  /遊戲(?:開始|結束|時間到)/,       // 各小遊戲開始／結束／時間到公告
  /^🔥 搶.+第一個點到的人/,         // 搶金蘋果（單顆）玩法預告
  /^🎉 .+搶到了.+獲得/,            // 搶金蘋果（單顆）結果
];

export function isGameBroadcastMessage(text) {
  if (!text) return false;
  const s = String(text);
  if (ALWAYS_VISIBLE_PATTERNS.some((re) => re.test(s))) return false;
  return GAME_BROADCAST_PATTERNS.some((re) => re.test(s));
}