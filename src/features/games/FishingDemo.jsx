import { useEffect, useRef, useState } from "react";
import FishingGame from "./FishingGame";

// /fishing-demo：純前端假資料展示捕魚彈窗（不連後端），方便單獨調整畫面與特效。
// 假 socket 在前端模擬後端 fishingGame.js 的行為：生魚、扣傷害、尾刀派彩、BOSS。
// ?boss=1 一打開就召喚 BOSS；?auto=1 自動對隨機的魚開竿（看打擊特效用）。
const FISH = [
  { key: "clownfish", name: "小丑魚", emoji: "🐠", tier: "small", min: 1.2, max: 2, w: 30 },
  { key: "puffer", name: "河豚", emoji: "🐡", tier: "small", min: 2, max: 3, w: 24 },
  { key: "turtle", name: "海龜", emoji: "🐢", tier: "small", min: 3, max: 5, w: 18 },
  { key: "swordfish", name: "劍魚", emoji: "🐟", tier: "mid", min: 8, max: 12, w: 9 },
  { key: "octopus", name: "章魚", emoji: "🐙", tier: "mid", min: 10, max: 15, w: 7 },
  { key: "shark", name: "大白鯊", emoji: "🦈", tier: "large", min: 20, max: 40, w: 2.5 },
  { key: "whale", name: "藍鯨", emoji: "🐋", tier: "large", min: 30, max: 50, w: 1.5 },
];
const BETS = [100, 500, 1000, 5000, 10000];
const BOSSES = [
  { tierLabel: "一級", name: "巨型魷魚王", emoji: "🦑", threshold: 5000, hp: 100, payoutPct: 20 },
  { tierLabel: "二級", name: "鋼牙鱷王", emoji: "🐊", threshold: 20000, hp: 300, payoutPct: 30 },
  { tierLabel: "三級", name: "遠古海龍", emoji: "🦖", threshold: 50000, hp: 800, payoutPct: 50 },
  { tierLabel: "終極", name: "黃金巨龍", emoji: "🐉", threshold: 100000, hp: 1500, payoutPct: 80 },
];
const nextBossOf = (i) => ({ tier: i, ...BOSSES[i] });
const rand = (a, b) => a + Math.random() * (b - a);

