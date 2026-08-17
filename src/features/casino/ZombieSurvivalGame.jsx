import { useCallback, useEffect, useRef, useState } from "react";
import "./ZombieSurvivalGame.css";
import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";

const WIDTH = 960;
const HEIGHT = 640;
const PLAYER_RADIUS = 18;
const MAX_LEVELS = 3;

const BASE_MONSTER_SPEED = 0.72;

const LEVELS = [
  { name: "第一關", duration: 28, spawnEvery: 980, monsterHp: 18, monsterSpeed: BASE_MONSTER_SPEED * 1, monsterDamage: 7, maxMonsters: 28 },
  { name: "第二關", duration: 34, spawnEvery: 760, monsterHp: 28, monsterSpeed: BASE_MONSTER_SPEED * 2, monsterDamage: 9, maxMonsters: 38 },
  { name: "第三關", duration: 42, spawnEvery: 560, monsterHp: 42, monsterSpeed: BASE_MONSTER_SPEED * 3, monsterDamage: 12, maxMonsters: 52 },
];

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function freshPlayer() {
  return {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    targetX: WIDTH / 2,
    targetY: HEIGHT / 2,
    radius: PLAYER_RADIUS,
    speed: 3.15,
  };
}

function spawnMonster(level) {
  const side = Math.floor(Math.random() * 4);
  let x;
  let y;
  if (side === 0) {
    x = rand(40, WIDTH - 40);
    y = -30;
  } else if (side === 1) {
    x = WIDTH + 30;
    y = rand(40, HEIGHT - 40);
  } else if (side === 2) {
    x = rand(40, WIDTH - 40);
    y = HEIGHT + 30;
  } else {
    x = -30;
    y = rand(40, HEIGHT - 40);
  }

  const elite = Math.random() < 0.12 + level * 0.04;
  const hp = LEVELS[level].monsterHp * (elite ? 2.3 : 1);
  return {
    id: makeId(),
    x,
    y,
    hp,
    maxHp: hp,
    radius: elite ? 19 : 14,
    speed: LEVELS[level].monsterSpeed * (elite ? 0.72 : 1),
    damage: LEVELS[level].monsterDamage * (elite ? 1.6 : 1),
    elite,
    wobble: Math.random() * Math.PI * 2,
  };
}

function makePickup(x, y) {
  const roll = Math.random();
  if (roll < 0.42) return { id: makeId(), x, y, type: "power", label: "攻擊+", color: "#ffd166", radius: 11 };
  if (roll < 0.72) return { id: makeId(), x, y, type: "speed", label: "攻速+", color: "#7bf1ff", radius: 11 };
  return { id: makeId(), x, y, type: "burst", label: "散射", color: "#ff80df", radius: 11 };
}

function initialGame() {
  return {
    running: false,
    won: false,
    gameOver: false,
    waitingNextLevel: false,
    level: 0,
    elapsed: 0,
    hp: 100,
    maxHp: 100,
    power: 12,
    fireDelay: 430,
    burst: 1,
    kills: 0,
    player: freshPlayer(),
    monsters: [],
    bullets: [],
    pickups: [],
    effects: [],
    lastShot: 0,
    lastSpawn: 0,
    invulnerable: 0,
    message: "點開始進入第一關",
  };
}

