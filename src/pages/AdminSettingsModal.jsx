import { useEffect, useState } from "react";
import "./AdminSettingsModal.css";

const DEFAULT = {
  daily_login_reward:   1,
  singing_reward:       2,
  per_transfer_limit:   0,
  daily_transfer_limit: 0,
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
  roulette_enabled:          true,
  roulette_open_hour:        13,
  roulette_open_minute:      0,
  roulette_close_hour:       24,
  roulette_close_minute:     0,
  roulette_num_multiplier:   36,
  roulette_bh_multiplier:    2,
  roulette_combo_multiplier: 4,
  roulette_max_bet:          50,
  blackjack_enabled:         true,
  blackjack_open_hour:       0,
  blackjack_open_minute:     0,
  blackjack_close_hour:      24,
  blackjack_close_minute:    0,
  blackjack_max_bet:         200,
};

export default function AdminSettingsModal({ open, onClose, token, BACKEND }) {
  const [settings, setSettings] = useState(DEFAULT);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  /* ─── 讀取設定 ───────────────────────────────────────────────── */
  const fetchSettings = async () => {
    try {
      const res  = await fetch(`${BACKEND}/admin/settings`, {
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
        body: JSON.stringify(settings),
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

  if (!open) return null;

  const pad2 = n => String(n).padStart(2, "0");
  const fmtTime = (h, m) => `${pad2(h)}:${pad2(m)}`;

  return (
    <div className="apple-modal">
      <div className="apple-modal-content" style={{ width: 460, maxHeight: "90vh", overflowY: "auto" }}>
        <h3>⚙️ 金蘋果設定</h3>

        {loading ? <div>讀取中…</div> : (
          <>
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
              <Row label="單筆轉帳上限">
                <input type="number" value={settings.per_transfer_limit}
                  onChange={e => setInt("per_transfer_limit", e.target.value)} />
              </Row>
              <Row label="每日轉帳上限">
                <input type="number" value={settings.daily_transfer_limit}
                  onChange={e => setInt("daily_transfer_limit", e.target.value)} />
              </Row>
              <Row label="每日樂透獎勵">
                <input type="number" value={settings.surprise_reward}
                  onChange={e => setInt("surprise_reward", e.target.value)} />
              </Row>
            </section>

            {/* ─── 遊戲一：多顆金蘋果 ────────────────────────────── */}
            <section className="settings-section">
              <h4>
                🍎 遊戲一：撈金蘋果（多顆模式）
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
              <Row label="金蘋果數量">
                <input type="number" min={1} max={50} value={settings.game1_apple_count}
                  onChange={e => setInt("game1_apple_count", e.target.value)} />
                <span className="field-note">顆（同時顯示在螢幕）</span>
              </Row>
              <Row label="每顆獎勵">
                <input type="number" min={1} value={settings.game1_reward}
                  onChange={e => setInt("game1_reward", e.target.value)} />
                <span className="field-note">個金蘋果</span>
              </Row>
              <Row label="蘋果速度（px/幀）">
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

            {/* ─── 遊戲二：一顆大金蘋果 ──────────────────────────── */}
            <section className="settings-section">
              <h4>
                🔥 遊戲二：搶金蘋果（第一個點到即結束）
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
                <span className="field-note">個金蘋果（第一個搶到即得，無時間限制）</span>
              </Row>
              <Row label="蘋果速度（px/幀）">
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

            {/* ─── 遊戲三：打金蘋果（打地鼠） ────────────────────── */}
            <section className="settings-section">
              <h4>
                🔨 遊戲三：打金蘋果（打地鼠風格）
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
                <span className="field-note">個金蘋果（打一顆算一次）</span>
              </Row>
              <Row label="蘋果可見時間（ms）">
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
              <Row label="同時蘋果顆數">
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

            {/* ─── 遊戲四：夾蘋果機 ───────────────────────────────── */}
            <section className="settings-section">
              <h4>
                🎰 遊戲四：夾蘋果機（夾娃娃機風格）
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
                <span className="field-note">個金蘋果</span>
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
              <Row label="場內蘋果數量">
                <input type="number" min={1} max={40} style={{ width: 80 }}
                  value={settings.claw_apple_count}
                  onChange={e => setInt("claw_apple_count", e.target.value)} />
                <span className="field-note">顆（1–40，越多越滿）</span>
              </Row>
            </section>

            {/* ─── 娛樂城：金蘋果輪盤 ──────────────────────────── */}
            <section className="settings-section">
              <h4>
                🎰 娛樂城：金蘋果輪盤
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
                <span className="field-note">個金蘋果（最多可下注）</span>
              </Row>
            </section>

            {/* ─── 娛樂城：21點 ────────────────────────────────── */}
            <section className="settings-section">
              <h4>
                🃏 娛樂城：21點
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
                <span className="field-note">個金蘋果（最少 200）</span>
              </Row>
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
