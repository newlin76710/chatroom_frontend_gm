// giftEffects.js — 送花特效分級（99 花瓣雨/520 愛心花束/999 經典大花/1314 一生一世）＋
// 獨家賣場禮物特效（飛機/鑽石）的全螢幕 DOM 特效產生器。
// 每個 builder 回傳 { node, duration }：由 ChatApp.jsx 的 enqueueEffect 排隊掛到 body、
// duration 毫秒後移除，跟煙火/跑車特效同一套佇列，不會同時疊好幾個全螢幕特效。
// 後端事件：flowerEffectShow（payload.effect 決定用哪一組）、planeEffectShow、diamondEffectShow。
import "./giftEffects.css";
import { BRAND_NAME, BRAND_STATION } from "../../shared/brand";

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function baseContainer(extraClass) {
  return el("div", `firework-container gift-fx ${extraClass}`);
}

function headline(text) {
  return el("div", "firework-message gift-fx-message", text);
}

function signature(text) {
  return el("div", "flower-effect-signature gift-fx-signature", text);
}

function roseLine(data) {
  return `🌹 ${data?.sender || ""} 獻給 ${data?.target || ""} ${data?.quantity || ""} 朵玫瑰！`;
}

// 從上方飄落的粒子（花瓣/玫瑰/金粉）
function addFallingParticles(container, { count, emojis, className, maxDelay, minSize, maxSize }) {
  for (let i = 0; i < count; i++) {
    const p = el("span", className, pick(emojis));
    p.style.left = `${rand(0, 100)}%`;
    p.style.animationDelay = `${rand(0, maxDelay).toFixed(2)}s`;
    p.style.animationDuration = `${rand(2.6, 4).toFixed(2)}s`;
    p.style.fontSize = `${rand(minSize, maxSize).toFixed(0)}px`;
    p.style.setProperty("--drift", `${rand(-12, 12).toFixed(1)}vw`);
    container.appendChild(p);
  }
}

// ── 99：花瓣雨 ────────────────────────────────────────────────────────────
function petalRain(data) {
  const container = baseContainer("gift-fx-petal-rain");
  addFallingParticles(container, {
    count: 70, emojis: ["🌸", "🌹", "💮", "🌺", "🥀"], className: "gift-fx-petal",
    maxDelay: 1.6, minSize: 16, maxSize: 34,
  });
  container.appendChild(headline(roseLine(data)));
  container.appendChild(signature(`${data?.brand || BRAND_NAME} 祝賀`));
  return { node: container, duration: 5000 };
}

// ── 520：愛心花束 ──────────────────────────────────────────────────────────
// 參考「玫瑰流光」：一朵朵玫瑰帶著光點依序沿愛心曲線亮起，畫完後整顆愛心跳動，中央是花束
function heartBouquet(data) {
  const container = baseContainer("gift-fx-heart-bouquet");
  const heart = el("div", "gift-fx-heart");
  const ROSES = 38;
  for (let i = 0; i < ROSES; i++) {
    const t = (i / ROSES) * Math.PI * 2;
    // 經典愛心參數式，x ∈ [-16,16]、y ∈ [-17,12]，換算成相對愛心外框的百分比
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const rose = el("span", "gift-fx-heart-rose", "🌹");
    rose.style.left = `${50 + (x / 17) * 50}%`;
    rose.style.top = `${46 - (y / 17) * 50}%`;
    rose.style.animationDelay = `${(i * 0.045).toFixed(3)}s`;
    heart.appendChild(rose);
  }
  const bouquet = el("div", "gift-fx-bouquet", "💐");
  heart.appendChild(bouquet);
  heart.appendChild(el("div", "gift-fx-heart-text", "520 我愛你"));
  container.appendChild(heart);

  addFallingParticles(container, {
    count: 30, emojis: ["✨", "💖", "·"], className: "gift-fx-sparkle",
    maxDelay: 2.5, minSize: 10, maxSize: 20,
  });
  container.appendChild(headline(roseLine(data)));
  container.appendChild(signature(`${data?.brand || BRAND_NAME} 祝賀`));
  return { node: container, duration: 5500 };
}

