// PusherPhysics.js — Matter.js 物理層：真實推幣機模擬（推板、硬幣碰撞、邊緣感應掉落）
import Matter from "matter-js";

export const COIN_RADIUS = 12;
export const MAX_ACTIVE_COINS = 260;

// 推板速度曲線（前進較慢、後退較快，貼近實機節奏）
const PLATE_SPEED_PRESETS = {
  slow:   { forward: 1350, pause1: 420, backward: 1050, pause2: 420 },
  normal: { forward: 950,  pause1: 300, backward: 720,  pause2: 300 },
  fast:   { forward: 650,  pause1: 180, backward: 480,  pause2: 180 },
};

function easeInOutQuad(p) {
  return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
}

// 回傳推板目前該在的偏移比例 0（最後）～1（最前）
function plateOffset(elapsedMs, cfg) {
  const total = cfg.forward + cfg.pause1 + cfg.backward + cfg.pause2;
  let t = elapsedMs % total;
  if (t < cfg.forward) return easeInOutQuad(t / cfg.forward);
  t -= cfg.forward;
  if (t < cfg.pause1) return 1;
  t -= cfg.pause1;
  if (t < cfg.backward) return 1 - easeInOutQuad(t / cfg.backward);
  return 0;
}

export function createPusherWorld(width, height, plateSpeed = "normal") {
  const engine = Matter.Engine.create();
  engine.gravity.y = 0.55; // 溫和重力＝台面朝前緣的傾斜牽引力
  const world = engine.world;

  const wallOpts = { isStatic: true, restitution: 0.15, friction: 0.15, render: { visible: false } };
  const leftWall  = Matter.Bodies.rectangle(-10, height / 2, 20, height * 2, wallOpts);
  const rightWall = Matter.Bodies.rectangle(width + 10, height / 2, 20, height * 2, wallOpts);
  const backWall  = Matter.Bodies.rectangle(width / 2, -10, width * 2, 20, wallOpts);

  const plateRestY   = height * 0.30;
  const plateStroke  = height * 0.16;
  const plateWidth   = width * 0.86;
  const plateHeight  = 20;
  const plate = Matter.Bodies.rectangle(width / 2, plateRestY, plateWidth, plateHeight, {
    isStatic: true,
    friction: 0.03,
    restitution: 0.05,
  });

  // 邊緣感應區（有一定厚度，避免高速穿透漏判）
  const sensor = Matter.Bodies.rectangle(width / 2, height + 18, width, 40, {
    isStatic: true,
    isSensor: true,
  });

  Matter.World.add(world, [leftWall, rightWall, backWall, plate, sensor]);

  return {
    engine,
    world,
    plate,
    sensor,
    width,
    height,
    plateRestY,
    plateStroke,
    plateWidth,
    plateHeight,
    plateSpeed,
    plateElapsed: 0,
    prevPlateY: plateRestY,
  };
}

export function setPlateSpeed(state, speed) {
  state.plateSpeed = PLATE_SPEED_PRESETS[speed] ? speed : "normal";
}

// 推進物理世界一個 frame；回傳目前是否有 body 掉出世界底部（tunneling 保險機制交給呼叫端處理）
export function stepWorld(state, deltaMs) {
  const dt = Math.min(deltaMs, 34); // 避免分頁切走後回來時一次補太大步距
  state.plateElapsed += dt;

  const cfg = PLATE_SPEED_PRESETS[state.plateSpeed] || PLATE_SPEED_PRESETS.normal;
  const offset = plateOffset(state.plateElapsed, cfg);
  const newY = state.plateRestY + offset * state.plateStroke;
  const vy = (newY - state.prevPlateY) / (dt / 1000 || 1);

  Matter.Body.setPosition(state.plate, { x: state.plate.position.x, y: newY });
  Matter.Body.setVelocity(state.plate, { x: 0, y: vy });
  state.prevPlateY = newY;

  Matter.Engine.update(state.engine, dt);
}

// 建立一顆硬幣物理物體並丟進世界
export function spawnCoin(state, { x, y, vx = 0, vy = 0, kind = "coin", tokenId = null }) {
  const body = Matter.Bodies.circle(x, y, COIN_RADIUS, {
    friction: 0.03,
    frictionStatic: 0.25,
    restitution: 0.08,
    density: 0.002,
    frictionAir: 0.0008,
  });
  body.pusherMeta = { kind, tokenId };
  Matter.Body.setVelocity(body, { x: vx, y: vy });
  Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.2);
  Matter.World.add(state.world, body);
  return body;
}

export function removeBody(state, body) {
  Matter.World.remove(state.world, body);
}

export function getCoinBodies(state) {
  return Matter.Composite.allBodies(state.world).filter(b => b.pusherMeta);
}

// 註冊掉落偵測：硬幣進入邊緣感應區時觸發 onFallen(body)，並自動從世界移除
export function attachFallHandler(state, onFallen) {
  const handler = (event) => {
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;
      const coin = bodyA === state.sensor ? bodyB : (bodyB === state.sensor ? bodyA : null);
      if (coin && coin.pusherMeta) {
        removeBody(state, coin);
        onFallen(coin);
      }
    }
  };
  Matter.Events.on(state.engine, "collisionStart", handler);
  return () => Matter.Events.off(state.engine, "collisionStart", handler);
}

// 保險機制：極少數高速穿透感應區未被判定的硬幣，位置超出畫面底部太多時強制視為掉落
export function sweepEscapedCoins(state, onFallen) {
  const bodies = getCoinBodies(state);
  for (const b of bodies) {
    if (b.position.y > state.height + 80) {
      removeBody(state, b);
      onFallen(b);
    }
  }
}

export function destroyWorld(state) {
  Matter.World.clear(state.world, false);
  Matter.Engine.clear(state.engine);
}