export default function ZombieSurvivalGame({ token, apples, onApplesChange, demo = false }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(initialGame());
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const [hud, setHud] = useState(gameRef.current);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const runIdRef = useRef(null);
  const finishSentRef = useRef(false);
  const startingRef = useRef(false);
  const currencyIcon = `/gifts/${roomConfig.currency_icon}`;

  useEffect(() => {
    if (demo) {
      setSettings({ zombie_enabled: true, zombie_entry_cost: 0, zombie_level_reward: 15, zombie_daily_limit: Infinity, attemptsUsedToday: 0 });
      return;
    }
    if (!token) return;
    fetch(`${BACKEND}/api/zombie/settings?room=${RN}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(setSettings)
      .catch(() => setSettings({ zombie_enabled: true, zombie_entry_cost: 10, zombie_level_reward: 15, zombie_daily_limit: 3, attemptsUsedToday: 0 }));
  }, [demo, token]);

  const syncHud = useCallback(() => {
    const g = gameRef.current;
    setHud({
      running: g.running,
      won: g.won,
      gameOver: g.gameOver,
      waitingNextLevel: g.waitingNextLevel,
      level: g.level,
      elapsed: g.elapsed,
      hp: g.hp,
      maxHp: g.maxHp,
      power: g.power,
      fireDelay: g.fireDelay,
      burst: g.burst,
      kills: g.kills,
      player: g.player,
      monsters: g.monsters,
      bullets: g.bullets,
      pickups: g.pickups,
      message: g.message,
    });
  }, []);

  // 一場挑戰只在「全新開始」時收一次入場費，同一場往下一關不再重複扣款
  const startLevel = useCallback(async () => {
    if (startingRef.current) return;
    const current = gameRef.current;
    const restarting = current.gameOver || current.won || (!current.running && current.level === 0 && !current.waitingNextLevel);

    if (restarting) {
      if (!settings?.zombie_enabled) return;
      if (!demo) {
        if ((settings.attemptsUsedToday ?? 0) >= (settings.zombie_daily_limit ?? 3)) {
          setError(`今日挑戰次數已用完（${settings.zombie_daily_limit}/${settings.zombie_daily_limit}）`);
          return;
        }
        if ((apples ?? 0) < (settings.zombie_entry_cost ?? 0)) {
          setError(`${roomConfig.currency_name}不足`);
          return;
        }
        startingRef.current = true;
        try {
          const res = await fetch(`${BACKEND}/api/zombie/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ room: RN }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "開始失敗");
            startingRef.current = false;
            return;
          }
          setError("");
          runIdRef.current = data.runId;
          finishSentRef.current = false;
          if (onApplesChange) onApplesChange(data.newApples);
          setSettings(s => ({ ...s, attemptsUsedToday: data.attemptsUsedToday }));
        } catch {
          setError("連線失敗，請重試");
          startingRef.current = false;
          return;
        }
        startingRef.current = false;
      } else {
        runIdRef.current = null;
        finishSentRef.current = true;
      }
    }

    const base = restarting ? initialGame() : current;
    const nextLevel = restarting ? 0 : current.level;

    gameRef.current = {
      ...base,
      running: true,
      won: false,
      gameOver: false,
      waitingNextLevel: false,
      level: nextLevel,
      elapsed: 0,
      hp: restarting ? 100 : clamp(base.hp + 12, 1, base.maxHp),
      player: { ...base.player, targetX: base.player.x, targetY: base.player.y },
      monsters: [],
      bullets: [],
      pickups: restarting ? [] : base.pickups,
      effects: [],
      lastShot: 0,
      lastSpawn: 0,
      invulnerable: 500,
      message: `${LEVELS[nextLevel].name} 開始`,
    };
    syncHud();
  }, [settings, apples, token, onApplesChange, syncHud, demo]);

  // 挑戰結束（過關三次或死亡）時，回報通關關卡數領取獎勵，一場只送一次
  useEffect(() => {
    if (!hud.gameOver && !hud.won) return;
    if (finishSentRef.current || !runIdRef.current) return;
    finishSentRef.current = true;
    const levelsCleared = hud.won ? MAX_LEVELS : hud.level;
    const runId = runIdRef.current;
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/api/zombie/finish`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ runId, levelsCleared, room: RN }),
        });
        const data = await res.json();
        if (res.ok && onApplesChange) onApplesChange(data.newApples);
      } catch {
        /* 忽略，餘額仍以伺服器為準，下次刷新可修正 */
      }
    })();
  }, [hud.gameOver, hud.won, hud.level, token, onApplesChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    function canvasPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    }

    function setMoveTarget(event) {
      const g = gameRef.current;
      if (!g.running) return;
      const p = canvasPoint(event);
      g.player.targetX = clamp(p.x, PLAYER_RADIUS, WIDTH - PLAYER_RADIUS);
      g.player.targetY = clamp(p.y, PLAYER_RADIUS, HEIGHT - PLAYER_RADIUS);
      g.effects.push({ x: g.player.targetX, y: g.player.targetY, text: "移動", life: 22, color: "#7bf1ff" });
    }

    const handlePointerMove = (event) => {
      if (event.buttons === 1) setMoveTarget(event);
    };
    canvas.addEventListener("pointerdown", setMoveTarget);
    canvas.addEventListener("pointermove", handlePointerMove);

    function updatePlayer(g, dt) {
      const player = g.player;
      const dx = player.targetX - player.x;
      const dy = player.targetY - player.y;
      const len = Math.hypot(dx, dy);
      if (len < 2) return;
      const step = Math.min(len, player.speed * (dt / 16.6667));
      player.x += (dx / len) * step;
      player.y += (dy / len) * step;
    }

    function shoot(g, now) {
      if (now - g.lastShot < g.fireDelay || !g.monsters.length) return;
      const player = g.player;
      const nearest = g.monsters.reduce((best, monster) => (
        !best || distance(monster, player) < distance(best, player) ? monster : best
      ), null);
      if (!nearest) return;
      g.lastShot = now;

      const baseAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      const spread = g.burst === 1 ? [0] : g.burst === 2 ? [-0.13, 0.13] : [-0.18, 0, 0.18];
      for (const offset of spread) {
        const angle = baseAngle + offset;
        g.bullets.push({
          id: makeId(),
          x: player.x,
          y: player.y,
          vx: Math.cos(angle) * 8.4,
          vy: Math.sin(angle) * 8.4,
          radius: 5,
          damage: g.power,
          life: 86,
        });
      }
    }

    function clearLevel(g) {
      g.running = false;
      g.bullets = [];
      g.monsters = [];
      g.pickups = [];

      if (g.level >= LEVELS.length - 1) {
        g.won = true;
        g.message = "三關全破！";
      } else {
        g.level += 1;
        g.elapsed = 0;
        g.waitingNextLevel = true;
        g.message = `過關！準備 ${LEVELS[g.level].name}`;
      }
    }

    function update(g, dt, now) {
      if (!g.running) return;
      const levelCfg = LEVELS[g.level];
      g.elapsed += dt / 1000;
      g.invulnerable = Math.max(0, g.invulnerable - dt);
      updatePlayer(g, dt);

      if (now - g.lastSpawn > levelCfg.spawnEvery && g.monsters.length < levelCfg.maxMonsters) {
        g.lastSpawn = now;
        const packSize = 1 + Math.floor(g.level * 0.8) + (Math.random() < 0.22 ? 1 : 0);
        for (let i = 0; i < packSize; i += 1) g.monsters.push(spawnMonster(g.level));
      }

      shoot(g, now);

      for (const monster of g.monsters) {
        monster.wobble += dt * 0.004;
        const angle = Math.atan2(g.player.y - monster.y, g.player.x - monster.x) + Math.sin(monster.wobble) * 0.09;
        monster.x += Math.cos(angle) * monster.speed * (dt / 16.6667);
        monster.y += Math.sin(angle) * monster.speed * (dt / 16.6667);
        if (distance(monster, g.player) < monster.radius + g.player.radius && g.invulnerable <= 0) {
          g.hp = 0;
          g.effects.push({ x: g.player.x, y: g.player.y, text: "死亡", life: 42, color: "#ff6b6b" });
        }
      }

      for (const bullet of g.bullets) {
        bullet.x += bullet.vx * (dt / 16.6667);
        bullet.y += bullet.vy * (dt / 16.6667);
        bullet.life -= dt / 16.6667;
      }

      const remainingBullets = [];
      for (const bullet of g.bullets) {
        let hit = false;
        for (const monster of g.monsters) {
          if (distance(bullet, monster) < bullet.radius + monster.radius) {
            monster.hp -= bullet.damage;
            hit = true;
            g.effects.push({ x: monster.x, y: monster.y, text: "hit", life: 18, color: "#ffd166" });
            break;
          }
        }
        if (!hit && bullet.life > 0 && bullet.x > -20 && bullet.x < WIDTH + 20 && bullet.y > -20 && bullet.y < HEIGHT + 20) {
          remainingBullets.push(bullet);
        }
      }
      g.bullets = remainingBullets;

      const alive = [];
      for (const monster of g.monsters) {
        if (monster.hp <= 0) {
          g.kills += 1;
          g.effects.push({ x: monster.x, y: monster.y, text: "+1", life: 34, color: "#ffffff" });
          if (Math.random() < 0.24) g.pickups.push(makePickup(monster.x, monster.y));
        } else {
          alive.push(monster);
        }
      }
      g.monsters = alive;

      const keptPickups = [];
      for (const pickup of g.pickups) {
        if (distance(pickup, g.player) < g.player.radius + pickup.radius + 6) {
          if (pickup.type === "power") g.power += 4;
          if (pickup.type === "speed") g.fireDelay = Math.max(180, g.fireDelay - 42);
          if (pickup.type === "burst") g.burst = Math.min(3, g.burst + 1);
          g.effects.push({ x: pickup.x, y: pickup.y, text: pickup.label, life: 52, color: pickup.color });
        } else {
          keptPickups.push(pickup);
        }
      }
      g.pickups = keptPickups;

      for (const effect of g.effects) {
        effect.y -= 0.45 * (dt / 16.6667);
        effect.life -= dt / 16.6667;
      }
      g.effects = g.effects.filter((effect) => effect.life > 0);

      if (g.hp <= 0) {
        g.running = false;
        g.gameOver = true;
        g.waitingNextLevel = false;
        g.message = "被包圍了，挑戰失敗";
        return;
      }

      if (g.elapsed >= levelCfg.duration) clearLevel(g);
    }

    function drawGrid(g) {
      ctx.fillStyle = "#101615";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = "rgba(125, 255, 180, 0.055)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
      }
      const vignette = ctx.createRadialGradient(g.player.x, g.player.y, 60, g.player.x, g.player.y, 520);
      vignette.addColorStop(0, "rgba(70, 120, 90, 0.1)");
      vignette.addColorStop(1, "rgba(0, 0, 0, 0.62)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    function drawPlayer(g) {
      const player = g.player;
      ctx.save();
      ctx.strokeStyle = "rgba(123, 241, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.targetX, player.targetY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.translate(player.x, player.y);
      ctx.fillStyle = g.invulnerable > 0 ? "#ffffff" : "#7bdff2";
      ctx.shadowColor = "#7bdff2";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#102029";
      ctx.fillRect(-5, -24, 10, 20);
      ctx.fillRect(-22, -2, 44, 6);
      ctx.restore();
    }

    function draw(g) {
      drawGrid(g);
      drawPlayer(g);

      for (const pickup of g.pickups) {
        ctx.fillStyle = pickup.color;
        ctx.shadowColor = pickup.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (const bullet of g.bullets) {
        ctx.fillStyle = "#ffe66d";
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const monster of g.monsters) {
        const hpPct = clamp(monster.hp / monster.maxHp, 0, 1);
        ctx.fillStyle = monster.elite ? "#b02a4b" : "#3fb950";
        ctx.shadowColor = monster.elite ? "#ff4d6d" : "#3fb950";
        ctx.shadowBlur = monster.elite ? 14 : 8;
        ctx.beginPath();
        ctx.arc(monster.x, monster.y, monster.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#101615";
        ctx.beginPath();
        ctx.arc(monster.x - monster.radius * 0.35, monster.y - 3, 3, 0, Math.PI * 2);
        ctx.arc(monster.x + monster.radius * 0.35, monster.y - 3, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fillRect(monster.x - monster.radius, monster.y - monster.radius - 9, monster.radius * 2, 4);
        ctx.fillStyle = "#ffdd57";
        ctx.fillRect(monster.x - monster.radius, monster.y - monster.radius - 9, monster.radius * 2 * hpPct, 4);
      }

      for (const effect of g.effects) {
        ctx.globalAlpha = clamp(effect.life / 34, 0, 1);
        ctx.fillStyle = effect.color;
        ctx.font = "700 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(effect.text, effect.x, effect.y);
      }
      ctx.globalAlpha = 1;

      if (!g.running) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.46)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#fff3b0";
        ctx.font = "800 34px Arial";
        ctx.textAlign = "center";
        ctx.fillText(g.message, WIDTH / 2, HEIGHT / 2 - 14);
        ctx.font = "600 22px Arial";
        ctx.fillStyle = "#d9e7d6";
        ctx.fillText("點擊場地可移動角色，自動攻擊最近的殭屍。", WIDTH / 2, HEIGHT / 2 + 28);
      }
    }

    function loop(now) {
      const g = gameRef.current;
      const dt = Math.min(34, now - (lastTimeRef.current || now));
      lastTimeRef.current = now;
      update(g, dt, now);
      draw(g);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    const hudTimer = setInterval(syncHud, 120);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(hudTimer);
      canvas.removeEventListener("pointerdown", setMoveTarget);
      canvas.removeEventListener("pointermove", handlePointerMove);
    };
  }, [syncHud, !!settings]);

  if (!settings) return <div className="zombie-loading">載入中…</div>;

  if (!settings.zombie_enabled) {
    return (
      <div className="zombie-closed">
        <div className="zombie-closed-icon">🧟</div>
        <div className="zombie-closed-text">殭屍生存戰目前未開放</div>
      </div>
    );
  }

  const levelCfg = LEVELS[hud.level] || LEVELS[0];
  const stageProgress = clamp((hud.elapsed || 0) / levelCfg.duration, 0, 1);
  const hpPct = clamp((hud.hp || 0) / (hud.maxHp || 100), 0, 1);
  const attemptsLeft = Math.max(0, (settings.zombie_daily_limit ?? 3) - (settings.attemptsUsedToday ?? 0));
  const entryCost = settings.zombie_entry_cost ?? 10;
  const canStartFresh = attemptsLeft > 0 && (apples ?? 0) >= entryCost;
  const costSuffix = demo ? "" : ` -${entryCost}`;
  const startLabel = hud.running
    ? "戰鬥中"
    : hud.waitingNextLevel
      ? `開始${LEVELS[hud.level]?.name || "下一關"}`
      : hud.gameOver || hud.won
        ? `重新挑戰第一關${costSuffix}`
        : `開始第一關${costSuffix}`;
  const startDisabled = hud.running || (!hud.waitingNextLevel && !canStartFresh);

  return (
    <div className="zombie-game">
      <div className="zombie-game-header">
        <div>
          <h1>🧟 殭屍生存戰</h1>
          <p>點擊場地移動角色，人物會自動攻擊最近怪物。走到道具上才能拾取升級。</p>
        </div>
        <div className="zombie-wallet">
          {demo ? (
            <small>🎮 試玩模式（不扣款、不限次數）</small>
          ) : (
            <>
              <span><img src={currencyIcon} alt="" className="zombie-apple-icon" />{apples ?? 0}</span>
              <small>今日剩餘次數：{attemptsLeft} / {settings.zombie_daily_limit ?? 3}</small>
            </>
          )}
        </div>
      </div>

      {error && <div className="zombie-error-msg">{error}</div>}

      <div className="zombie-layout">
        <div className="zombie-canvas-wrap">
          <canvas ref={canvasRef} className="zombie-canvas" aria-label="殭屍射擊遊戲畫面" />
        </div>

        <aside className="zombie-panel">
          <div className="zombie-stage">
            <strong>{LEVELS[hud.level]?.name || "第一關"}</strong>
            <span>{hud.running ? `${Math.max(0, Math.ceil(levelCfg.duration - (hud.elapsed || 0)))} 秒` : "待命"}</span>
          </div>
          <div className="zombie-meter">
            <label>關卡進度</label>
            <div><span style={{ width: `${stageProgress * 100}%` }} /></div>
          </div>
          <div className="zombie-meter hp">
            <label>生命 {Math.ceil(hud.hp || 0)} / {hud.maxHp || 100}</label>
            <div><span style={{ width: `${hpPct * 100}%` }} /></div>
          </div>

          <div className="zombie-stats">
            <span>擊殺 <strong>{hud.kills || 0}</strong></span>
            <span>攻擊 <strong>{hud.power || 12}</strong></span>
            <span>攻速 <strong>{Math.round(1000 / (hud.fireDelay || 430) * 10) / 10}/秒</strong></span>
            <span>散射 <strong>{hud.burst || 1}</strong></span>
          </div>

          <button className="zombie-start" onClick={startLevel} disabled={startDisabled}>
            {startLabel}
          </button>

          <div className="zombie-rules">
            <span>每次挑戰入場費 {entryCost} {roomConfig.currency_name}（只收一次，不分關卡）。</span>
            <span>共三關，每過一關獲得 {settings.zombie_level_reward ?? 15} {roomConfig.currency_name}，全破最多 {(settings.zombie_level_reward ?? 15) * MAX_LEVELS}。</span>
            <span>每日最多挑戰 {settings.zombie_daily_limit ?? 3} 次，不論成功或失敗都算一次。</span>
            <span>滑鼠或手機點擊場地可移動；自動攻擊不中斷。</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