// ── 999：經典全螢幕大花（還原最早期版本） ─────────────────────────────────
// 最早期的送花特效：玫瑰圖直接用 .firework-gif 的預設樣式鋪滿整個畫面（object-fit: cover），
// 播 5 秒 fadeInOut。刻意不掛 .flower-effect-container，避免被後來加的縮小/淡出樣式蓋掉。
function classicRose(data) {
  const container = el("div", "firework-container classic-rose-container");
  const img = el("img", "firework-gif");
  img.src = "/gifts/rose.gif";
  img.alt = "";
  container.appendChild(img);
  container.appendChild(el("div", "firework-message", roseLine(data)));
  container.appendChild(el("div", "flower-effect-signature", `${data?.brand || BRAND_NAME} 祝賀`));
  return { node: container, duration: 5000 };
}

// ── 1314：一生一世（金色煙火 + 滿屏玫瑰花海） ─────────────────────────────
// 參考「月下玫瑰」：夜空彎月掛滿玫瑰、金粉灑落，底部玫瑰花海湧上來，金色煙火連續綻放
function lifetime(data) {
  const container = baseContainer("gift-fx-lifetime");

  const moon = el("div", "gift-fx-moon");
  const MOON_ROSES = 14;
  for (let i = 0; i < MOON_ROSES; i++) {
    // 沿月牙下緣排一圈玫瑰（角度 200°→340° 的弧）
    const a = ((200 + (i / (MOON_ROSES - 1)) * 140) * Math.PI) / 180;
    const rose = el("span", "gift-fx-moon-rose", "🌹");
    rose.style.left = `${50 + Math.cos(a) * 46}%`;
    rose.style.top = `${50 - Math.sin(a) * 46}%`;
    rose.style.animationDelay = `${(0.3 + i * 0.06).toFixed(2)}s`;
    moon.appendChild(rose);
  }
  container.appendChild(moon);

  // 金色煙火：幾組光點從同一點往外炸開
  const BURSTS = [
    { x: 22, y: 26, delay: 0.4 }, { x: 78, y: 22, delay: 1.1 }, { x: 50, y: 14, delay: 1.9 },
    { x: 30, y: 40, delay: 2.7 }, { x: 70, y: 38, delay: 3.4 }, { x: 50, y: 30, delay: 4.2 },
  ];
  BURSTS.forEach(({ x, y, delay }) => {
    const burst = el("div", "gift-fx-gold-burst");
    burst.style.left = `${x}%`;
    burst.style.top = `${y}%`;
    const SPARKS = 22;
    for (let i = 0; i < SPARKS; i++) {
      const angle = (i / SPARKS) * Math.PI * 2;
      const dist = rand(90, 150);
      const spark = el("span", "gift-fx-gold-spark");
      spark.style.setProperty("--dx", `${(Math.cos(angle) * dist).toFixed(0)}px`);
      spark.style.setProperty("--dy", `${(Math.sin(angle) * dist).toFixed(0)}px`);
      spark.style.animationDelay = `${delay}s`;
      burst.appendChild(spark);
    }
    container.appendChild(burst);
  });

  addFallingParticles(container, {
    count: 45, emojis: ["✨", "·", "✦"], className: "gift-fx-gold-dust",
    maxDelay: 4, minSize: 8, maxSize: 18,
  });

  // 滿屏玫瑰花海：三排錯落的玫瑰從底部湧上來並輕輕搖曳
  const sea = el("div", "gift-fx-rose-sea");
  for (let row = 0; row < 3; row++) {
    const COLS = 16;
    for (let i = 0; i < COLS; i++) {
      const rose = el("span", "gift-fx-sea-rose", pick(["🌹", "🌹", "🌹", "🥀"]));
      rose.style.left = `${(i / COLS) * 100 + rand(-2, 4)}%`;
      rose.style.bottom = `${row * 7 + rand(-2, 2)}%`;
      rose.style.fontSize = `${(46 - row * 9 + rand(-4, 4)).toFixed(0)}px`;
      rose.style.animationDelay = `${(0.2 + row * 0.25 + rand(0, 0.5)).toFixed(2)}s, ${rand(0, 1.5).toFixed(2)}s`;
      rose.style.zIndex = String(3 - row);
      sea.appendChild(rose);
    }
  }
  container.appendChild(sea);

  container.appendChild(el("div", "gift-fx-lifetime-title", "一生一世 · 1314"));
  container.appendChild(headline(roseLine(data)));
  container.appendChild(signature(`${data?.brand || BRAND_NAME} 祝賀`));
  return { node: container, duration: 7000 };
}

