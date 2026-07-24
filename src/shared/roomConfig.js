const _cfg = {
  room_name:           null,
  admin_max_level:     99,
  admin_min_level:     91,
  openai:              false,
  show_ip:             true,
  new_function:        false,
  new_section:         false,
  open_peony:          false,
  livekit_url:         "",
  room_setting:        "prod",
  leaderboard_enabled: false,
  currency_name:       "金蘋果",
  currency_icon:       "gold_apple.gif",
  currency_emoji:      "🍎",
  nickname_max_length: 10,
};

export const roomConfig = _cfg;

export const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:10000";
export const RN      = import.meta.env.VITE_ROOM_NAME   || "windsong";

let _promise = null;

export function loadRoomConfig() {
  if (_promise) return _promise;
  _promise = fetch(`${BACKEND}/api/room-config?room=${RN}`)
    .then(r => r.json())
    .then(data => { Object.assign(_cfg, data); return _cfg; })
    .catch(() => _cfg);
  return _promise;
}
