import Phaser from "phaser";
import { playCoinDropSound, playCollisionSound, playLaunchSound, unlockPusherAudio } from "./SoundManager";

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 960;

const CHUTE = { x: GAME_WIDTH / 2, y: 84 };
const TABLE = {
  left: 70,
  right: GAME_WIDTH - 70,
  back: 106,
  front: GAME_HEIGHT - 130,
  drop: GAME_HEIGHT - 84,
};

const COIN_RADIUS = 18;
const MAX_BODIES = 340;
const DROP_ZONE_HEIGHT = 70;
const ENTRY_GAP_FROM_PUSHER = 74;

const SPEEDS = {
  slow: { forwardMs: 1500, holdFrontMs: 320, backMs: 760, holdBackMs: 260 },
  normal: { forwardMs: 1080, holdFrontMs: 260, backMs: 560, holdBackMs: 220 },
  fast: { forwardMs: 760, holdFrontMs: 180, backMs: 390, holdBackMs: 160 },
};

const KIND_META = {
  coin: { label: "COIN", fill: 0xffd44f, rim: 0x8f5f12, radius: COIN_RADIUS, valueLabel: "金幣" },
  diamond: { label: "D", fill: 0x82ecff, rim: 0x0b7ea0, radius: 22, valueLabel: "鑽石" },
  car: { label: "CAR", fill: 0xff735a, rim: 0x811d18, radius: 25, valueLabel: "跑車" },
  plane: { label: "JET", fill: 0xe9f0ff, rim: 0x4e607d, radius: 27, valueLabel: "飛機" },
  jackpot: { label: "JP", fill: 0xfff07a, rim: 0xff4fd8, radius: 28, valueLabel: "Jackpot" },
};

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function pusherOffset(elapsed, speedKey) {
  const cfg = SPEEDS[speedKey] || SPEEDS.normal;
  const total = cfg.forwardMs + cfg.holdFrontMs + cfg.backMs + cfg.holdBackMs;
  let t = elapsed % total;
  if (t < cfg.forwardMs) return easeInOutQuad(t / cfg.forwardMs);
  t -= cfg.forwardMs;
  if (t < cfg.holdFrontMs) return 1;
  t -= cfg.holdFrontMs;
  if (t < cfg.backMs) return 1 - easeInOutQuad(t / cfg.backMs);
  return 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function signedAimAngle(pointerX, pointerY) {
  const dx = pointerX - CHUTE.x;
  const dy = pointerY - CHUTE.y;
  const angle = Math.atan2(dx, Math.max(12, dy));
  return clamp(angle, -Math.PI / 3.2, Math.PI / 3.2);
}

export default class PusherGameScene extends Phaser.Scene {
  constructor() {
    super("PusherGameScene");
    this.coinSprites = new Set();
    this.pendingDrops = [];
    this.dropFlushElapsed = 0;
    this.state = {
      bet: 1,
      position: 50,
      balance: 0,
      plateSpeed: "normal",
      enabled: true,
    };
    this.aim = { active: false, x: CHUTE.x, y: CHUTE.y };
  }

  init(data) {
    this.services = data.services;
    this.state = { ...this.state, ...data.initialState };
  }

  create() {
    this.matter.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT + 260, 42, true, true, true, false);
    this.matter.world.engine.gravity.y = 0;
    this.matter.world.engine.positionIterations = 10;
    this.matter.world.engine.velocityIterations = 8;
    this.matter.world.engine.constraintIterations = 4;

    this.createTextures();
    this.createCabinet();
    this.createStaticPhysics();
    this.createPusher();
    this.createParticles();
    this.seedTable();
    this.registerInput();
    this.registerCollisions();
    this.services?.onReady?.({
      quickDrop: (position) => this.quickDrop(position),
      setState: (nextState) => this.setExternalState(nextState),
    });
    this.events.emit("ready");
  }

  setExternalState(nextState) {
    this.state = { ...this.state, ...nextState };
  }

  createTextures() {
    for (const [kind, meta] of Object.entries(KIND_META)) {
      const size = meta.radius * 2 + 12;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(meta.rim, 1);
      g.fillCircle(size / 2, size / 2, meta.radius + 4);
      g.fillStyle(meta.fill, 1);
      g.fillCircle(size / 2 - 1, size / 2 - 2, meta.radius);
      g.lineStyle(3, 0xffffff, 0.45);
      g.strokeCircle(size / 2 - 1, size / 2 - 2, meta.radius * 0.72);
      g.lineStyle(2, 0x5f4209, kind === "coin" ? 0.35 : 0.2);
      g.beginPath();
      g.moveTo(size / 2, size / 2 - meta.radius * 0.85);
      g.lineTo(size / 2, size / 2 + meta.radius * 0.85);
      g.strokePath();
      g.generateTexture(`pusher-${kind}`, size, size);
      g.destroy();
    }

    const prize = this.make.graphics({ x: 0, y: 0, add: false });
    prize.fillStyle(0xffffff, 1);
    prize.fillTriangle(32, 3, 61, 28, 32, 61);
    prize.fillStyle(0xb8c7e8, 1);
    prize.fillTriangle(32, 3, 3, 28, 32, 61);
    prize.generateTexture("pusher-plane-shape", 64, 64);
    prize.clear();
    prize.fillStyle(0xff345c, 1);
    prize.fillRoundedRect(6, 18, 52, 28, 9);
    prize.fillStyle(0x1b2030, 1);
    prize.fillCircle(19, 48, 7);
    prize.fillCircle(45, 48, 7);
    prize.generateTexture("pusher-car-shape", 64, 64);
    prize.destroy();
  }

  createCabinet() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x14201f);
    const table = this.add.graphics();
    table.fillGradientStyle(0x164943, 0x164943, 0x092a27, 0x092a27, 1);
    table.fillRoundedRect(TABLE.left, TABLE.back, TABLE.right - TABLE.left, TABLE.front - TABLE.back, 22);
    table.lineStyle(10, 0xd8b85b, 1);
    table.strokeRoundedRect(TABLE.left - 5, TABLE.back - 5, TABLE.right - TABLE.left + 10, TABLE.front - TABLE.back + 28, 26);

    for (let i = 0; i < 15; i++) {
      const x = TABLE.left + 24 + i * ((TABLE.right - TABLE.left - 48) / 14);
      const bulb = this.add.circle(x, 37, 8, i % 2 ? 0xff4242 : 0xffe066, 1);
      this.tweens.add({ targets: bulb, alpha: 0.35, duration: 460 + i * 20, yoyo: true, repeat: -1 });
    }

    this.add.rectangle(GAME_WIDTH / 2, TABLE.drop, TABLE.right - TABLE.left - 18, DROP_ZONE_HEIGHT, 0x221710, 0.8);
    this.add.rectangle(GAME_WIDTH / 2, TABLE.drop - 40, TABLE.right - TABLE.left - 44, 8, 0xffd15c, 0.8);
    this.add.text(GAME_WIDTH / 2, TABLE.drop + 22, "落幣區", {
      fontFamily: "Arial, sans-serif",
      fontSize: "22px",
      color: "#ffd76a",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.rectangle(CHUTE.x, CHUTE.y - 34, 116, 28, 0x090909, 0.95).setStrokeStyle(2, 0xf6cf71);
    this.add.text(CHUTE.x, CHUTE.y - 34, "投幣口", {
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      color: "#fff3bd",
    }).setOrigin(0.5);

    this.aimLine = this.add.graphics();
    this.laneIndicator = this.add.graphics();
  }

  // 出幣位置 0~100（0=最左, 50=置中, 100=最右）換算成投幣口下方的實際 X 座標
  laneToX(positionPct) {
    const t = clamp(Number(positionPct ?? 50), 0, 100) / 100;
    return (TABLE.left + 70) + t * (TABLE.right - TABLE.left - 140);
  }

  updateLaneIndicator() {
    this.laneIndicator.clear();
    if (this.aim.active) return; // 拖曳瞄準時改由 aimLine 顯示
    const x = this.laneToX(this.state.position);
    this.laneIndicator.lineStyle(3, 0x8be9ff, 0.8);
    this.laneIndicator.lineBetween(CHUTE.x, CHUTE.y, x, Math.min(TABLE.drop - 190, this.pusherBackY + ENTRY_GAP_FROM_PUSHER));
    this.laneIndicator.fillStyle(0x8be9ff, 1);
    this.laneIndicator.fillTriangle(x - 8, CHUTE.y + 6, x + 8, CHUTE.y + 6, x, CHUTE.y + 20);
  }

  createStaticPhysics() {
    const opts = { isStatic: true, restitution: 0.08, friction: 0.22 };
    this.matter.add.rectangle(TABLE.left - 18, (TABLE.back + TABLE.front) / 2, 36, TABLE.front - TABLE.back + 220, opts);
    this.matter.add.rectangle(TABLE.right + 18, (TABLE.back + TABLE.front) / 2, 36, TABLE.front - TABLE.back + 220, opts);
    this.matter.add.rectangle(GAME_WIDTH / 2, TABLE.back - 22, TABLE.right - TABLE.left + 86, 44, opts);

    this.leftLip = this.matter.add.rectangle(TABLE.left + 40, TABLE.drop - 24, 82, 24, {
      ...opts,
      angle: Phaser.Math.DegToRad(6),
    });
    this.rightLip = this.matter.add.rectangle(TABLE.right - 40, TABLE.drop - 24, 82, 24, {
      ...opts,
      angle: Phaser.Math.DegToRad(-6),
    });

    this.dropSensor = this.matter.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT + 12, TABLE.right - TABLE.left - 84, 84, {
      isStatic: true,
      isSensor: true,
      label: "drop-sensor",
    });
  }

  createPusher() {
    this.pusherBackY = 218;
    this.pusherStroke = 152;
    this.pusherElapsed = Math.random() * 900;
    this.pusherGraphic = this.add.graphics();
    this.pusherBody = this.matter.add.rectangle(GAME_WIDTH / 2, this.pusherBackY, TABLE.right - TABLE.left - 58, 54, {
      isStatic: true,
      friction: 0.03,
      restitution: 0,
      chamfer: { radius: 5 },
      label: "pusher-plate",
    });
    this.drawPusher(this.pusherBackY);
  }

  drawPusher(y) {
    this.pusherGraphic.clear();
    this.pusherGraphic.fillGradientStyle(0xf8fbff, 0xc2c6cf, 0x727985, 0x4d535e, 1);
    this.pusherGraphic.fillRoundedRect(TABLE.left + 44, y - 30, TABLE.right - TABLE.left - 88, 58, 7);
    this.pusherGraphic.lineStyle(3, 0xffffff, 0.3);
    this.pusherGraphic.lineBetween(TABLE.left + 58, y - 14, TABLE.right - 58, y - 14);
    this.pusherGraphic.lineStyle(5, 0x3e454c, 0.6);
    this.pusherGraphic.lineBetween(TABLE.left + 48, y + 29, TABLE.right - 48, y + 29);
  }

  createParticles() {
    this.dropParticles = this.add.particles(0, 0, "pusher-coin", {
      lifespan: 480,
      speed: { min: 90, max: 260 },
      scale: { start: 0.5, end: 0 },
      rotate: { min: 0, max: 360 },
      emitting: false,
    });
  }

  seedTable() {
    const startY = this.pusherBackY + this.pusherStroke + 50;
    const rows = 9;
    for (let row = 0; row < rows; row++) {
      const count = row % 2 ? 10 : 9;
      const y = startY + row * 36 + Math.random() * 5;
      for (let col = 0; col < count; col++) {
        const x = 146 + col * 48 + (row % 2 ? 22 : 0) + Phaser.Math.Between(-6, 6);
        if (y < TABLE.drop - 120) {
          this.spawnToken({ x, y, kind: "coin", tokenId: null, house: true, gentle: true });
        }
      }
    }
    this.spawnToken({ x: 220, y: 535, kind: "diamond", tokenId: null, house: true, gentle: true });
    this.spawnToken({ x: 500, y: 610, kind: "car", tokenId: null, house: true, gentle: true });
    this.spawnToken({ x: 360, y: 690, kind: "plane", tokenId: null, house: true, gentle: true });
  }

  registerInput() {
    this.input.on("pointerdown", (pointer) => {
      unlockPusherAudio();
      this.aim = { active: true, x: pointer.x, y: pointer.y };
    });
    this.input.on("pointermove", (pointer) => {
      if (!this.aim.active) return;
      this.aim.x = pointer.x;
      this.aim.y = pointer.y;
    });
    this.input.on("pointerup", (pointer) => {
      if (!this.aim.active) return;
      this.aim = { active: false, x: pointer.x, y: pointer.y };
      const dist = Phaser.Math.Distance.Between(CHUTE.x, CHUTE.y, pointer.x, pointer.y);
      const angle = dist < 10 ? 0 : signedAimAngle(pointer.x, pointer.y);
      const power = clamp(36 + dist / 2.3, 44, 100);
      this.launchCoin(angle, power);
    });
    this.input.on("pointerupoutside", () => {
      this.aim.active = false;
    });
  }

  registerCollisions() {
    this.matter.world.on("collisionstart", (event) => {
      for (const pair of event.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        const sprite = a.gameObject || b.gameObject;
        const sensorHit = a === this.dropSensor || b === this.dropSensor;
        if (sensorHit && sprite?.pusherMeta) {
          this.markDropped(sprite);
          continue;
        }
        if (sprite?.pusherMeta) {
          const speed = Math.max(a.speed || 0, b.speed || 0);
          playCollisionSound(speed);
        }
      }
    });
  }

  quickDrop(position) {
    const entryX = this.laneToX(position ?? this.state.position);
    this.launchCoin(0, 74, entryX);
  }

  async launchCoin(angle = 0, power = 74, entryXOverride = null) {
    if (this.inserting || !this.state.enabled) return;
    if (this.coinSprites.size >= MAX_BODIES) {
      this.services?.onMessage?.("台面太滿，等幾枚掉落後再投。");
      return;
    }
    if ((this.state.balance ?? 0) < this.state.bet) {
      this.services?.onMessage?.("餘額不足。");
      return;
    }

    this.inserting = true;
    try {
      const payload = await this.services.insertCoin(this.state.bet);
      if (!payload) return;
      this.state.balance = payload.newApples ?? this.state.balance;
      const speed = 1.35 + power * 0.018;
      const vx = Math.sin(angle) * speed;
      const vy = Math.cos(angle) * speed;
      const entryY = Math.min(TABLE.drop - 190, this.pusherBody.position.y + ENTRY_GAP_FROM_PUSHER);
      const entryX = entryXOverride != null
        ? clamp(entryXOverride, TABLE.left + 62, TABLE.right - 62)
        : clamp(CHUTE.x + Math.sin(angle) * 54, TABLE.left + 62, TABLE.right - 62);
      this.spawnToken({ x: entryX, y: entryY, vx, vy, kind: payload.kind, tokenId: payload.tokenId, value: payload.value });
      this.flashChute(entryX, entryY);
      playLaunchSound();
    } catch (error) {
      this.services?.onMessage?.(error?.message || "投幣失敗。");
    } finally {
      this.inserting = false;
    }
  }

  spawnToken({ x, y, vx = 0, vy = 0, kind = "coin", tokenId = null, value = 0, house = false, gentle = false }) {
    const meta = KIND_META[kind] || KIND_META.coin;
    const texture = kind === "plane" && !house ? "pusher-plane-shape" : kind === "car" && !house ? "pusher-car-shape" : `pusher-${kind}`;
    const sprite = this.matter.add.image(x, y, texture, null, {
      shape: { type: "circle", radius: meta.radius },
      friction: kind === "coin" ? 0.08 : 0.11,
      frictionStatic: kind === "coin" ? 0.78 : 0.9,
      frictionAir: gentle ? 0.08 : 0.045,
      restitution: 0.07,
      density: kind === "coin" ? 0.0028 : 0.0045,
      slop: 0.03,
      label: `pusher-${kind}`,
    });
    sprite.setDepth(10 + y / 1000);
    sprite.setBounce(0.05);
    sprite.setFriction(kind === "coin" ? 0.08 : 0.11, gentle ? 0.08 : 0.045, kind === "coin" ? 0.78 : 0.9);
    sprite.setAngularVelocity(gentle ? Phaser.Math.FloatBetween(-0.015, 0.015) : Phaser.Math.FloatBetween(-0.18, 0.18));
    sprite.setVelocity(vx, vy);
    sprite.setScale(kind === "coin" ? 1 : 1.04);
    sprite.pusherMeta = { kind, tokenId, value, house, dropped: false };
    this.coinSprites.add(sprite);
    if (kind === "jackpot") {
      sprite.setTint(0xfff4a3);
      this.tweens.add({ targets: sprite, scale: 1.22, duration: 360, yoyo: true, repeat: -1 });
    }
    return sprite;
  }

  flashChute(entryX, entryY) {
    const beam = this.add.graphics();
    beam.lineStyle(5, 0xffd86b, 0.65);
    beam.lineBetween(CHUTE.x, CHUTE.y, entryX, entryY);
    this.tweens.add({ targets: beam, alpha: 0, duration: 220, onComplete: () => beam.destroy() });
  }

  markDropped(sprite) {
    if (sprite.pusherMeta.dropped) return;
    sprite.pusherMeta.dropped = true;
    const big = sprite.pusherMeta.kind !== "coin";
    this.pendingDrops.push({ tokenId: sprite.pusherMeta.tokenId, kind: sprite.pusherMeta.kind, value: sprite.pusherMeta.value });
    this.dropParticles.emitParticleAt(sprite.x, Math.min(sprite.y, TABLE.drop + 36), big ? 34 : 16);
    playCoinDropSound(big);
    this.floatText(sprite.x, TABLE.drop - 12, this.dropLabel(sprite), big ? "#ffef8a" : "#ffffff");
    this.coinSprites.delete(sprite);
    // Jackpot 幣在 spawnToken 裡掛了一個 repeat:-1 的無限縮放 tween；
    // 沒先停掉就 destroy() 會讓 tween manager 下一幀繼續嘗試操作已銷毀的
    // sprite 而丟例外，導致整個 Phaser 更新迴圈卡死（中獎後遊戲停住）。
    this.tweens.killTweensOf(sprite);
    sprite.destroy();
  }

  dropLabel(sprite) {
    const { kind, value } = sprite.pusherMeta;
    if (kind === "jackpot") return "JACKPOT!";
    if (value > 0) return `${KIND_META[kind]?.valueLabel || "獎品"} +${value}`;
    return "DROP";
  }

  floatText(x, y, text, color) {
    const label = this.add.text(x, y, text, {
      fontFamily: "Arial, sans-serif",
      fontSize: "26px",
      color,
      fontStyle: "bold",
      stroke: "#111111",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(300);
    this.tweens.add({
      targets: label,
      y: y - 60,
      alpha: 0,
      duration: 900,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  update(_, delta) {
    this.updatePusher(delta);
    this.updateAim();
    this.updateLaneIndicator();
    this.applyTableTilt(delta);
    this.applyEdgeDrama();
    this.flushDrops(delta);
    this.cleanupEscaped();
    this.publishDebugStats();
  }

  updatePusher(delta) {
    this.pusherElapsed += Math.min(delta, 34);
    const nextOffset = pusherOffset(this.pusherElapsed, this.state.plateSpeed);
    const y = this.pusherBackY + this.pusherStroke * nextOffset;
    const prevY = this.pusherBody.position.y;
    const vy = (y - prevY) / (Math.max(delta, 16) / 1000);
    this.matter.body.setPosition(this.pusherBody, { x: GAME_WIDTH / 2, y });
    this.matter.body.setVelocity(this.pusherBody, { x: 0, y: vy });
    this.drawPusher(y);
  }

  updateAim() {
    this.aimLine.clear();
    if (!this.aim.active) return;
    const dist = clamp(Phaser.Math.Distance.Between(CHUTE.x, CHUTE.y, this.aim.x, this.aim.y), 18, 170);
    const angle = signedAimAngle(this.aim.x, this.aim.y);
    const ex = CHUTE.x + Math.sin(angle) * dist;
    const ey = CHUTE.y + Math.cos(angle) * dist;
    this.aimLine.lineStyle(4, 0xffd86b, 0.9);
    this.aimLine.setDepth(400);
    this.aimLine.beginPath();
    this.aimLine.moveTo(CHUTE.x, CHUTE.y);
    this.aimLine.lineTo(ex, ey);
    this.aimLine.strokePath();
    this.aimLine.fillStyle(0xfff4b5, 1);
    this.aimLine.fillCircle(ex, ey, 8);
  }

  applyTableTilt(delta) {
    const frameScale = Math.min(delta, 34) / 16.6667;
    for (const sprite of this.coinSprites) {
      if (!sprite.body || sprite.pusherMeta.dropped) continue;
      if (sprite.y < TABLE.back || sprite.y > TABLE.drop - 4) continue;

      const nearEdge = sprite.y > TABLE.drop - 120;
      const edgeForce = nearEdge ? 0.0000012 : 0;
      if (edgeForce > 0) {
        this.matter.body.applyForce(sprite.body, sprite.body.position, {
          x: 0,
          y: sprite.body.mass * edgeForce * frameScale,
        });
      }

      if (sprite.body.speed < 0.045 && !nearEdge) {
        this.matter.body.setVelocity(sprite.body, {
          x: sprite.body.velocity.x * 0.86,
          y: sprite.body.velocity.y * 0.72,
        });
      }

      const maxSpeed = nearEdge ? 3.2 : 1.85;
      if (sprite.body.speed > maxSpeed) {
        const ratio = maxSpeed / sprite.body.speed;
        this.matter.body.setVelocity(sprite.body, {
          x: sprite.body.velocity.x * ratio,
          y: sprite.body.velocity.y * ratio,
        });
      }
    }
  }

  applyEdgeDrama() {
    for (const sprite of this.coinSprites) {
      if (!sprite.body || sprite.pusherMeta.dropped) continue;
      sprite.setDepth(10 + sprite.y / 1000);
      if (sprite.y > TABLE.drop - 78 && sprite.y < TABLE.drop - 20) {
        sprite.setTint(0xfff1c2);
      } else if (sprite.pusherMeta.kind !== "jackpot") {
        sprite.clearTint();
      }
      if (sprite.y > GAME_HEIGHT + 120 || sprite.x < -120 || sprite.x > GAME_WIDTH + 120) {
        this.markDropped(sprite);
      }
    }
  }

  async flushDrops(delta) {
    this.dropFlushElapsed += delta;
    if (this.dropFlushElapsed < 260 || !this.pendingDrops.length) return;
    this.dropFlushElapsed = 0;
    const dropped = this.pendingDrops.splice(0, 80);
    const tokenIds = dropped.map((d) => d.tokenId).filter(Boolean);
    if (!tokenIds.length) return;
    try {
      const result = await this.services.collectDrops(tokenIds);
      if (result?.credited > 0) {
        this.floatText(GAME_WIDTH / 2, 176, `本次收益 +${result.credited}`, "#ffd86b");
      }
      if (result?.jackpotHit) {
        this.cameras.main.flash(500, 255, 230, 92);
      }
    } catch {
      this.pendingDrops.unshift(...dropped);
    }
  }

  cleanupEscaped() {
    for (const sprite of Array.from(this.coinSprites)) {
      if (!sprite.body || sprite.y > GAME_HEIGHT + 180) {
        this.markDropped(sprite);
      }
    }
  }

  publishDebugStats() {
    const active = Array.from(this.coinSprites).filter((sprite) => sprite.body && !sprite.pusherMeta.dropped);
    window.__pusherDebug = {
      activeCoins: active.length,
      nearDropCoins: active.filter((sprite) => sprite.y > TABLE.drop - 80).length,
      pendingDrops: this.pendingDrops.length,
      pusherY: Math.round(this.pusherBody.position.y),
      sample: active.slice(0, 8).map((sprite) => ({
        x: Math.round(sprite.x),
        y: Math.round(sprite.y),
        speed: Number(sprite.body.speed.toFixed(3)),
      })),
    };
  }
}
