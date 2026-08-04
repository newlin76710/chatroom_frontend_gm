import { useState } from "react";
import "./ShopPanel.css";
import { BACKEND, RN, roomConfig } from "../../shared/roomConfig";

const CAKE_VARIANTS = [
  { id: "original",       emoji: "🎂", name: "原味蛋糕",   image: "/gifts/cake.gif" },
  { id: "pink",           emoji: "🩷", name: "淑女蛋糕",   image: "/gifts/cake_pink.gif" },
  { id: "blue",           emoji: "🎩", name: "紳士蛋糕",   image: "/gifts/cake_blue.gif" },
  { id: "birthday",       emoji: "🎉", name: "生日蛋糕",   image: "/gifts/cake_birthday.gif" },
  { id: "strawberry",     emoji: "🍓", name: "草莓蛋糕",   image: "/gifts/cake_strawberry.gif" },
  { id: "lemon",          emoji: "🍋", name: "檸檬蛋糕",   image: "/gifts/cake_lemon.gif" },
  { id: "chocolate_cake", emoji: "🍫", name: "巧克力蛋糕", image: "/gifts/cake_chocolate.gif" },
  { id: "cupcake",        emoji: "🧁", name: "杯子蛋糕",   image: "/gifts/cake_cupcake.gif" },
];

const MULTI_QTY_IDS = ["diamond", "plane", "car", "ball"];
const MAX_GIFT_QUANTITY = 20;

export default function ShopPanel({ token, myName, myLevel, targetName, open, onClose, title = "商城" }) {
  const [buying, setBuying] = useState(null);
  const [showCakePicker, setShowCakePicker] = useState(false);
  const [quantities, setQuantities] = useState({});

  if (!open) return null;

  const isMarket = title === "賣場";

  const getQuantity = (id) => quantities[id] ?? 1;
  const setQuantity = (id, val) => {
    const n = Math.max(1, Math.min(MAX_GIFT_QUANTITY, Math.floor(Number(val)) || 1));
    setQuantities((prev) => ({ ...prev, [id]: n }));
  };

  const GIFT_IDS = isMarket
    ? ["diamond", "plane", "car"]
    : ["rose", "chocolate", "cake"];

  const items = isMarket
    ? [
        { id: "diamond",  name: "💎 鑽石(送禮)", price: 5 },
        { id: "plane",    name: "✈️ 飛機(送禮)", price: 5 },
        { id: "car",      name: "🚗 跑車(送禮)", price: 5 },
        { id: "firework", name: "🎆 放煙火(全場特效)", price: 15 },
        { id: "ball",     name: "🔮 積分球(+1000積分)", price: 30 },
        { id: "rename",   name: "✏️ 升級卡(+1級)",  price: 1000 },
      ]
    : [
        { id: "rose",      name: "🌹 玫瑰(送禮)",   price: 5 },
        { id: "chocolate", name: "🍫 巧克力(送禮)", price: 5 },
        { id: "cake",      name: "🎂 蛋糕(送禮)",   price: 5 },
        { id: "firework",  name: "🎆 放煙火(全場特效)", price: 15 },
        { id: "ball",      name: "🔮 積分球(+1000積分)", price: 30 },
        { id: "rename",    name: "✏️ 升級卡(+1級)",  price: 1000 },
      ];

  const buyItem = async (item, cakeVariant = null) => {
    if (GIFT_IDS.includes(item.id) && !targetName) {
      alert("請先選擇贈送對象");
      return;
    }
    if (buying) return;

    const quantity = MULTI_QTY_IDS.includes(item.id) ? getQuantity(item.id) : 1;

    try {
      setBuying(item.id);

      const body = { itemId: item.id, targetName, room: RN };
      if (cakeVariant) body.cakeVariant = cakeVariant;
      if (quantity > 1) body.quantity = quantity;

      const res = await fetch(`${BACKEND}/api/shop/buy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "購買失敗");
        return;
      }

      alert(`購買成功：${item.name}${quantity > 1 ? ` ×${quantity}` : ""}`);
    } catch (err) {
      alert("此功能尚未開放!");
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="shop-overlay">
      <div className="shop-panel">
        <div className="shop-header">
          <h3><img src={`/gifts/${roomConfig.currency_icon}`} alt={roomConfig.currency_name} style={{ width: 20, height: 20, marginTop: -5 }} /> {title}</h3>
          <button onClick={onClose}>✖</button>
        </div>

        <div className="shop-user">
          玩家：{myName} ｜ 等級：Lv.{myLevel} | 🎯 送給：{targetName}
        </div>

        <div className="shop-items">
          {items.map((item) => (
            <div key={item.id}>
              <div className="shop-item">
                <div className="shop-name">{item.name}</div>

                <div className="shop-right">
                  {MULTI_QTY_IDS.includes(item.id) && (
                    <input
                      type="number"
                      className="shop-qty-input"
                      min={1}
                      max={MAX_GIFT_QUANTITY}
                      value={getQuantity(item.id)}
                      onChange={(e) => setQuantity(item.id, e.target.value)}
                    />
                  )}

                  <span className="shop-price">{item.price * getQuantity(item.id)} <img src={`/gifts/${roomConfig.currency_icon}`} alt={roomConfig.currency_name} style={{ width: 20, height: 20, marginTop: -5 }} /></span>

                  <button
                    className="buy-btn"
                    disabled={buying === item.id}
                    onClick={() => {
                      if (item.id === "cake") {
                        setShowCakePicker((prev) => !prev);
                      } else {
                        buyItem(item);
                      }
                    }}
                  >
                    {item.id === "cake"
                      ? (showCakePicker ? "收起 ▲" : "選款 ▼")
                      : buying === item.id ? "購買中..." : "購買"}
                  </button>
                </div>
              </div>

              {item.id === "cake" && showCakePicker && (
                <div className="cake-picker">
                  {CAKE_VARIANTS.map((v) => (
                    <button
                      key={v.id}
                      className="cake-variant-btn"
                      disabled={buying === "cake"}
                      onClick={() => {
                        setShowCakePicker(false);
                        buyItem(item, v.id);
                      }}
                    >
                      <img src={v.image} alt={v.name} style={{ width: 36, height: 36, display: "block", margin: "0 auto 4px" }} />
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}