function createFakeServer(me) {
  const listeners = {};
  const fire = (ev, p) => (listeners[ev] || []).forEach((cb) => cb(p));
  const fish = new Map();
  let seq = 0, pool = 42000, boss = null, timer = null, nextTier = 0;
  const spawn = () => {
    const now = Date.now();
    for (const [id, f] of fish) if (now > f.spawnAt + f.duration) fish.delete(id);
    if (fish.size < 12) {
      const total = FISH.reduce((s, t) => s + t.w, 0);
      let r = Math.random() * total, t = FISH[0];
      for (const x of FISH) { r -= x.w; if (r <= 0) { t = x; break; } }
      const mult = Math.round(rand(t.min, t.max) * 10) / 10;
      const d = t.tier === "large" ? rand(15000, 19000) : t.tier === "mid" ? rand(12000, 15000) : rand(9000, 12000);
      const f = { id: `f${++seq}`, key: t.key, name: t.name, emoji: t.emoji, tier: t.tier, mult, hp: 1, maxHp: 1, hits: 0,
        spawnAt: now, duration: Math.round(d), dir: Math.random() < 0.5 ? 1 : -1,
        y: Math.round(rand(t.tier === "large" ? 22 : 12, t.tier === "large" ? 70 : 82)), amp: Math.round(rand(2, 7)) };
      fish.set(f.id, f);
      fire("fishingSpawn", { fish: f, serverNow: now });
    }
    timer = setTimeout(spawn, rand(700, 1200));
  };
  const summon = () => {
    if (boss) return;
    const b = BOSSES[nextTier];
    boss = { id: "boss", name: b.name, emoji: b.emoji, tier: nextTier, tierLabel: b.tierLabel, payoutPct: b.payoutPct,
      hp: b.hp * 10, maxHp: b.hp * 10, spawnAt: Date.now() };
    fire("fishingBossSpawn", { boss, pool });
  };
  const shoot = ({ fishId, rod, useBait }) => {
    const target = fishId === "boss" ? boss : fish.get(fishId);
    if (!target) return;
    const bet = BETS[useBait ? 0 : rod];
    pool += Math.floor(bet * 0.3);
    // 跟後端一致：BOSS 扣血；一般魚沒有血量，每竿獨立判定（機率 = 回饋率 60% × 竿係數 ÷ 倍率）
    let dmg = 0;
    if (fishId === "boss") {
      dmg = Math.round(10 * (bet / BETS[0]) * rand(0.6, 1.4));
      target.hp = Math.max(0, target.hp - dmg);
    } else {
      target.hits = (target.hits || 0) + 1;
      if (Math.random() < Math.min(1, (0.6 * [1, 1.05, 1.1, 1.2, 1.25][rod]) / target.mult)) target.hp = 0;
    }
    fire("fishingHit", { fishId, shooter: me, damage: dmg, hp: target.hp, maxHp: target.maxHp, rod, pool });
    fire("fishingShotAck", {});
    if (target.hp <= 0) {
      let payout;
      const isBoss = fishId === "boss";
      if (isBoss) { payout = Math.floor((pool * boss.payoutPct) / 100); pool -= payout; nextTier = (boss.tier + 1) % 4; boss = null; }
      else { payout = Math.round(bet * target.mult); fish.delete(fishId); }
      fire("fishingCatch", { fishId, shooter: me, payout, isBoss, name: target.name, emoji: target.emoji, mult: target.mult,
        tier: isBoss ? "boss" : target.tier, pool, nextBoss: isBoss ? nextBossOf(nextTier) : undefined,
        crit: !isBoss && target.tier !== "small" && target.hits <= Math.max(1, Math.round(target.mult / 5)), hits: target.hits });
    }
  };
  return {
    on(ev, cb) { (listeners[ev] ||= []).push(cb); },
    off(ev, cb) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== cb); },
    emit(ev, p) {
      if (ev === "fishingJoin") {
        setTimeout(() => {
          fire("fishingSnapshot", { serverNow: Date.now(), fish: [], boss, pool, rodBets: BETS,
            rodNames: ["初級竿", "中級竿", "高級竿", "王者竿", "帝王神竿"], nextBoss: nextBossOf(nextTier),
            freeShots: 3, canSummon: true, canResetPool: true, seedPool: 10000 });
          if (!timer) spawn();
          if (new URLSearchParams(window.location.search).get("boss") === "1") setTimeout(summon, 400);
        }, 100);
      }
      if (ev === "fishingLeave") { clearTimeout(timer); timer = null; }
      if (ev === "fishingShoot") shoot(p);
      if (ev === "fishingSummonBoss") summon();
      if (ev === "fishingResetPool") { pool = 10000; nextTier = 0; fire("fishingPool", { pool }); }
    },
  };
}

export default function FishingDemo() {
  const [open, setOpen] = useState(true);
  const [apples, setApples] = useState(999999);
  const socketRef = useRef(null);
  if (!socketRef.current) socketRef.current = createFakeServer("小明");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("auto") !== "1") return;
    const t = setInterval(() => {
      const targets = document.querySelectorAll(".fg-boss, .fg-fish");
      const el = targets[Math.floor(Math.random() * targets.length)];
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    }, 220);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ minHeight: "100vh", background: "#222", color: "#fff", padding: 16 }}>
      <button onClick={() => setOpen((v) => !v)}>🎣 捕魚（demo）</button>
      <span style={{ marginLeft: 12 }}>金幣：{apples}</span>
      <FishingGame socket={socketRef.current} token="demo" name="小明" apples={apples}
        setApples={setApples} open={open} onOpenChange={setOpen} demo />
    </div>
  );
}
