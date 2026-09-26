import { useEffect, useState, useRef } from "react";
import "./AdminSettingsModal.css";
import { RN, roomConfig } from "../../shared/roomConfig";
import { BRAND_NAME } from "../../shared/brand";

const FLOWER_EFFECT_INFO = {
  petal_rain:    { label: "🌸 花瓣雨",         desc: "滿版玫瑰花瓣飄落" },
  heart_bouquet: { label: "💝 愛心花束",       desc: "玫瑰流光排成愛心" },
  classic_rose:  { label: "🌹 經典全螢幕大花", desc: "早期版本：整個畫面鋪滿大朵玫瑰" },
  lifetime:      { label: "💍 一生一世",       desc: "金色煙火 + 滿屏玫瑰花海" },
};

// 獨家賣場禮物全螢幕特效（本房間獨家、僅金幣模式）：三種禮物共用同一套設定區塊
const EXCLUSIVE_GIFT_EFFECTS = [
  { prefix: "car",     title: "🚗 跑車全螢幕特效",     noun: "跑車", desc: "跑車橫越全螢幕＋車速殘影" },
  { prefix: "plane",   title: "✈️ 獨家飛機全螢幕特效", noun: "飛機", desc: "飛機帶光軌斜向飛越全螢幕，後方拉出電台專屬橫幅" },
  { prefix: "diamond", title: "💎 獨家鑽石全螢幕特效", noun: "鑽石", desc: "巨鑽在中央閃耀旋轉＋星光爆發，附電台專屬金色字樣" },
];

const DEFAULT = {
  leaderboard_enabled:  false,
  open_game:            true,
  show_ip:              true,
  daily_login_reward:   1,
  singing_reward:       2,
  singing_double_enabled:       false,
  singing_double_multiplier:    2,
  singing_double_start_hour:    20,
  singing_double_start_minute:  0,
  singing_double_end_hour:      22,
  singing_double_end_minute:    0,
  singing_double2_enabled:      false,
  singing_double2_multiplier:   2,
  singing_double2_start_hour:   20,
  singing_double2_start_minute: 0,
  singing_double2_end_hour:     22,
  singing_double2_end_minute:   0,
  per_transfer_limit:   0,
  daily_transfer_limit: 0,
  daily_receive_limit:  0,
  marquee_reward:       10,
  marquee_duration:     30,
  marquee_cooldown_minutes: 20,
  marquee_auto_enabled: false,
  marquee_auto_interval_minutes: 30,
  marquee_auto_start_hour: 0,
  marquee_auto_start_minute: 0,
  marquee_auto_end_hour: 24,
  marquee_auto_end_minute: 0,
  pushcard_max_bet:     50,
  pushcard_duration:    10,
  pushcard_cooldown_minutes: 20,
  pushcard_burst_limit: 1,
  pushcard_auto_enabled: false,
  pushcard_auto_interval_minutes: 30,
  pushcard_auto_start_hour: 0,
  pushcard_auto_start_minute: 0,
  pushcard_auto_end_hour: 24,
  pushcard_auto_end_minute: 0,
  littlemary_enabled:   false,
  littlemary_max_bet_per_symbol: 50,
  littlemary_symbols: [
    { key: "cherry", label: "🍒", multiplier: 2 },
    { key: "bell", label: "🔔", multiplier: 3 },
    { key: "star", label: "⭐", multiplier: 3 },
    { key: "grape", label: "🍇", multiplier: 4 },
    { key: "watermelon", label: "🍉", multiplier: 5 },
    { key: "seven", label: "7️⃣", multiplier: 8 },
    { key: "gem", label: "💎", multiplier: 10 },
    { key: "crown", label: "👑", multiplier: 15 },
  ],
  littlemary_round_duration: 20,
  littlemary_burst_limit: 1,
  littlemary_cooldown_minutes: 10,
  littlemary_auto_enabled: false,
  littlemary_auto_interval_minutes: 15,
  littlemary_auto_start_hour: 0,
  littlemary_auto_start_minute: 0,
  littlemary_auto_end_hour: 24,
  littlemary_auto_end_minute: 0,
  flower_effect_enabled: true,
  flower_effect_threshold: 999,
  flower_effect_burst_limit: 1,
  flower_effect_cooldown_minutes: 5,
  car_effect_enabled: true,
  car_effect_threshold: 999,
  car_effect_burst_limit: 1,
  car_effect_cooldown_minutes: 5,
  // 送花特效分級：對應後端 share/giftEffects.js 的 DEFAULT_FLOWER_EFFECT_TIERS
  flower_effect_tiers: [
    { effect: "petal_rain",    threshold: 99,   burst_limit: 3, cooldown_minutes: 1,  enabled: true },
    { effect: "heart_bouquet", threshold: 520,  burst_limit: 2, cooldown_minutes: 3,  enabled: true },
    { effect: "classic_rose",  threshold: 999,  burst_limit: 1, cooldown_minutes: 5,  enabled: true },
    { effect: "lifetime",      threshold: 1314, burst_limit: 1, cooldown_minutes: 10, enabled: true },
  ],
  plane_effect_enabled: true,
  plane_effect_threshold: 999,
  plane_effect_burst_limit: 1,
  plane_effect_cooldown_minutes: 5,
  diamond_effect_enabled: true,
  diamond_effect_threshold: 999,
  diamond_effect_burst_limit: 1,
  diamond_effect_cooldown_minutes: 5,
  red_envelope_amount_options: "100,500,1000,5000",
  red_envelope_distribution_mode: "even",
  red_envelope_burst_limit: 1,
  red_envelope_cooldown_minutes: 10,
  red_envelope_max_amount: 10000,
  celebration_amount_options: "100,500,1000",
  celebration_burst_limit: 1,
  celebration_cooldown_minutes: 10,
  surprise_reward:      10,
  game1_enabled:        true,
  game1_hour:           20,
  game1_minute:         30,
  game1_apple_count:    5,
  game1_reward:         1,
  game1_spd_lo:         5,
  game1_spd_hi:         9,
  game2_enabled:        true,
  game2_hour:           20,
  game2_minute:         35,
  game2_reward:         25,
  game2_spd_lo:         4,
  game2_spd_hi:         6,
  whack_enabled:        true,
  whack_hour:           21,
  whack_minute:         0,
  whack_duration:       30,
  whack_reward:         1,
  whack_ms_lo:          350,
  whack_ms_hi:          700,
  whack_min_apples:     4,
  whack_max_apples:     7,
  claw_enabled:         true,
  claw_hour:            21,
  claw_minute:          30,
  claw_duration:        50,
  claw_reward:          2,
  claw_difficulty:      75,
  claw_speed:           100,
  claw_drop_speed:      100,
  claw_apple_count:     12,
  cherry_enabled:       true,
  cherry_hour:          21,
  cherry_minute:        0,
  cherry_duration:      60,
  cherry_count:         15,
  cherry_reward:        1,
  cherry_spd_lo:        3,
  cherry_spd_hi:        6,
  dig_enabled:          true,
  dig_hour:             21,
  dig_minute:           0,
  dig_hour2:            13,
  dig_minute2:          0,
  dig_hour3:            18,
  dig_minute3:          0,
  dig_hour4:            9,
  dig_minute4:          0,
  dig_hour5:            6,
  dig_minute5:          0,
  dig_hour6:            0,
  dig_minute6:          0,
  dig_duration:         60,
  dig_max_digs:         5,
  dig_reward_min:       1,
  dig_reward_max:       10,
  roulette_enabled:          true,
  roulette_open_hour:        13,
  roulette_open_minute:      0,
  roulette_close_hour:       24,
  roulette_close_minute:     0,
  roulette_num_multiplier:   36,
  roulette_bh_multiplier:    2,
  roulette_combo_multiplier: 4,
  roulette_max_bet:          50,
  roulette_house_edge:       100,
  blackjack_enabled:         true,
  blackjack_open_hour:       0,
  blackjack_open_minute:     0,
  blackjack_close_hour:      24,
  blackjack_close_minute:    0,
  blackjack_max_bet:         200,
  blackjack_house_edge:      100,
  sicbo_enabled:             true,
  sicbo_open_hour:           0,
  sicbo_open_minute:         0,
  sicbo_close_hour:          24,
  sicbo_close_minute:        0,
  sicbo_max_bet:             200,
  sicbo_house_edge:          100,
  slot_enabled:              true,
  slot_open_hour:            0,
  slot_open_minute:          0,
  slot_close_hour:           24,
  slot_close_minute:         0,
  slot_max_bet:              200,
  slot_house_edge:           100,
  baccarat_enabled:          true,
  baccarat_open_hour:        0,
  baccarat_open_minute:      0,
  baccarat_close_hour:       24,
  baccarat_close_minute:     0,
  baccarat_max_bet:          200,
  baccarat_house_edge:       100,
  baccarat_lucky6_enabled:   true,
  pusher_enabled:            true,
  pusher_open_hour:          0,
  pusher_open_minute:        0,
  pusher_close_hour:         24,
  pusher_close_minute:       0,
  pusher_special_chance_pct: 6,
  pusher_jackpot_rate:       30,
  pusher_jackpot_payout_pct: 60,
  pusher_plate_speed:        "normal",
  pusher_target_rtp:         75,
  race_enabled:              true,
  race_open_hour:            0,
  race_open_minute:          0,
  race_close_hour:           24,
  race_close_minute:         0,
  race_max_bet:              50,
  race_house_edge:           100,
  zombie_enabled:            true,
  zombie_entry_cost:         10,
  zombie_level_reward:       15,
  zombie_daily_limit:        3,
  bigtwo_enabled:            true,
  mahjong_enabled:           true,
  xiangqi_enabled:           true,
  speech_reward_enabled:     true,
  speech_reward_threshold:   100,
  speech_reward_amount:      10,
  online_reward_enabled:            true,
  online_reward_interval_minutes:   60,
  online_reward_amount:             5,
  currency_name:             "",
  currency_emoji:            "💰",
  monthly_admin_gift_enabled: false,
  monthly_admin_gift_amount:  0,
  game_broadcast_enabled:    true,
  game_broadcast_threshold:  0,
};

