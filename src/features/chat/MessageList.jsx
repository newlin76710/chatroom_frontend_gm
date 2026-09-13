import { memo, useLayoutEffect, useRef, useCallback } from "react";
import { getAiAvatar } from "../../shared/aiConfig";
import "./MessageList.css";
import { safeText } from "../../shared/utils";
import { roomConfig } from "../../shared/roomConfig";
import { countryZh } from "../../shared/countryZh";

const FONT_SIZE_REM = { small: 0.85, medium: 1, large: 1.15, xlarge: 1.35 };

// 訊息串「實際掛載到 DOM」的則數上限。訊息本身仍完整保留在 state（受 MAX_MESSAGES 限制），
// 這裡只是不讓太舊、已經捲出畫面的訊息繼續佔用 DOM 節點與重排成本。
const RENDER_WINDOW = 150;

// 給「不需要跟著在線名單重新解析顏色」的訊息列用的固定值——保持參照穩定，才能讓 memo 生效。
const STABLE_ROSTER_TOKEN = null;

const countryFlag = code =>
  code?.length === 2
    ? String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
    : "";

// 舊版介面專用：把系統訊息裡的金額數字加粗（不換色，沿用外層文字顏色）
function boldAmounts(text) {
  if (!text) return text;
  return String(text)
    .split(/(\d[\d,]*)/g)
    .map((part, idx) => (/^\d/.test(part) ? <span key={idx} style={{ fontWeight: "bold" }}>{part}</span> : part));
}