export const FLOWER_EFFECT_BUILDERS = {
  petal_rain: petalRain,
  heart_bouquet: heartBouquet,
  classic_rose: classicRose,
  lifetime,
};

// 後端還沒升級（payload 沒帶 effect）時一律播 999 經典大花，跟改版前的行為一致
export function buildFlowerEffect(data) {
  return (FLOWER_EFFECT_BUILDERS[data?.effect] || classicRose)(data);
}

// ── 獨家飛機：斜向飛越全螢幕（帶光軌），後方拉出電台專屬橫幅 ─────────────
export function buildPlaneEffect(data, { room } = {}) {
  const container = baseContainer("gift-fx-plane");
  const station = data?.station || BRAND_STATION;

  const flight = el("div", "gift-fx-plane-flight");
  const banner = el("div", "gift-fx-plane-banner");
  banner.appendChild(el("span", "gift-fx-plane-banner-text", `✈️ ${station} 獨家呈現`));
  flight.appendChild(banner);
  flight.appendChild(el("div", "gift-fx-plane-rope"));
  flight.appendChild(el("div", "gift-fx-plane-trail"));
  const img = el("img", "gift-fx-plane-img");
  img.src = "/gifts/plane.gif";
  img.alt = "";
  flight.appendChild(img);
  container.appendChild(flight);

  addFallingParticles(container, {
    count: 18, emojis: ["✨", "☁️"], className: "gift-fx-sparkle",
    maxDelay: 2.5, minSize: 12, maxSize: 24,
  });
  container.appendChild(headline(`✈️ ${data?.sender || ""} 送給 ${data?.target || ""} ${data?.quantity || ""} 架飛機！`));
  container.appendChild(signature(`${data?.brand || BRAND_NAME} × 房間${data?.room || room || ""} 獨家呈現`));
  return { node: container, duration: 5000 };
}

// ── 獨家鑽石：巨鑽在中央閃耀旋轉 + 星光爆發，帶電台專屬金色字樣 ─────────────
export function buildDiamondEffect(data, { room } = {}) {
  const container = baseContainer("gift-fx-diamond");
  const station = data?.station || BRAND_STATION;

  const stage = el("div", "gift-fx-diamond-stage");
  stage.appendChild(el("div", "gift-fx-diamond-rays"));
  const img = el("img", "gift-fx-diamond-img");
  img.src = "/gifts/diamond.gif";
  img.alt = "";
  stage.appendChild(img);
  stage.appendChild(el("span", "gift-fx-diamond-glint"));

  const STARS = 28;
  for (let i = 0; i < STARS; i++) {
    const angle = (i / STARS) * Math.PI * 2 + rand(-0.1, 0.1);
    const dist = rand(160, 320);
    const star = el("span", "gift-fx-diamond-star", pick(["✨", "⭐", "✦", "💫"]));
    star.style.setProperty("--dx", `${(Math.cos(angle) * dist).toFixed(0)}px`);
    star.style.setProperty("--dy", `${(Math.sin(angle) * dist).toFixed(0)}px`);
    star.style.animationDelay = `${(0.6 + rand(0, 0.3)).toFixed(2)}s`;
    star.style.fontSize = `${rand(14, 28).toFixed(0)}px`;
    stage.appendChild(star);
  }
  container.appendChild(stage);

  container.appendChild(el("div", "gift-fx-diamond-title", station));
  container.appendChild(headline(`💎 ${data?.sender || ""} 獻給 ${data?.target || ""} ${data?.quantity || ""} 顆鑽石！`));
  container.appendChild(signature(`${data?.brand || BRAND_NAME} × 房間${data?.room || room || ""} 獨家呈現`));
  return { node: container, duration: 5000 };
}
