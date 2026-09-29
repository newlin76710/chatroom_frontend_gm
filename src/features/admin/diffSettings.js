// diffSettings.js — 找出設定裡有改過的欄位
// 「🛡 管理 → 房間設定」跟「⚙️ 設定」兩個面板打同一支 /admin/set-settings，讀進來的也是同一包設定。
// 以前兩邊存檔都整包送出，其中一邊就會用自己手上的舊值把另一邊剛改好的值蓋回去；
// 改成只送有改過的欄位，兩邊就不會互相覆蓋。
export function diffSettings(original, current) {
  if (!current) return {};
  if (!original) return { ...current };
  const out = {};
  for (const [k, v] of Object.entries(current)) {
    if (JSON.stringify(v) !== JSON.stringify(original[k])) out[k] = v;
  }
  return out;
}