// 單則訊息的渲染邏輯抽成獨立、模組層級的 memo 元件。
// 這是效能關鍵：只要 messages 陣列本身沒有變（訊息物件是同一個參照），
// React.memo 就能整批跳過沒變動訊息的重新渲染，不會因為在線名單廣播、
// 或陣列參照改變而把全部訊息重新跑一次 regex/JSX 建構。
const MessageRow = memo(function MessageRow({
  m,
  name,
  level,
  AML,
  ownMessageLeft,
  legacyUI,
  getUserColor,
  lookupUser,
  onSelectUser,
  scrollToBottomOnImageLoad,
  // eslint-disable-next-line no-unused-vars -- 只用來讓 React.memo 判斷「這則訊息要不要因為在線名單變動而重新解析顏色」，本身不參與畫面渲染。
  rosterToken,
}) {
  const userName = safeText(m.user?.name);
  const targetName = safeText(m.target);
  const emotionText = safeText(m.emotion);
  let messageText = safeText(m.message);
  const msgFontSizeRem = FONT_SIZE_REM[m.fontSize] ?? FONT_SIZE_REM.medium;
  const timestamp = m.timestamp || new Date().toLocaleTimeString();
  const isSelf = userName === name;
  const alignRight = isSelf && !ownMessageLeft;
  const isSystem = userName === "系統";
  const isTransaction = m.type === "transaction";
  const isGift = m.type === "gift";
  const isSurprise = m.type === "surprise";
  const isPeony = m.type === "peony";
  const isCurrencyAward = m.type === "currencyAward";
  const isMarqueeWin = isSystem && /^🎉 恭喜 .+ 中了跑馬燈大獎/.test(messageText);
  const isRPS = isSystem && (messageText.includes("猜拳") || messageText.includes("✊") || messageText.includes("✌") || messageText.includes("🖐"));
  const isPingpong = isSystem && messageText.includes("🏓");
  // 處理系統訊息：進入 & 升級卡
  let relatedUser = null;
  if (isSystem && messageText) {
    const patterns = [
      { regex: /^(.+?) 進入聊天室$/, type: "enter" },
      { regex: /^(.+?) 使用升級卡/, type: "levelUp" },
      { regex: /^(.+?) 使用積分球/, type: "exp" },
      { regex: /^(.+?) 在線獎勵/, type: "exp" },
      { regex: /^(.+?) 施放煙花/, type: "firework" },
      { regex: /^(.+?) 唱歌時間/, type: "time" }
    ];

    for (const p of patterns) {
      const match = messageText.match(p.regex);
      if (match) {
        relatedUser = match[1];
        // 只移除使用者名稱，不刪前面的文字
        const startIndex = match.index;           // 匹配起始位置
        const endIndex = startIndex + match[1].length; // 使用者名稱結束位置
        messageText = messageText.slice(0, startIndex) + messageText.slice(endIndex);
        messageText = messageText.trim();         // 去掉前後多餘空白
        break; // 找到第一個就停
      }
    }
  }

  // 處理系統訊息：【莊家：xxx】/【主持：xxx】標籤（推牌、跑馬燈開局公告）
  let dealerLabel = null;
  let dealerName = null;
  let dealerRest = "";
  if (isSystem && messageText) {
    const dealerMatch = messageText.match(/^(.*?)【(莊家|主持)：(.+?)】(.*)$/s);
    if (dealerMatch) {
      const [, before, label, dName, after] = dealerMatch;
      dealerLabel = label;
      dealerName = dName;
      dealerRest = after;
      messageText = before; // 保留標籤前面的文字（例如表情符號），單獨渲染
    }
  }

  const isRelatedToMe =
    isSelf ||
    (m.mode === "private" && (userName === name || targetName === name)) ||
    (m.mode === "publicTarget" && (userName === name || targetName === name)) ||
    (isSystem && (relatedUser === name || dealerName === name)) ||
    ((isTransaction || isGift) && (userName === name || targetName === name));

  // 顏色
  let color = "#eee";
  if (m.color) color = m.color;
  else if (isRPS || isPingpong) color = "#ffd700";
  else if (isSystem && (relatedUser || dealerName)) color = "#ff9900";
  else if (isTransaction || isGift) color = "#ff9900";
  else if (isSystem) color = "#BBECE2";
  else if (isSelf) color = "#fff";

  // AI 私聊文字顏色依性別覆蓋
  if (m.mode === "private") {
    const senderUser = lookupUser(userName);
    if (senderUser?.type === "AI") {
      color = senderUser.gender === "男" ? "#00CED1" : "#F8C8DC";
    }
  }

  const bgColor = isRelatedToMe ? "#004477" : "transparent";
  const tag = m.mode === "private" || m.isPrivate
    ? (legacyUI ? "(密)" : "(私聊)")
    : "";

  if (isSurprise) {
    return (
      <div className="message-row surprise-message" style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <div className="surprise-banner">
          <span className="surprise-icon">🎊</span>
          <span className="surprise-text">{legacyUI ? boldAmounts(messageText) : messageText}</span>
          <span className="surprise-icon">🎊</span>
        </div>
      </div>
    );
  }

  if (isMarqueeWin) {
    return (
      <div className="message-row marquee-message" style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <div className="marquee-banner">
          <span className="marquee-icon">🎰</span>
          <span className="marquee-text">{legacyUI ? boldAmounts(messageText) : messageText}</span>
          <span className="marquee-icon">🎰</span>
        </div>
      </div>
    );
  }

  if (isPeony) {
    return (
      <div className="message-row peony-message" style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <img src="/gifts/peony1.gif" alt="金牡丹" className="peony-big-icon" />
        <span className="peony-text">{legacyUI ? boldAmounts(messageText) : messageText}</span>
        <img src="/gifts/peony1.gif" alt="金牡丹" className="peony-big-icon" />
      </div>
    );
  }

  return (
    <div className="message-row" style={{ display: "flex", justifyContent: alignRight ? "flex-end" : "flex-start", marginBottom: legacyUI ? 2 : 6 }}>
      {!alignRight && !isSystem && !isTransaction && !isGift && (
        <img
          src={m.user?.avatar || getAiAvatar(userName) || "/avatars/g01.gif"}
          alt={userName}
          className="message-avatar"
        />
      )}

      <div style={{ maxWidth: legacyUI ? "92%" : "75%", color, background: bgColor, padding: isRelatedToMe ? "6px 10px" : 0, borderRadius: isRelatedToMe ? 8 : 0, fontSize: `${msgFontSizeRem + ((isRPS || isPingpong) && !legacyUI ? 0.15 : 0)}rem`, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: legacyUI ? 1.5 : 1.4 }}>
        {tag && <span style={{ fontSize: "0.7rem", color: "#e60909", marginRight: 4 }}>{tag}</span>}

        {(isTransaction || isGift) ? (
          <>
            <span>🎁 </span>
            <span style={{ fontWeight: "bold", cursor: "pointer", color: getUserColor(userName) }} onClick={() => onSelectUser(userName)}>
              {userName}
            </span>
            {isTransaction ? (<span> 贈送 </span>) : (<span> 向 </span>)}
            <span style={{ fontWeight: "bold", cursor: "pointer", color: getUserColor(targetName) }} onClick={() => onSelectUser(targetName)}>
              {targetName}
            </span>

            {isGift && (
              legacyUI
                ? <span className="gift-poem gift-poem--inline"> {messageText}</span>
                : <div className="gift-poem">{messageText}</div>
            )}
            {m.imageUrl && (
              legacyUI ? (
                <img
                  src={m.imageUrl}
                  alt="gift"
                  className="gift-big-image gift-big-image--legacy"
                  onLoad={scrollToBottomOnImageLoad}
                />
              ) : (
                <div>
                  <img
                    src={m.imageUrl}
                    alt="gift"
                    className="gift-big-image"
                    onLoad={scrollToBottomOnImageLoad}
                  />
                </div>
              )
            )}
            {isTransaction && <span> {legacyUI ? boldAmounts(messageText) : messageText}</span>}
          </>
        ) : isSystem && dealerName ? (
          <>
            <span>系統：{legacyUI ? boldAmounts(messageText) : messageText}【{dealerLabel}：</span>
            <span style={{ fontWeight: "bold", cursor: "pointer", color: getUserColor(dealerName) }} onClick={() => onSelectUser(dealerName)}>
              {dealerName}
            </span>
            <span style={{ color: "#ff9900" }}>】{legacyUI ? boldAmounts(dealerRest) : dealerRest}</span>
          </>
        ) : isSystem && relatedUser ? (
          <>
            <span>系統：</span>
            {relatedUser && (
              <span style={{ fontWeight: "bold", cursor: "pointer", color: getUserColor(relatedUser) }} onClick={() => onSelectUser(relatedUser)}>
                {relatedUser}
              </span>
            )}
            <span style={{ color: "#ff9900" }}> {legacyUI ? boldAmounts(messageText) : messageText}</span>
          </>
        ) : (!isSystem && emotionText) ? (
          <>
            <span style={{ fontWeight: "bold", cursor: "pointer", color: getUserColor(userName) }} onClick={() => onSelectUser(userName)}>
              {userName}
            </span>
            <span> {emotionText}{targetName ? "地對 " : "的說"}</span>
            {targetName && (
              <>
                <span style={{ fontWeight: "bold", cursor: "pointer", color: getUserColor(targetName) }} onClick={() => onSelectUser(targetName)}>
                  {targetName}
                </span>
                <span> 說</span>
              </>
            )}
            <span>：{messageText}</span>
          </>
        ) : (
          <>
            <span style={{ fontWeight: "bold", cursor: isSystem ? "default" : "pointer", color: isSystem ? color : getUserColor(userName) }} onClick={() => !isSystem && onSelectUser(userName)}>
              {userName}
            </span>
            {targetName && (
              <>
                <span> → </span>
                <span style={{ fontWeight: "bold", cursor: "pointer", color: getUserColor(targetName) }} onClick={() => onSelectUser(targetName)}>
                  {targetName}
                </span>
              </>
            )}
            <span>
              ：{isCurrencyAward && (
                <img
                  src={`/gifts/${roomConfig.currency_icon}`}
                  alt={roomConfig.currency_name}
                  style={{ width: 16, height: 16, verticalAlign: "middle", margin: "0 2px" }}
                />
              )} {legacyUI && isSystem ? boldAmounts(messageText) : messageText}
            </span>
          </>
        )}

        {Number(level) === Number(AML) && (m.ip || m.country) && (
          <span style={{ color: "#B84A4A", marginLeft: 4 }}>
            ({m.ip ? `IP: ${m.ip}${m.country ? " " : ""}` : ""}{m.country ? `${countryFlag(m.country.countryCode)} ${countryZh(m.country.countryCode) ?? m.country.country}` : ""})
          </span>
        )}
        <span style={{ fontSize: legacyUI ? "0.65rem" : "0.7rem", color: "#888", marginLeft: legacyUI ? 4 : 6, whiteSpace: "nowrap" }}>{timestamp}</span>
      </div>
    </div>
  );
});