export default function AdminSettingsModal({ open, onClose, token, BACKEND, myLevel }) {
  const [settings, setSettings] = useState(DEFAULT);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // ─── 可自由拖曳（不再用全螢幕遮罩蓋住聊天室） ───────────────────────────
  const panelRef = useRef(null);
  const pos = useRef({ x: 60, y: 40, offsetX: 0, offsetY: 0, dragging: false });

  const onDragMouseDown = (e) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    pos.current.dragging = true;
    pos.current.offsetX = e.clientX - pos.current.x;
    pos.current.offsetY = e.clientY - pos.current.y;
    document.addEventListener("mousemove", onDragMouseMove);
    document.addEventListener("mouseup", onDragMouseUp);
  };
  const onDragMouseMove = (e) => {
    if (!pos.current.dragging) return;
    e.preventDefault();
    pos.current.x = e.clientX - pos.current.offsetX;
    pos.current.y = e.clientY - pos.current.offsetY;
    if (panelRef.current) {
      panelRef.current.style.left = pos.current.x + "px";
      panelRef.current.style.top = pos.current.y + "px";
    }
  };
  const onDragMouseUp = () => {
    pos.current.dragging = false;
    document.removeEventListener("mousemove", onDragMouseMove);
    document.removeEventListener("mouseup", onDragMouseUp);
  };

  /* ─── 讀取設定 ───────────────────────────────────────────────── */
  const fetchSettings = async () => {
    try {
      const res  = await fetch(`${BACKEND}/admin/settings?room=${RN}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSettings({ ...DEFAULT, ...data });
    } catch {
      alert("讀取設定失敗");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) { setLoading(true); fetchSettings(); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── 儲存設定 ───────────────────────────────────────────────── */
  const handleSave = async () => {
    setSaving(true);
    try {
      const res  = await fetch(`${BACKEND}/admin/set-settings`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...settings, room: RN }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "更新失敗"); return; }
      alert("更新成功！遊戲排程已重新載入。");
      onClose();
    } catch {
      alert("更新失敗");
    } finally {
      setSaving(false);
    }
  };

  /* ─── 欄位處理 ───────────────────────────────────────────────── */
  const setInt = (key, raw) => {
    if (raw === "") { setSettings(p => ({ ...p, [key]: "" })); return; }
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0) return;
    setSettings(p => ({ ...p, [key]: Math.floor(n) }));
  };

  const setBool = (key, val) => setSettings(p => ({ ...p, [key]: val }));

  // 送花特效分級：flower_effect_tiers 是陣列，跟 setInt 一樣允許暫時清空成 "" 方便重打
  const setTier = (idx, key, val) => setSettings(p => {
    const tiers = (p.flower_effect_tiers || DEFAULT.flower_effect_tiers).map(t => ({ ...t }));
    tiers[idx][key] = val;
    return { ...p, flower_effect_tiers: tiers };
  });
  const setTierInt = (idx, key, raw) => {
    if (raw === "") { setTier(idx, key, ""); return; }
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0) return;
    setTier(idx, key, Math.floor(n));
  };

  if (!open) return null;

  const pad2 = n => String(n).padStart(2, "0");
  const fmtTime = (h, m) => `${pad2(h)}:${pad2(m)}`;
  const currencyName = settings.currency_name || roomConfig.currency_name || "";
  const currencyEmoji = settings.currency_emoji || roomConfig.currency_emoji || "💰";
  // 撿寶類小遊戲跟貨幣名稱一一對應：金蘋果→4 個蘋果小遊戲、紅櫻桃→接櫻桃、金幣→挖寶，
  // 其他自訂貨幣名稱則都不顯示（避免房間裡出現跟貨幣名稱不相關的撿寶小遊戲設定）
  const isApple = currencyName === "金蘋果";
  const isCherry = currencyName === "紅櫻桃";
  const isCoin = currencyName === "金幣";

  return (
    <div ref={panelRef} className="apple-modal-floating" style={{ left: pos.current.x, top: pos.current.y }}>
      <div className="apple-modal-header" onMouseDown={onDragMouseDown}>
        <h3>⚙️ {currencyName}設定</h3>
        <button onClick={onClose}>✖</button>
      </div>
      <div className="apple-modal-content" style={{ width: 460, maxHeight: "80vh", overflowY: "auto" }}>
        {loading ? <div>讀取中…</div> : (
          <>
            {/* ─── 功能顯示 ──────────────────────────────────────── */}
            <section className="settings-section">
              <h4>功能顯示</h4>
                <Row label="排行榜按鈕">
                  <label className="toggle-label">
                    <input type="checkbox" checked={!!settings.leaderboard_enabled}
                      onChange={e => setBool("leaderboard_enabled", e.target.checked)} />
                    {" "}啟用排行榜
                  </label>
                </Row>
            </section>

            {/* ─── 遊戲推播 ──────────────────────────────────────── */}
            <section className="settings-section">
              <h4>遊戲推播</h4>
              <Row label="遊戲廳大獎推播">
                <label className="toggle-label">
                  <input type="checkbox" checked={!!settings.game_broadcast_enabled}
                    onChange={e => setBool("game_broadcast_enabled", e.target.checked)} />
                  {" "}啟用（關閉後推幣機/21點/輪盤/骰寶/老虎機/百家樂/賽車/殭屍生存戰完全不推播）
                </label>
              </Row>
              {settings.game_broadcast_enabled && (
                <Row label="最低推播金額">
                  <input type="number" min={0} value={settings.game_broadcast_threshold}
                    onChange={e => setInt("game_broadcast_threshold", e.target.value)} />
                  <span className="field-note">
                    個{currencyName}（單局贏得金額低於此門檻時系統靜音不推播，設 0 代表全部推播）
                  </span>
                </Row>
              )}
            </section>

            {/* ─── 基本獎勵 ──────────────────────────────────────── */}
            <section className="settings-section">
              <h4>基本獎勵</h4>
              <Row label="每日登入獎勵">
                <input type="number" value={settings.daily_login_reward}
                  onChange={e => setInt("daily_login_reward", e.target.value)} />
              </Row>
              <Row label="唱歌獎勵">
                <input type="number" value={settings.singing_reward}
                  onChange={e => setInt("singing_reward", e.target.value)} />
              </Row>
              <Row label="唱歌雙倍獎勵">
                <label className="toggle-label">
                  <input type="checkbox" checked={!!settings.singing_double_enabled}
                    onChange={e => setBool("singing_double_enabled", e.target.checked)} />
                  {" "}啟用每日指定時段加倍{currencyName}
                </label>
              </Row>
              {settings.singing_double_enabled && (
                <Row label="獎勵倍數">
                  <input type="number" min={2} max={10} style={{ width: 64 }}
                    value={settings.singing_double_multiplier}
                    onChange={e => setInt("singing_double_multiplier", e.target.value)} />
                  <span className="field-note">倍（最少 2，最多 10）</span>
                </Row>
              )}
              {settings.singing_double_enabled && (
                <Row label="時段（台灣時間）">
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="number" min={0} max={23} style={{ width: 56 }}
                      value={settings.singing_double_start_hour}
                      onChange={e => setInt("singing_double_start_hour", e.target.value)} />
                    <span>時</span>
                    <input type="number" min={0} max={59} style={{ width: 56 }}
                      value={settings.singing_double_start_minute}
                      onChange={e => setInt("singing_double_start_minute", e.target.value)} />
                    <span>分 ～</span>
                    <input type="number" min={0} max={23} style={{ width: 56 }}
                      value={settings.singing_double_end_hour}
                      onChange={e => setInt("singing_double_end_hour", e.target.value)} />
                    <span>時</span>
                    <input type="number" min={0} max={59} style={{ width: 56 }}
                      value={settings.singing_double_end_minute}
                      onChange={e => setInt("singing_double_end_minute", e.target.value)} />
                    <span>分</span>
                    <span style={{ color: "#aaa", fontSize: "0.8rem" }}>
                      （{fmtTime(settings.singing_double_start_hour, settings.singing_double_start_minute)}
                      ～{fmtTime(settings.singing_double_end_hour, settings.singing_double_end_minute)}）
                    </span>
                  </div>
                </Row>
              )}
              <Row label="唱歌雙倍獎勵（第二時段）">
                <label className="toggle-label">
                  <input type="checkbox" checked={!!settings.singing_double2_enabled}
                    onChange={e => setBool("singing_double2_enabled", e.target.checked)} />
                  {" "}額外啟用第二組指定時段加倍{currencyName}
                </label>
              </Row>
              {settings.singing_double2_enabled && (
                <Row label="獎勵倍數">
                  <input type="number" min={2} max={10} style={{ width: 64 }}
                    value={settings.singing_double2_multiplier}
                    onChange={e => setInt("singing_double2_multiplier", e.target.value)} />
                  <span className="field-note">倍（最少 2，最多 10）</span>
                </Row>
              )}
              {settings.singing_double2_enabled && (
                <Row label="時段（台灣時間）">
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="number" min={0} max={23} style={{ width: 56 }}
                      value={settings.singing_double2_start_hour}
                      onChange={e => setInt("singing_double2_start_hour", e.target.value)} />
                    <span>時</span>
                    <input type="number" min={0} max={59} style={{ width: 56 }}
                      value={settings.singing_double2_start_minute}
                      onChange={e => setInt("singing_double2_start_minute", e.target.value)} />
                    <span>分 ～</span>
                    <input type="number" min={0} max={23} style={{ width: 56 }}
                      value={settings.singing_double2_end_hour}
                      onChange={e => setInt("singing_double2_end_hour", e.target.value)} />
                    <span>時</span>
                    <input type="number" min={0} max={59} style={{ width: 56 }}
                      value={settings.singing_double2_end_minute}
                      onChange={e => setInt("singing_double2_end_minute", e.target.value)} />
                    <span>分</span>
                    <span style={{ color: "#aaa", fontSize: "0.8rem" }}>
                      （{fmtTime(settings.singing_double2_start_hour, settings.singing_double2_start_minute)}
                      ～{fmtTime(settings.singing_double2_end_hour, settings.singing_double2_end_minute)}）
                    </span>
                  </div>
                </Row>
              )}
              <Row label="單筆轉帳上限">
                <input type="number" value={settings.per_transfer_limit}
                  onChange={e => setInt("per_transfer_limit", e.target.value)} />
              </Row>
              <Row label="每日轉帳上限">
                <input type="number" value={settings.daily_transfer_limit}
                  onChange={e => setInt("daily_transfer_limit", e.target.value)} />
              </Row>
              <Row label="每日收禮上限">
                <input type="number" value={settings.daily_receive_limit}
                  onChange={e => setInt("daily_receive_limit", e.target.value)} />
              </Row>
              <Row label="跑馬燈獎勵">
                <input type="number" value={settings.marquee_reward}
                  onChange={e => setInt("marquee_reward", e.target.value)} />
              </Row>
              <Row label="跑馬燈時長(秒)">
                <input type="number" value={settings.marquee_duration}
                  onChange={e => setInt("marquee_duration", e.target.value)} />
              </Row>
              <Row label="跑馬燈冷卻分鐘數">
                <input type="number" min={0} max={60} value={settings.marquee_cooldown_minutes}
                  onChange={e => setInt("marquee_cooldown_minutes", e.target.value)} />
                <span className="field-note">分鐘（0-60，每局結束後要等幾分鐘才能再開新局；0 = 不開啟冷卻）</span>
              </Row>
              {isCoin && (
              <>
                <Row label="跑馬燈無人值守自動開局">
                  <label className="toggle-label">
                    <input type="checkbox" checked={!!settings.marquee_auto_enabled}
                      onChange={e => setBool("marquee_auto_enabled", e.target.checked)} />
                    {" "}啟用
                  </label>
                  <span className="field-note">開啟後不論有無管理員在線都會自動開局；關閉時，只要現場沒有管理員在線一樣會自動開局補場，開局訊息會顯示「忘年音樂電台管理團隊」發起</span>
                </Row>
                <Row label="跑馬燈自動開局間隔">
                  <input type="number" min={1} max={1440} value={settings.marquee_auto_interval_minutes}
                    onChange={e => setInt("marquee_auto_interval_minutes", e.target.value)} />
                  <span className="field-note">分鐘（例如 30 = 每 30 分鐘檢查一次是否要自動開一場）</span>
                </Row>
                <Row label="跑馬燈自動開局時段（台灣時間）">
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="number" min={0} max={23} style={{ width: 56 }}
                      value={settings.marquee_auto_start_hour}
                      onChange={e => setInt("marquee_auto_start_hour", e.target.value)} />
                    <span>時</span>
                    <input type="number" min={0} max={59} style={{ width: 56 }}
                      value={settings.marquee_auto_start_minute}
                      onChange={e => setInt("marquee_auto_start_minute", e.target.value)} />
                    <span>分 ～</span>
                    <input type="number" min={0} max={24} style={{ width: 56 }}
                      value={settings.marquee_auto_end_hour}
                      onChange={e => setInt("marquee_auto_end_hour", e.target.value)} />
                    <span>時</span>
                    <input type="number" min={0} max={59} style={{ width: 56 }}
                      value={settings.marquee_auto_end_minute}
                      onChange={e => setInt("marquee_auto_end_minute", e.target.value)} />
                    <span>分</span>
                  </div>
                  <span className="field-note">只有落在這段時間內才會無人值守自動開局；手動開局不受此限制。預設 0 時～24 時 = 全天不限制</span>
                </Row>
              </>
              )}
              <Row label="推牌遊戲最高下注">
                <input type="number" min={1} value={settings.pushcard_max_bet}
                  onChange={e => setInt("pushcard_max_bet", e.target.value)} />
                <span className="field-note">個{currencyName}（玩家參加時可下注 1~此上限；贏了 1 賠 1，平手算站長贏）</span>
              </Row>
              <Row label="推牌遊戲秒數">
                <input type="number" min={5} value={settings.pushcard_duration}
                  onChange={e => setInt("pushcard_duration", e.target.value)} />
                <span className="field-note">秒（參加者選擇時間，時間到自動發牌）</span>
              </Row>
              <Row label="遊戲冷卻分鐘數">
                <input type="number" min={0} max={60} value={settings.pushcard_cooldown_minutes}
                  onChange={e => setInt("pushcard_cooldown_minutes", e.target.value)} />
                <span className="field-note">分鐘（0-60，每局結束後要等幾分鐘才能再開新局，確保有純聽歌時間；0 = 不開啟冷卻）</span>
              </Row>

              {isCoin && (
              <>
                <Row label="推牌可連發場次">
                  <input type="number" min={1} max={20} value={settings.pushcard_burst_limit}
                    onChange={e => setInt("pushcard_burst_limit", e.target.value)} />
                  <span className="field-note">場（連續開到這個場次才會真的進入冷卻分鐘數倒數，預設 1 = 每場結束就冷卻，跟改版前一樣）</span>
                </Row>
                <Row label="推牌無人值守自動開局">
                  <label className="toggle-label">
                    <input type="checkbox" checked={!!settings.pushcard_auto_enabled}
                      onChange={e => setBool("pushcard_auto_enabled", e.target.checked)} />
                    {" "}啟用
                  </label>
                  <span className="field-note">開啟後不論有無管理員在線都會自動開局；關閉時，只要現場沒有管理員在線一樣會自動開局補場，開局訊息會顯示「忘年音樂電台管理團隊」發起</span>
                </Row>
                <Row label="推牌自動開局間隔">
                  <input type="number" min={1} max={1440} value={settings.pushcard_auto_interval_minutes}
                    onChange={e => setInt("pushcard_auto_interval_minutes", e.target.value)} />
                  <span className="field-note">分鐘（例如 30 = 每 30 分鐘檢查一次是否要自動開一場）</span>
                </Row>
                <Row label="推牌自動開局時段（台灣時間）">
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="number" min={0} max={23} style={{ width: 56 }}
                      value={settings.pushcard_auto_start_hour}
                      onChange={e => setInt("pushcard_auto_start_hour", e.target.value)} />
                    <span>時</span>
                    <input type="number" min={0} max={59} style={{ width: 56 }}
                      value={settings.pushcard_auto_start_minute}
                      onChange={e => setInt("pushcard_auto_start_minute", e.target.value)} />
                    <span>分 ～</span>
                    <input type="number" min={0} max={24} style={{ width: 56 }}
                      value={settings.pushcard_auto_end_hour}
                      onChange={e => setInt("pushcard_auto_end_hour", e.target.value)} />
                    <span>時</span>
                    <input type="number" min={0} max={59} style={{ width: 56 }}
                      value={settings.pushcard_auto_end_minute}
                      onChange={e => setInt("pushcard_auto_end_minute", e.target.value)} />
                    <span>分</span>
                  </div>
                  <span className="field-note">只有落在這段時間內才會無人值守自動開局；手動開局不受此限制。預設 0 時～24 時 = 全天不限制</span>
                </Row>
              </>
              )}
              {isApple && (
                <Row label="每日樂透獎勵">
                  <input type="number" value={settings.surprise_reward}
                    onChange={e => setInt("surprise_reward", e.target.value)} />
                </Row>
              )}
              <Row label="發話獎勵">
                    <label className="toggle-label">
                      <input type="checkbox" checked={!!settings.speech_reward_enabled}
                        onChange={e => setBool("speech_reward_enabled", e.target.checked)} />
                      {" "}啟用累計發話獎勵
                    </label>
                  </Row>
                  {settings.speech_reward_enabled && (
                    <>
                      <Row label="每發話幾則">
                        <input type="number" min={1} value={settings.speech_reward_threshold}
                          onChange={e => setInt("speech_reward_threshold", e.target.value)} />
                        <span className="field-note">則（累計達到即發放一次，達標後重新累計，隔日歸零重算）</span>
                      </Row>
                      <Row label="每次發放">
                        <input type="number" min={0} value={settings.speech_reward_amount}
                          onChange={e => setInt("speech_reward_amount", e.target.value)} />
                        <span className="field-note">個{currencyName}</span>
                      </Row>
                    </>
                  )}
                  <Row label="在線獎勵">
                    <label className="toggle-label">
                      <input type="checkbox" checked={!!settings.online_reward_enabled}
                        onChange={e => setBool("online_reward_enabled", e.target.checked)} />
                      {" "}啟用在線時長獎勵
                    </label>
                  </Row>
                  {settings.online_reward_enabled && (
                    <>
                      <Row label="每上線幾分鐘">
                        <input type="number" min={1} value={settings.online_reward_interval_minutes}
                          onChange={e => setInt("online_reward_interval_minutes", e.target.value)} />
                        <span className="field-note">分鐘（以登入時間持續累計發放，不會每天重置；離線後重新登入才會重新起算）</span>
                      </Row>
                      <Row label="每次發放">
                        <input type="number" min={0} value={settings.online_reward_amount}
                          onChange={e => setInt("online_reward_amount", e.target.value)} />
                        <span className="field-note">個{currencyName}</span>
                      </Row>
                    </>
                  )}
            </section>

            {/* ─── 管理員公關金（每月固定發放給本房管理員）：僅滿級站長（admin_max_level）看得到 ───────── */}
            {isApple && myLevel >= (roomConfig.admin_max_level || 99) && (
            <section className="settings-section">
              <h4>
                🎁 管理員公關金
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.monthly_admin_gift_enabled}
                    onChange={e => setBool("monthly_admin_gift_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>
              <Row label="每月發放數量">
                <input type="number" min={0} value={settings.monthly_admin_gift_amount}
                  onChange={e => setInt("monthly_admin_gift_amount", e.target.value)} />
                <span className="field-note">
                  個{currencyName}（每月 1 號自動發放給本房 {roomConfig.admin_min_level || 91}~{roomConfig.admin_max_level || 99} 級管理員，作為公關用；需滿級站長權限才能調整此設定）
                </span>
              </Row>
            </section>
            )}

            {/* ─── 遊戲一：多顆金蘋果 ────────────────────────────── */}
            {isApple && (
            <section className="settings-section">
              <h4>
                {currencyEmoji} 遊戲一：撈{currencyName}（多顆模式）
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.game1_enabled}
                    onChange={e => setBool("game1_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="每日開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.game1_hour}
                    onChange={e => setInt("game1_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.game1_minute}
                    onChange={e => setInt("game1_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.game1_hour, settings.game1_minute)}
                  </span>
                </div>
              </Row>
              <Row label={`${currencyName}數量`}>
                <input type="number" min={1} max={50} value={settings.game1_apple_count}
                  onChange={e => setInt("game1_apple_count", e.target.value)} />
                <span className="field-note">顆（同時顯示在螢幕）</span>
              </Row>
              <Row label="每顆獎勵">
                <input type="number" min={1} value={settings.game1_reward}
                  onChange={e => setInt("game1_reward", e.target.value)} />
                <span className="field-note">個{currencyName}</span>
              </Row>
              <Row label={`${currencyName}速度（px/幀）`}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span>最慢</span>
                  <input type="number" min={1} max={30} style={{ width: 64 }}
                    value={settings.game1_spd_lo}
                    onChange={e => setInt("game1_spd_lo", e.target.value)} />
                  <span>最快</span>
                  <input type="number" min={1} max={30} style={{ width: 64 }}
                    value={settings.game1_spd_hi}
                    onChange={e => setInt("game1_spd_hi", e.target.value)} />
                </div>
              </Row>
            </section>
            )}

            {/* ─── 遊戲二：一顆大金蘋果 ──────────────────────────── */}
            {isApple && (
            <section className="settings-section">
              <h4>
                🔥 遊戲二：搶{currencyName}（第一個點到即結束）
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.game2_enabled}
                    onChange={e => setBool("game2_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="每日開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.game2_hour}
                    onChange={e => setInt("game2_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.game2_minute}
                    onChange={e => setInt("game2_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.game2_hour, settings.game2_minute)}
                  </span>
                </div>
              </Row>
              <Row label="搶到獎勵">
                <input type="number" min={1} value={settings.game2_reward}
                  onChange={e => setInt("game2_reward", e.target.value)} />
                <span className="field-note">個{currencyName}（第一個搶到即得，無時間限制）</span>
              </Row>
              <Row label={`${currencyName}速度（px/幀）`}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span>最慢</span>
                  <input type="number" min={1} max={20} style={{ width: 64 }}
                    value={settings.game2_spd_lo}
                    onChange={e => setInt("game2_spd_lo", e.target.value)} />
                  <span>最快</span>
                  <input type="number" min={1} max={20} style={{ width: 64 }}
                    value={settings.game2_spd_hi}
                    onChange={e => setInt("game2_spd_hi", e.target.value)} />
                </div>
              </Row>
            </section>
            )}

            {/* ─── 遊戲三：打金蘋果（打地鼠） ────────────────────── */}
            {isApple && (
            <section className="settings-section">
              <h4>
                🔨 遊戲三：打{currencyName}（打地鼠風格）
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.whack_enabled}
                    onChange={e => setBool("whack_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="每日開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.whack_hour}
                    onChange={e => setInt("whack_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.whack_minute}
                    onChange={e => setInt("whack_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.whack_hour, settings.whack_minute)}
                  </span>
                </div>
              </Row>
              <Row label="遊戲時長">
                <input type="number" min={10} max={120} style={{ width: 80 }}
                  value={settings.whack_duration}
                  onChange={e => setInt("whack_duration", e.target.value)} />
                <span className="field-note">秒（最少 10 秒）</span>
              </Row>
              <Row label="每顆獎勵">
                <input type="number" min={1} value={settings.whack_reward}
                  onChange={e => setInt("whack_reward", e.target.value)} />
                <span className="field-note">個{currencyName}（打一顆算一次）</span>
              </Row>
              <Row label={`${currencyName}可見時間（ms）`}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span>最短</span>
                  <input type="number" min={100} max={2000} step={50} style={{ width: 72 }}
                    value={settings.whack_ms_lo}
                    onChange={e => setInt("whack_ms_lo", e.target.value)} />
                  <span>最長</span>
                  <input type="number" min={100} max={2000} step={50} style={{ width: 72 }}
                    value={settings.whack_ms_hi}
                    onChange={e => setInt("whack_ms_hi", e.target.value)} />
                </div>
              </Row>
              <Row label={`同時${currencyName}顆數`}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span>開始</span>
                  <input type="number" min={1} max={9} style={{ width: 56 }}
                    value={settings.whack_min_apples}
                    onChange={e => setInt("whack_min_apples", e.target.value)} />
                  <span>最高</span>
                  <input type="number" min={1} max={9} style={{ width: 56 }}
                    value={settings.whack_max_apples}
                    onChange={e => setInt("whack_max_apples", e.target.value)} />
                  <span className="field-note">顆（最高 9）</span>
                </div>
              </Row>
            </section>
            )}

            {/* ─── 遊戲四：夾蘋果機 ───────────────────────────────── */}
            {isApple && (
            <section className="settings-section">
              <h4>
                🎰 遊戲四：夾{currencyName}機（夾娃娃機風格）
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.claw_enabled}
                    onChange={e => setBool("claw_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="每日開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.claw_hour}
                    onChange={e => setInt("claw_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.claw_minute}
                    onChange={e => setInt("claw_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.claw_hour, settings.claw_minute)}
                  </span>
                </div>
              </Row>
              <Row label="遊戲時長">
                <input type="number" min={10} max={120} style={{ width: 80 }}
                  value={settings.claw_duration}
                  onChange={e => setInt("claw_duration", e.target.value)} />
                <span className="field-note">秒（最少 10 秒）</span>
              </Row>
              <Row label="每次夾到獎勵">
                <input type="number" min={1} style={{ width: 80 }}
                  value={settings.claw_reward}
                  onChange={e => setInt("claw_reward", e.target.value)} />
                <span className="field-note">個{currencyName}</span>
              </Row>
              <Row label="夾取成功率">
                <input type="number" min={0} max={100} style={{ width: 80 }}
                  value={settings.claw_difficulty}
                  onChange={e => setInt("claw_difficulty", e.target.value)} />
                <span className="field-note">% （0=不可能，100=必中）</span>
              </Row>
              <Row label="爪子搖擺速度">
                <input type="number" min={10} max={200} style={{ width: 80 }}
                  value={settings.claw_speed}
                  onChange={e => setInt("claw_speed", e.target.value)} />
                <span className="field-note">10=很慢，100=預設，200=極快</span>
              </Row>
              <Row label="爪子下降速度">
                <input type="number" min={50} max={300} style={{ width: 80 }}
                  value={settings.claw_drop_speed}
                  onChange={e => setInt("claw_drop_speed", e.target.value)} />
                <span className="field-note">50=慢，100=預設，200=快，300=極快</span>
              </Row>
              <Row label={`場內${currencyName}數量`}>
                <input type="number" min={1} max={40} style={{ width: 80 }}
                  value={settings.claw_apple_count}
                  onChange={e => setInt("claw_apple_count", e.target.value)} />
                <span className="field-note">顆（1–40，越多越滿）</span>
              </Row>
            </section>
            )}

            {/* ─── 接櫻桃（貨幣為「紅櫻桃」時使用） ─────────────── */}
            {isCherry && (
            <section className="settings-section">
              <h4>
                🍒 接櫻桃（每日排程活動）
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.cherry_enabled}
                    onChange={e => setBool("cherry_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="每日開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.cherry_hour}
                    onChange={e => setInt("cherry_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.cherry_minute}
                    onChange={e => setInt("cherry_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.cherry_hour, settings.cherry_minute)}
                  </span>
                </div>
              </Row>
              <Row label="持續時間">
                <input type="number" min={10} max={300} value={settings.cherry_duration}
                  onChange={e => setInt("cherry_duration", e.target.value)} />
                <span className="field-note">秒</span>
              </Row>
              <Row label="櫻桃數量">
                <input type="number" min={1} max={50} value={settings.cherry_count}
                  onChange={e => setInt("cherry_count", e.target.value)} />
                <span className="field-note">顆（本場總共會掉落幾顆，每人最多接這麼多顆）</span>
              </Row>
              <Row label="每顆獎勵">
                <input type="number" min={1} value={settings.cherry_reward}
                  onChange={e => setInt("cherry_reward", e.target.value)} />
                <span className="field-note">個{currencyName}</span>
              </Row>
              <Row label="掉落速度（px/幀）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span>最慢</span>
                  <input type="number" min={1} max={20} style={{ width: 64 }}
                    value={settings.cherry_spd_lo}
                    onChange={e => setInt("cherry_spd_lo", e.target.value)} />
                  <span>最快</span>
                  <input type="number" min={1} max={20} style={{ width: 64 }}
                    value={settings.cherry_spd_hi}
                    onChange={e => setInt("cherry_spd_hi", e.target.value)} />
                </div>
              </Row>
            </section>
            )}

            {/* ─── 挖寶（貨幣為「金幣」時使用） ─────────── */}
            {isCoin && (
            <section className="settings-section">
              <h4>
                ⛏️ 挖寶（每日排程活動）
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.dig_enabled}
                    onChange={e => setBool("dig_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="第 1 場開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.dig_hour}
                    onChange={e => setInt("dig_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.dig_minute}
                    onChange={e => setInt("dig_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.dig_hour, settings.dig_minute)}
                  </span>
                </div>
              </Row>
              <Row label="第 2 場開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.dig_hour2}
                    onChange={e => setInt("dig_hour2", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.dig_minute2}
                    onChange={e => setInt("dig_minute2", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.dig_hour2, settings.dig_minute2)}
                  </span>
                </div>
              </Row>
              <Row label="第 3 場開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.dig_hour3}
                    onChange={e => setInt("dig_hour3", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.dig_minute3}
                    onChange={e => setInt("dig_minute3", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.dig_hour3, settings.dig_minute3)}
                  </span>
                </div>
              </Row>
              <Row label="第 4 場開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.dig_hour4}
                    onChange={e => setInt("dig_hour4", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.dig_minute4}
                    onChange={e => setInt("dig_minute4", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.dig_hour4, settings.dig_minute4)}
                  </span>
                </div>
              </Row>
              <Row label="第 5 場開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.dig_hour5}
                    onChange={e => setInt("dig_hour5", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.dig_minute5}
                    onChange={e => setInt("dig_minute5", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.dig_hour5, settings.dig_minute5)}
                  </span>
                </div>
              </Row>
              <Row label="第 6 場開始時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="number" min={0} max={23} style={{ width: 64 }}
                    value={settings.dig_hour6}
                    onChange={e => setInt("dig_hour6", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 64 }}
                    value={settings.dig_minute6}
                    onChange={e => setInt("dig_minute6", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                    → {fmtTime(settings.dig_hour6, settings.dig_minute6)}
                  </span>
                </div>
              </Row>
              <Row label="持續時間">
                <input type="number" min={10} max={300} value={settings.dig_duration}
                  onChange={e => setInt("dig_duration", e.target.value)} />
                <span className="field-note">秒</span>
              </Row>
              <Row label="挖寶次數">
                <input type="number" min={1} max={50} value={settings.dig_max_digs}
                  onChange={e => setInt("dig_max_digs", e.target.value)} />
                <span className="field-note">次（每人本場最多可以挖幾次）</span>
              </Row>
              <Row label="隨機獎勵範圍">
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span>最少</span>
                  <input type="number" min={1} style={{ width: 64 }}
                    value={settings.dig_reward_min}
                    onChange={e => setInt("dig_reward_min", e.target.value)} />
                  <span>最多</span>
                  <input type="number" min={1} style={{ width: 64 }}
                    value={settings.dig_reward_max}
                    onChange={e => setInt("dig_reward_max", e.target.value)} />
                  <span className="field-note">個{currencyName}（每次挖寶隨機獲得）</span>
                </div>
              </Row>
            </section>
            )}

            {/* ─── 小瑪莉跑馬燈押注（僅金幣模式） ──────────────────────── */}
            {isCoin && (
            <section className="settings-section">
              <h4>
                🎡 小瑪莉跑馬燈押注
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.littlemary_enabled}
                    onChange={e => setBool("littlemary_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="圖案與賠率倍率">
                <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                  {(settings.littlemary_symbols || []).map((sym, idx) => (
                    <div key={sym.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input type="text" value={sym.label} style={{ width: 50, textAlign: "center" }}
                        onChange={e => setSettings(p => {
                          const symbols = [...p.littlemary_symbols];
                          symbols[idx] = { ...symbols[idx], label: e.target.value };
                          return { ...p, littlemary_symbols: symbols };
                        })} />
                      <span>賠率 ×</span>
                      <input type="number" min={1} value={sym.multiplier} style={{ width: 64 }}
                        onChange={e => {
                          const raw = e.target.value;
                          setSettings(p => {
                            const symbols = [...p.littlemary_symbols];
                            symbols[idx] = { ...symbols[idx], multiplier: raw === "" ? "" : (Number(raw) || 1) };
                            return { ...p, littlemary_symbols: symbols };
                          });
                        }} />
                    </div>
                  ))}
                  <span className="field-note">押中的圖案獎金 = 下注金額 × 賠率倍率，共 {(settings.littlemary_symbols || []).length} 個圖案</span>
                </div>
              </Row>
              <Row label="單局每圖案下注上限">
                <input type="number" min={1} value={settings.littlemary_max_bet_per_symbol}
                  onChange={e => setInt("littlemary_max_bet_per_symbol", e.target.value)} />
                <span className="field-note">個{currencyName}（每個圖案各自的下注上限）</span>
              </Row>
              <Row label="下注時間">
                <input type="number" min={5} max={300} value={settings.littlemary_round_duration}
                  onChange={e => setInt("littlemary_round_duration", e.target.value)} />
                <span className="field-note">秒（開放下注到開獎的秒數）</span>
              </Row>
              <Row label="可連發場次">
                <input type="number" min={1} max={20} value={settings.littlemary_burst_limit}
                  onChange={e => setInt("littlemary_burst_limit", e.target.value)} />
                <span className="field-note">場（連續開到這個場次才會真的進入冷卻分鐘數倒數，預設 1 = 每場結束就冷卻）</span>
              </Row>
              <Row label="冷卻分鐘數">
                <input type="number" min={0} max={60} value={settings.littlemary_cooldown_minutes}
                  onChange={e => setInt("littlemary_cooldown_minutes", e.target.value)} />
                <span className="field-note">分鐘（0-60，0 = 不開啟冷卻）</span>
              </Row>
              <Row label="無人值守自動開局">
                <label className="toggle-label">
                  <input type="checkbox" checked={!!settings.littlemary_auto_enabled}
                    onChange={e => setBool("littlemary_auto_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
                <span className="field-note">開啟後不論有無管理員在線都會自動開局；關閉時，只要現場沒有管理員在線一樣會自動開局補場</span>
              </Row>
              <Row label="自動開局間隔">
                <input type="number" min={1} max={1440} value={settings.littlemary_auto_interval_minutes}
                  onChange={e => setInt("littlemary_auto_interval_minutes", e.target.value)} />
                <span className="field-note">分鐘（例如 15 = 每 15 分鐘檢查一次是否要自動開一場）</span>
              </Row>
              <Row label="自動開局時段（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="number" min={0} max={23} style={{ width: 56 }}
                    value={settings.littlemary_auto_start_hour}
                    onChange={e => setInt("littlemary_auto_start_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.littlemary_auto_start_minute}
                    onChange={e => setInt("littlemary_auto_start_minute", e.target.value)} />
                  <span>分 ～</span>
                  <input type="number" min={0} max={24} style={{ width: 56 }}
                    value={settings.littlemary_auto_end_hour}
                    onChange={e => setInt("littlemary_auto_end_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.littlemary_auto_end_minute}
                    onChange={e => setInt("littlemary_auto_end_minute", e.target.value)} />
                  <span>分</span>
                </div>
                <span className="field-note">只有落在這段時間內才會無人值守自動開局；手動開局不受此限制。預設 0 時～24 時 = 全天不限制</span>
              </Row>
            </section>
            )}

            {/* ─── 送花特效分級（僅金幣模式） ──────────────────────────── */}
            {isCoin && (
            <section className="settings-section">
              <h4>
                🌹 送花特效升級
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={settings.flower_effect_enabled !== false}
                    onChange={e => setBool("flower_effect_enabled", e.target.checked)} />
                  {" "}總開關
                </label>
              </h4>
              <p className="field-note" style={{ margin: "0 0 8px" }}>
                單次送花總金額達到的「最高門檻」那一組特效觸發，4 組各自計算連發場次/冷卻；冷卻中會直接擋下達該門檻的整筆送花（不扣款也不播特效），未達任何門檻的一般送花不受影響
              </p>
              <table className="flower-tier-table">
                <thead>
                  <tr><th>特效</th><th>啟用</th><th>門檻（{currencyName}）</th><th>連發場次</th><th>冷卻（分）</th></tr>
                </thead>
                <tbody>
                  {(settings.flower_effect_tiers || DEFAULT.flower_effect_tiers).map((tier, idx) => (
                    <tr key={tier.effect}>
                      <td title={FLOWER_EFFECT_INFO[tier.effect]?.desc}>
                        {FLOWER_EFFECT_INFO[tier.effect]?.label || tier.effect}
                        <div className="field-note">{FLOWER_EFFECT_INFO[tier.effect]?.desc}</div>
                      </td>
                      <td>
                        <input type="checkbox" checked={tier.enabled !== false}
                          onChange={e => setTier(idx, "enabled", e.target.checked)} />
                      </td>
                      <td>
                        <input type="number" min={1} value={tier.threshold}
                          onChange={e => setTierInt(idx, "threshold", e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min={1} max={20} value={tier.burst_limit}
                          onChange={e => setTierInt(idx, "burst_limit", e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min={0} max={60} value={tier.cooldown_minutes}
                          onChange={e => setTierInt(idx, "cooldown_minutes", e.target.value)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <span className="field-note">連發場次：連續觸發到這個次數才會真的進入冷卻倒數（1-20）；冷卻 0-60 分鐘，0 = 不冷卻</span>
            </section>
            )}

            {/* ─── 獨家賣場禮物全螢幕特效：跑車/飛機/鑽石（本房間獨家、僅金幣模式） ─── */}
            {isCoin && EXCLUSIVE_GIFT_EFFECTS.map(({ prefix, title, noun, desc }) => (
            <section className="settings-section" key={prefix}>
              <h4>
                {title}
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={settings[`${prefix}_effect_enabled`] !== false}
                    onChange={e => setBool(`${prefix}_effect_enabled`, e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>
              <p className="field-note" style={{ margin: "0 0 8px" }}>
                本房間獨家特效（{desc}）：畫面會帶上「{BRAND_NAME}」品牌名跟房號，跟送花特效升級是同一套機制，玩法/門檻邏輯完全比照辦理
              </p>
              <Row label="觸發門檻">
                <input type="number" min={1} value={settings[`${prefix}_effect_threshold`]}
                  onChange={e => setInt(`${prefix}_effect_threshold`, e.target.value)} />
                <span className="field-note">個{currencyName}（單次送{noun}總金額達此門檻，自動加碼全螢幕特效）</span>
              </Row>
              <Row label="可連發場次">
                <input type="number" min={1} max={20} value={settings[`${prefix}_effect_burst_limit`]}
                  onChange={e => setInt(`${prefix}_effect_burst_limit`, e.target.value)} />
                <span className="field-note">次（連續觸發到這個次數才會真的進入冷卻分鐘數倒數）</span>
              </Row>
              <Row label="冷卻分鐘數">
                <input type="number" min={0} max={60} value={settings[`${prefix}_effect_cooldown_minutes`]}
                  onChange={e => setInt(`${prefix}_effect_cooldown_minutes`, e.target.value)} />
                <span className="field-note">分鐘（0-60，0 = 不開啟冷卻；冷卻中會直接擋下達門檻的整筆送禮，不扣款也不播特效，門檻以下的一般送禮不受影響）</span>
              </Row>
            </section>
            ))}

            {/* ─── 全場金幣雨／發紅包（僅金幣模式） ────────────────────── */}
            {isCoin && (
            <section className="settings-section">
              <h4>🧧 全場金幣雨／發紅包</h4>
              <Row label="快選金額按鈕">
                {[0, 1, 2, 3].map(idx => {
                  const parts = String(settings.red_envelope_amount_options || "").split(",").map(x => x.trim());
                  while (parts.length < 4) parts.push("");
                  return (
                    <input key={idx} type="number" min={1} style={{ width: 70 }}
                      value={parts[idx]}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 1)) return;
                        const next = parts.slice(0, 4);
                        next[idx] = raw === "" ? "" : String(Math.floor(Number(raw)));
                        setSettings(p => ({ ...p, red_envelope_amount_options: next.join(",") }));
                      }} />
                  );
                })}
                <span className="field-note">發紅包彈窗裡的 4 個快選按鈕金額（玩家另外也可以自訂金額）</span>
              </Row>
              <Row label="單次發紅包上限">
                <input type="number" min={1} style={{ width: 100 }} value={settings.red_envelope_max_amount}
                  onChange={e => setInt("red_envelope_max_amount", e.target.value)} />
                <span className="field-note">玩家單次發紅包（快選或自訂）不能超過這個金額</span>
              </Row>
              <Row label="分配方式">
                <select value={settings.red_envelope_distribution_mode}
                  onChange={e => setSettings(p => ({ ...p, red_envelope_distribution_mode: e.target.value }))}>
                  <option value="even">均分</option>
                  <option value="random">隨機</option>
                </select>
              </Row>
              <Row label="可連發場次">
                <input type="number" min={1} max={20} value={settings.red_envelope_burst_limit}
                  onChange={e => setInt("red_envelope_burst_limit", e.target.value)} />
                <span className="field-note">次（連續發到這個次數才會真的進入冷卻分鐘數倒數）</span>
              </Row>
              <Row label="冷卻分鐘數">
                <input type="number" min={0} max={60} value={settings.red_envelope_cooldown_minutes}
                  onChange={e => setInt("red_envelope_cooldown_minutes", e.target.value)} />
                <span className="field-note">分鐘（0-60，0 = 不開啟冷卻）</span>
              </Row>
            </section>
            )}

            {/* ─── 專屬慶典模式（僅金幣模式） ──────────────────────────── */}
            {isCoin && (
            <section className="settings-section">
              <h4>🎉 專屬慶典模式</h4>
              <Row label="金額選單">
                <input type="text" value={settings.celebration_amount_options}
                  onChange={e => setSettings(p => ({ ...p, celebration_amount_options: e.target.value }))}
                  placeholder="100,500,1000" style={{ width: 180 }} />
                <span className="field-note">逗號分隔的正整數，玩家發起慶典時可選其中一個金額</span>
              </Row>
              <Row label="可連發場次">
                <input type="number" min={1} max={20} value={settings.celebration_burst_limit}
                  onChange={e => setInt("celebration_burst_limit", e.target.value)} />
                <span className="field-note">次（連續發起到這個次數才會真的進入冷卻分鐘數倒數）</span>
              </Row>
              <Row label="冷卻分鐘數">
                <input type="number" min={0} max={60} value={settings.celebration_cooldown_minutes}
                  onChange={e => setInt("celebration_cooldown_minutes", e.target.value)} />
                <span className="field-note">分鐘（0-60，0 = 不開啟冷卻）</span>
              </Row>
            </section>
            )}

            {/* ─── 遊戲廳：推幣機 ──────────────────────────────── */}
            <section className="settings-section">
              <h4>
                🎰 {isApple ? "娛樂城" : "遊戲廳"}：推幣機
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.pusher_enabled}
                    onChange={e => setBool("pusher_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="開放時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="number" min={0} max={23} style={{ width: 56 }}
                    value={settings.pusher_open_hour}
                    onChange={e => setInt("pusher_open_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.pusher_open_minute}
                    onChange={e => setInt("pusher_open_minute", e.target.value)} />
                  <span>分 ～</span>
                  <input type="number" min={0} max={24} style={{ width: 56 }}
                    value={settings.pusher_close_hour}
                    onChange={e => setInt("pusher_close_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.pusher_close_minute}
                    onChange={e => setInt("pusher_close_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.8rem" }}>（24時 = 午夜）</span>
                </div>
              </Row>
              <Row label="特殊物機率">
                <input type="number" min={0} max={100} style={{ width: 80 }}
                  value={settings.pusher_special_chance_pct}
                  onChange={e => setInt("pusher_special_chance_pct", e.target.value)} />
                <span className="field-note">% 投出的硬幣是鑽石/飛機/跑車/神秘大獎，而非普通幣</span>
              </Row>
              <Row label="獎池提撥比例">
                <input type="number" min={0} max={100} style={{ width: 80 }}
                  value={settings.pusher_jackpot_rate}
                  onChange={e => setInt("pusher_jackpot_rate", e.target.value)} />
                <span className="field-note">% 的下注金額會存入大獎池（神秘大獎推下去才可領取）</span>
              </Row>
              <Row label="大獎池發放比例">
                <input type="number" min={1} max={100} style={{ width: 80 }}
                  value={settings.pusher_jackpot_payout_pct}
                  onChange={e => setInt("pusher_jackpot_payout_pct", e.target.value)} />
                <span className="field-note">% 觸發時發放，其餘留在池中滾存</span>
              </Row>
              <Row label="推板速度">
                <select value={settings.pusher_plate_speed}
                  onChange={e => setSettings(p => ({ ...p, pusher_plate_speed: e.target.value }))}>
                  <option value="slow">慢</option>
                  <option value="normal">正常</option>
                  <option value="fast">快</option>
                </select>
              </Row>
              <Row label="目標回收率 RTP">
                <input type="number" min={40} max={95} style={{ width: 80 }}
                  value={settings.pusher_target_rtp}
                  onChange={e => setInt("pusher_target_rtp", e.target.value)} />
                <span className="field-note">
                  %，40-95。系統會持續追蹤實際投入/回收比例，自動微調推板助推力，讓長期回收率收斂到這個數字
                  {settings.pusher_current_rtp != null && `（目前實際約 ${settings.pusher_current_rtp}%）`}
                </span>
              </Row>
            </section>

            {/* ─── 遊戲廳：21點 ────────────────────────────────── */}
            <section className="settings-section">
              <h4>
                🃏 {isApple ? "娛樂城" : "遊戲廳"}：21點
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.blackjack_enabled}
                    onChange={e => setBool("blackjack_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="開放時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="number" min={0} max={23} style={{ width: 56 }}
                    value={settings.blackjack_open_hour}
                    onChange={e => setInt("blackjack_open_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.blackjack_open_minute}
                    onChange={e => setInt("blackjack_open_minute", e.target.value)} />
                  <span>分 ～</span>
                  <input type="number" min={0} max={24} style={{ width: 56 }}
                    value={settings.blackjack_close_hour}
                    onChange={e => setInt("blackjack_close_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.blackjack_close_minute}
                    onChange={e => setInt("blackjack_close_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.8rem" }}>（24時 = 午夜）</span>
                </div>
              </Row>
              <Row label="下注上限">
                <input type="number" min={200} max={9999} style={{ width: 80 }}
                  value={settings.blackjack_max_bet}
                  onChange={e => setInt("blackjack_max_bet", e.target.value)} />
                <span className="field-note">個{currencyName}（最少 200）</span>
              </Row>
              <Row label="勝率偏向設定">
                <input type="number" min={1} max={200} style={{ width: 80 }}
                  value={settings.blackjack_house_edge}
                  onChange={e => setInt("blackjack_house_edge", e.target.value)} />
                <span className="field-note">1-200，100=中立，越大越偏莊，越小越偏玩家</span>
              </Row>
            </section>

            {/* ─── 遊戲廳：輪盤 ──────────────────────────── */}
            <section className="settings-section">
              <h4>
                🎰 {isApple ? "娛樂城" : "遊戲廳"}：{currencyName}輪盤
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.roulette_enabled}
                    onChange={e => setBool("roulette_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="開放時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="number" min={0} max={23} style={{ width: 56 }}
                    value={settings.roulette_open_hour}
                    onChange={e => setInt("roulette_open_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.roulette_open_minute}
                    onChange={e => setInt("roulette_open_minute", e.target.value)} />
                  <span>分 ～</span>
                  <input type="number" min={0} max={24} style={{ width: 56 }}
                    value={settings.roulette_close_hour}
                    onChange={e => setInt("roulette_close_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.roulette_close_minute}
                    onChange={e => setInt("roulette_close_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.8rem" }}>（24時 = 午夜）</span>
                </div>
              </Row>
              <Row label="單次最高下注">
                <input type="number" min={1} max={1000} style={{ width: 80 }}
                  value={settings.roulette_max_bet}
                  onChange={e => setInt("roulette_max_bet", e.target.value)} />
                <span className="field-note">個{currencyName}（最多可下注）</span>
              </Row>
              <Row label="勝率偏向設定">
                <input type="number" min={1} max={200} style={{ width: 80 }}
                  value={settings.roulette_house_edge}
                  onChange={e => setInt("roulette_house_edge", e.target.value)} />
                <span className="field-note">1-200，100=中立，越大越偏莊，越小越偏玩家</span>
              </Row>
            </section>

            {/* ─── 遊戲廳：骰寶 ────────────────────────────────── */}
            <section className="settings-section">
              <h4>
                🎲 {isApple ? "娛樂城" : "遊戲廳"}：骰寶
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.sicbo_enabled}
                    onChange={e => setBool("sicbo_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="開放時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="number" min={0} max={23} style={{ width: 56 }}
                    value={settings.sicbo_open_hour}
                    onChange={e => setInt("sicbo_open_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.sicbo_open_minute}
                    onChange={e => setInt("sicbo_open_minute", e.target.value)} />
                  <span>分 ～</span>
                  <input type="number" min={0} max={24} style={{ width: 56 }}
                    value={settings.sicbo_close_hour}
                    onChange={e => setInt("sicbo_close_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.sicbo_close_minute}
                    onChange={e => setInt("sicbo_close_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.8rem" }}>（24時 = 午夜）</span>
                </div>
              </Row>
              <Row label="單注上限">
                <input type="number" min={1} max={9999} style={{ width: 80 }}
                  value={settings.sicbo_max_bet}
                  onChange={e => setInt("sicbo_max_bet", e.target.value)} />
                <span className="field-note">個{currencyName}（每種投注類型最多可下注）</span>
              </Row>
              <Row label="勝率偏向設定">
                <input type="number" min={1} max={200} style={{ width: 80 }}
                  value={settings.sicbo_house_edge}
                  onChange={e => setInt("sicbo_house_edge", e.target.value)} />
                <span className="field-note">1-200，100=中立，越大越偏莊，越小越偏玩家</span>
              </Row>
            </section>

            {/* ─── 遊戲廳：老虎機 ──────────────────────────────── */}
            <section className="settings-section">
              <h4>
                🎰 {isApple ? "娛樂城" : "遊戲廳"}：老虎機
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.slot_enabled}
                    onChange={e => setBool("slot_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="開放時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="number" min={0} max={23} style={{ width: 56 }}
                    value={settings.slot_open_hour}
                    onChange={e => setInt("slot_open_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.slot_open_minute}
                    onChange={e => setInt("slot_open_minute", e.target.value)} />
                  <span>分 ～</span>
                  <input type="number" min={0} max={24} style={{ width: 56 }}
                    value={settings.slot_close_hour}
                    onChange={e => setInt("slot_close_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.slot_close_minute}
                    onChange={e => setInt("slot_close_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.8rem" }}>（24時 = 午夜）</span>
                </div>
              </Row>
              <Row label="單注上限">
                <input type="number" min={1} max={9999} style={{ width: 80 }}
                  value={settings.slot_max_bet}
                  onChange={e => setInt("slot_max_bet", e.target.value)} />
                <span className="field-note">個{currencyName}</span>
              </Row>
              <Row label="勝率偏向設定">
                <input type="number" min={1} max={200} style={{ width: 80 }}
                  value={settings.slot_house_edge}
                  onChange={e => setInt("slot_house_edge", e.target.value)} />
                <span className="field-note">1-200，100=中立，越大越偏莊，越小越偏玩家</span>
              </Row>
            </section>

            {/* ─── 遊戲廳：百家樂 ──────────────────────────────── */}
            <section className="settings-section">
              <h4>
                🀄 {isApple ? "娛樂城" : "遊戲廳"}：百家樂
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.baccarat_enabled}
                    onChange={e => setBool("baccarat_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="開放時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="number" min={0} max={23} style={{ width: 56 }}
                    value={settings.baccarat_open_hour}
                    onChange={e => setInt("baccarat_open_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.baccarat_open_minute}
                    onChange={e => setInt("baccarat_open_minute", e.target.value)} />
                  <span>分 ～</span>
                  <input type="number" min={0} max={24} style={{ width: 56 }}
                    value={settings.baccarat_close_hour}
                    onChange={e => setInt("baccarat_close_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.baccarat_close_minute}
                    onChange={e => setInt("baccarat_close_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.8rem" }}>（24時 = 午夜）</span>
                </div>
              </Row>
              <Row label="單注上限">
                <input type="number" min={1} max={9999} style={{ width: 80 }}
                  value={settings.baccarat_max_bet}
                  onChange={e => setInt("baccarat_max_bet", e.target.value)} />
                <span className="field-note">個{currencyName}</span>
              </Row>
              <Row label="勝率偏向設定">
                <input type="number" min={1} max={200} style={{ width: 80 }}
                  value={settings.baccarat_house_edge}
                  onChange={e => setInt("baccarat_house_edge", e.target.value)} />
                <span className="field-note">1-200，100=中立，越大越偏莊，越小越偏玩家</span>
              </Row>
              <Row label="Lucky 6 側注">
                <label className="toggle-label" style={{ fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.baccarat_lucky6_enabled}
                    onChange={e => setBool("baccarat_lucky6_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
                <span className="field-note">莊家 6 點獲勝才賠：2 張牌 1 賠 12，3 張牌 1 賠 20（跟主注同一副牌結算，也受上面的勝率偏向設定影響）</span>
              </Row>
            </section>

            {/* ─── 遊戲廳：賽車 ──────────────────────────────── */}
            <section className="settings-section">
              <h4>
                🏎️ {isApple ? "娛樂城" : "遊戲廳"}：賽車
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.race_enabled}
                    onChange={e => setBool("race_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="開放時間（台灣時間）">
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="number" min={0} max={23} style={{ width: 56 }}
                    value={settings.race_open_hour}
                    onChange={e => setInt("race_open_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.race_open_minute}
                    onChange={e => setInt("race_open_minute", e.target.value)} />
                  <span>分 ～</span>
                  <input type="number" min={0} max={24} style={{ width: 56 }}
                    value={settings.race_close_hour}
                    onChange={e => setInt("race_close_hour", e.target.value)} />
                  <span>時</span>
                  <input type="number" min={0} max={59} style={{ width: 56 }}
                    value={settings.race_close_minute}
                    onChange={e => setInt("race_close_minute", e.target.value)} />
                  <span>分</span>
                  <span style={{ color: "#aaa", fontSize: "0.8rem" }}>（24時 = 午夜）</span>
                </div>
              </Row>
              <Row label="單注上限">
                <input type="number" min={1} max={9999} style={{ width: 80 }}
                  value={settings.race_max_bet}
                  onChange={e => setInt("race_max_bet", e.target.value)} />
                <span className="field-note">個{currencyName}（5 台車，中獎 1 賠 4）</span>
              </Row>
              <Row label="勝率偏向設定">
                <input type="number" min={1} max={200} style={{ width: 80 }}
                  value={settings.race_house_edge}
                  onChange={e => setInt("race_house_edge", e.target.value)} />
                <span className="field-note">1-200，100=中立，越大越偏莊，越小越偏玩家</span>
              </Row>
            </section>

            {/* ─── 遊戲廳：殭屍生存戰 ──────────────────────────── */}
            <section className="settings-section">
              <h4>
                🧟 {isApple ? "娛樂城" : "遊戲廳"}：殭屍生存戰
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.zombie_enabled}
                    onChange={e => setBool("zombie_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>

              <Row label="入場費用">
                <input type="number" min={0} max={9999} style={{ width: 80 }}
                  value={settings.zombie_entry_cost}
                  onChange={e => setInt("zombie_entry_cost", e.target.value)} />
                <span className="field-note">個{currencyName}（每次挑戰扣一次，不分關卡）</span>
              </Row>
              <Row label="每關過關獎勵">
                <input type="number" min={0} max={9999} style={{ width: 80 }}
                  value={settings.zombie_level_reward}
                  onChange={e => setInt("zombie_level_reward", e.target.value)} />
                <span className="field-note">個{currencyName}（共 3 關，全破最多 ×3）</span>
              </Row>
              <Row label="每日挑戰次數上限">
                <input type="number" min={1} max={99} style={{ width: 80 }}
                  value={settings.zombie_daily_limit}
                  onChange={e => setInt("zombie_daily_limit", e.target.value)} />
                <span className="field-note">次（不論成功或失敗都算一次）</span>
              </Row>
            </section>

            {/* ─── 休閒廳：麻將 ──────────────────────────── */}
            <section className="settings-section">
              <h4>
                🀄 休閒廳：麻將
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.mahjong_enabled}
                    onChange={e => setBool("mahjong_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>
              <p className="field-note" style={{ margin: 0 }}>
                關閉後，遊戲廳分頁列表會直接移除麻將，不是灰掉停用——需要重新整理頁面才會套用。
              </p>
            </section>

            {/* ─── 休閒廳：大老二 ──────────────────────────── */}
            <section className="settings-section">
              <h4>
                🃏 休閒廳：大老二
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.bigtwo_enabled}
                    onChange={e => setBool("bigtwo_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>
              <p className="field-note" style={{ margin: 0 }}>
                關閉後，遊戲廳分頁列表會直接移除大老二，不是灰掉停用——需要重新整理頁面才會套用。
              </p>
            </section>

            {/* ─── 休閒廳：象棋 ──────────────────────────── */}
            <section className="settings-section">
              <h4>
                ♟️ 休閒廳：象棋
                <label className="toggle-label" style={{ float: "right", fontWeight: "normal" }}>
                  <input type="checkbox" checked={!!settings.xiangqi_enabled}
                    onChange={e => setBool("xiangqi_enabled", e.target.checked)} />
                  {" "}啟用
                </label>
              </h4>
              <p className="field-note" style={{ margin: 0 }}>
                關閉後，遊戲廳分頁列表會直接移除象棋，不是灰掉停用——需要重新整理頁面才會套用。
              </p>
            </section>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
                {saving ? "儲存中…" : "儲存設定"}
              </button>
              <button onClick={onClose}>關閉</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── 列布局小元件 ─────────────────────────────────────────────── */
function Row({ label, children }) {
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <span className="settings-control">{children}</span>
    </div>
  );
}