function MessageList({
  messages = [],
  name = "",
  level = 1,
  typing = "",
  messagesEndRef,
  onSelectTarget,
  userList = [],
  scrollLocked = false,
  scrollLockedRef,         // 從 ChatApp 傳入的 ref，點擊時同步更新
  ownMessageLeft = roomConfig.own_message_left,
  legacyUI = false,
}) {
  const AML = roomConfig.admin_max_level || 99;
  const containerRef = useRef(null);
  const _localRef = useRef(scrollLocked);            // 沒傳 ref 時的後備
  const activeScrollLockedRef = scrollLockedRef || _localRef;
  const prevScrollLockedRef = useRef(scrollLocked);
  const prevLastMsgIdRef = useRef(null);
  // 沒有外部 ref 時才從 prop 同步（有外部 ref 則由 ChatApp 自行維護）
  if (!scrollLockedRef) _localRef.current = scrollLocked;

  // userList 在忙碌房間裡幾乎每個 updateUsers 廣播都會換一個新陣列參照，
  // 若直接把它當成 MessageRow 的 prop 往下傳，會逼著所有訊息列一起重新渲染。
  // 這裡改用 ref 存最新名單，在「渲染當下」同步寫入（不是 useEffect，避免讀到上一輪的舊快照），
  // 讓 getUserColor/lookupUser 這兩個傳給 MessageRow 的 callback 參照維持穩定，
  // MessageRow 才能真正跳過因在線名單變動而觸發的重新渲染。
  const userListRef = useRef(userList);
  userListRef.current = userList;

  const lookupUser = useCallback((userName) => {
    return userListRef.current.find((u) => u.name === userName);
  }, []);

  const getUserColor = useCallback((userName) => {
    const user = lookupUser(userName);
    if (!user) return "#00aa00";
    return user.gender === "男" ? "#A7C7E7" : user.gender === "女" ? "#F8C8DC" : "#00aa00";
  }, [lookupUser]);

  // scrollLocked 解除時立刻捲到底
  useLayoutEffect(() => {
    if (prevScrollLockedRef.current && !scrollLocked) {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    prevScrollLockedRef.current = scrollLocked;
  }, [scrollLocked]);

  // 手機鍵盤彈出/收起時，若非停止捲動就補捲到底
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleResize = () => {
      if (!activeScrollLockedRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    };
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", handleResize);
      return () => vv.removeEventListener("resize", handleResize);
    } else {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // 有新訊息時，依 scrollLocked 決定是否捲到底。
  // 用「最後一則訊息的 id」而非陣列長度判斷有沒有新訊息：
  // 訊息數量達到 MAX_MESSAGES 上限後，陣列長度會固定不再增加（appendMsg 會把最舊的截掉），
  // 若只看長度，訊息一多就會誤判成「沒有新訊息」而永遠不再自動捲動。
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const lastMsg = messages[messages.length - 1];
    const lastId = lastMsg?.id ?? null;
    if (lastId === null) { prevLastMsgIdRef.current = null; return; }
    if (lastId === prevLastMsgIdRef.current) return;
    prevLastMsgIdRef.current = lastId;
    if (activeScrollLockedRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSelectUser = useCallback((user) => {
    if (onSelectTarget && user && user !== name) onSelectTarget(user);
  }, [onSelectTarget, name]);

  const scrollToBottomOnImageLoad = useCallback(() => {
    const el = containerRef.current;
    if (el && !activeScrollLockedRef.current) el.scrollTop = el.scrollHeight;
  }, [activeScrollLockedRef]);

  const visible = messages.filter((m) => m && (m.mode !== "private" || m.user?.name === name || m.target === name || m.monitored));
  // 只把最近 RENDER_WINDOW 則實際掛載到 DOM；其餘仍完整保留在 state，只是不佔用畫面/DOM 節點。
  const windowed = visible.length > RENDER_WINDOW ? visible.slice(-RENDER_WINDOW) : visible;

  return (
    <div ref={containerRef} className="message-list">
      {windowed.map((m, i) => {
        // 訊息本身的作者名字顏色在寫入 state 時就已經帶好性別資料（見 useMessages.js 的 fullUser），
        // 不需要每次都跟在線名單核對，可以放心讓這一列長期沿用 memo 結果。
        // 但系統訊息裡提到的「其他人名」（進入聊天室/升級/煙火…）跟轉帳/禮物的收禮對象，
        // 是在渲染當下才去現查在線名單解析顏色——如果解析當下那個人剛好還沒被加進名單
        // （常見於「XXX 進入聊天室」這類訊息，跟名單廣播互有先後），
        // 就必須讓這一列在名單之後更新時「還有機會」重新算一次，否則顏色會凍結在第一次算出來的（通常是找不到人時的預設綠色）。
        const isSystemMsg = m.user?.name === "系統";
        const isTxOrGift = m.type === "transaction" || m.type === "gift";
        const rosterToken = (isSystemMsg || isTxOrGift) ? userList : STABLE_ROSTER_TOKEN;
        return (
          <MessageRow
            key={m.id ?? i}
            m={m}
            name={name}
            level={level}
            AML={AML}
            ownMessageLeft={ownMessageLeft}
            legacyUI={legacyUI}
            getUserColor={getUserColor}
            lookupUser={lookupUser}
            onSelectUser={handleSelectUser}
            scrollToBottomOnImageLoad={scrollToBottomOnImageLoad}
            rosterToken={rosterToken}
          />
        );
      })}

      {typing && <div className="typing fade-in" style={{ fontSize: "0.9rem", color: "#aaa", marginTop: 4 }}>{safeText(typing)}</div>}

      <div ref={messagesEndRef} />
    </div>
  );
}

export default memo(MessageList);
