# CLAUDE.md

本文件為 Claude Code（claude.ai/code）在此專案中工作時的指引。後端通常在../chatroom_backend

## 指令

```bash
npm run dev       # 啟動 Vite 開發伺服器（port 5173）
npm run build     # 打包正式版
npm run preview   # 預覽打包後的正式版
```

沒有設定 lint / test 指令。

## 架構總覽

這是一個 React 18 + Vite 的單頁應用，做的是有遊戲化元素的即時聊天室，由一個 WebSocket 後端（`chatroom_backend`）驅動。介面全部是繁體中文（`index.html` 的 `lang="zh-Hant"`），Bootstrap 5.3.3 CSS 是從 CDN 載入，不是打包進 npm 依賴裡。`vite.config.js` 很單純，只有 `@vitejs/plugin-react`，沒有路徑別名。

**路由（React Router v6，見 `src/App.jsx`）：**
- `/` 或 `/login` → `features/auth/Login.jsx` — 訪客/帳號登入、註冊、編輯資料、忘記密碼
- `/chat` → `features/chat/ChatApp.jsx` — 聊天室主畫面（整個 app 的核心）
- `/pusher-demo` → `features/casino/PusherDemo.jsx`（lazy load）— 推幣機獨立展示頁，純前端假資料，不連後端，方便單獨調整推幣機物理效果

**Session Storage：** 登入狀態存在 `sessionStorage`（`name`、`gender`、`level`、`exp`、`apples`、`token`/`guestToken`、`type`、`avatar`、`room`、`invisible`…）。登出會清空。分頁關閉時 `beforeunload` 會用 `keepalive` 打一支 `/auth/logout`。

**即時通訊：** 唯一的 Socket.io client 實例在 `src/shared/socket.js`，全專案共用（`io(BACKEND, { withCredentials: true, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000 })`）。連線時不帶 `auth` payload，身分驗證是連線後透過各事件帶 `token` 完成。大部分子元件（小遊戲、面板）不會自己 import 這個 socket，而是由 `ChatApp.jsx` 當 prop 往下傳。`ChatApp.jsx` 裡的 socket handler 都用 ref 讀最新狀態避免 closure 過期問題——這是刻意設計，不要改成直接依賴 state 的 closure 寫法。

**執行期房間設定（`src/shared/roomConfig.js`）：** 開頭是一個共用、可變動的 `_cfg` 物件（預設值），App 啟動時呼叫 `loadRoomConfig()` 打一次 `${BACKEND}/api/room-config?room=${RN}`，把後端回傳的資料 `Object.assign` 進 `_cfg`。**幾乎所有功能開關/管理員等級/貨幣名稱/冷卻秒數都是從這裡讀，不是寫死在前端、也不是 build-time 的環境變數**：`admin_max_level`、`admin_min_level`、`openai`、`new_function`、`new_section`、`open_peony`、`leaderboard_enabled`、`own_message_left`、`legacy_chat_ui`、`message_cooldown_seconds`、`currency_name`/`currency_icon`/`currency_emoji`、`nickname_max_length`、`livekit_url`、`room_setting`。這代表後端管理後台改設定，前端不用重新部署就會生效（下次載入頁面時）。

## 模組結構

| 目錄/檔案 | 職責 |
|---|---|
| **features/auth/** | |
| `Login.jsx` | 單一元件涵蓋 5 種模式（`guest`/`login`/`register`/`edit`/`forgot`，由 `?mode=` query 決定初始模式）：訪客登入（`/auth/guest`）、帳號登入（`/auth/login`，等級 ≥ `admin_max_level` 會跳出「隱形模式」確認框）、註冊（`/auth/register`）、編輯資料（先重新登入再 `/auth/updateProfile`，改名會 `socket.emit("updateMyName", ...)`）、忘記密碼（`/auth/forgotPassword`）。頭像選單資料來自 `shared/aiConfig.js` 的 `aiAvatars` |
| **features/chat/** — 核心聊天室，見下方細節 | |
| `ChatApp.jsx` | **整個 app 的中樞**（約 1344 行）：檔頭註解自述是「優化過」的版本——訊息佇列有上限、socket handler 用 ref 轉發避免重新綁定、`useMemo` 算可視訊息、把使用者狀態/訊息佇列抽成 `useUserState`/`useMessages` 兩個 hook、常數集中管理、關鍵區塊包 `AppErrorBoundary`。持有約 30 個 `useState`（面板顯示旗標、聊天目標/模式、使用者清單、影片狀態、輸入狀態、小遊戲啟動旗標…）與約 13 個 `useRef`（供 socket handler 讀最新值）。監聽 19 種 socket 事件（`roomConfigUpdate`、`updateUsers`、`message`、`systemMessage`、`videoUpdate`、`transferMessage`、`giftMessage`、`goldenAppleSurprise`、`peonySent`、`marqueeStart/End`、`frontendVersionUpdated`、`goldAwarded`、`joinFailed`、`fireworkShow`、`forceLogout`、`kickFailed`…），會送出約 12 種事件（`heartbeat`、`joinRoom`、`leaveRoom`、`message`、`playVideo`、`startMarquee`、`kickUser`、`muteUser`、`rpsChallenge`、`pingpongChallenge`…）。常駐掛載 MessageList、VideoPlayer（包在 VideoSafeBoundary 裡）、SongRoom、Listener、UserList（包在 AppErrorBoundary 裡）、RPS、PingPong 等；透過自訂的 `DeferredPanel`（`lazy()` + `Suspense`）延遲載入約 11 個較重的面板：AdminSettingsModal、AdminToolPanel、ShopPanel、MessageBoard、Leaderboard、CasinoPanel，以及 GoldAppleGame/WhackAppleGame/ClawMachineGame/CherryTreeGame/MarqueeGame 等小遊戲 |
| `MessageList.jsx` | 訊息串主體。非管理員看不到不是寄給/來自自己的私聊訊息（`monitored` 旗標給管理員看全部）。處理捲動鎖定/自動捲到底、手機鍵盤彈出時的視窗高度調整。用 regex 從系統訊息解析出「相關使用者」（進場/升級/積分球/在線獎勵/煙火/唱歌時間），並加色連結該名字。`type: "surprise"`/`"peony"` 有專屬版面；`transaction`/`gift` 訊息顯示禮物圖示。AI 私聊訊息顏色依 `aiConfig.getAiAvatar` 覆蓋。只有檢視者等級剛好等於 `admin_max_level` 時才會在訊息旁顯示 IP 對應的國家旗（`countryZh`）。`legacyUI` prop（預設 `false`）是本檔目前唯一的新舊介面差異點——切換私聊標籤是顯示 `(私聊)` 還是 `(密)` |
| `Listener.jsx` | 聽眾端：透過 LiveKit 訂閱現任歌手的音訊（不發布），監聽 `micStateUpdate` 取得目前/下一位歌手與倒數，`autoSubscribe: true` 純聽模式，track 訂閱/取消時動態掛載/卸載 `<audio>`。本地使用者開始唱歌時自動停止收聽，唱完自動恢復。透過 `startListen`/`stopListen` command ref 供舊版介面的「功能選單」呼叫 |
| `SongRoom.jsx` | 歌手端（LiveKit 發布者，跟 `Listener.jsx` 是一組）：透過 socket 管理排麥（`joinQueue`/`leaveQueue`/`grabMic`/`stopSing`，監聽 `yourTurn`/`micStateUpdate`/`forceStopSing`），搶到麥克風時跟後端要 `livekit-token`，用 `getUserMedia`（關閉回音消除/降噪）發布音軌。可拖曳/收合的排隊面板；管理員（等級 ≥ `admin_min_level`）可以強制踢除/調整排隊順序/強制換下一位/加唱歌時間（上限 `MAX_SING_DURATION`=5000 秒）。同樣透過 `startVoice`/`stopVoice` 供舊版「功能選單」呼叫 |
| `UserList.jsx` | 可收合的在線使用者側欄；`roomConfig.openai` 關閉時隱藏 AI 使用者。點擊使用者設定聊天對象/模式。顯示性別色名字、等級、金牡丹徽章（`roomConfig.open_peony` 開啟時）。每人有「互動」選單：剪刀石頭布/桌球挑戰（所有人）、訊息篩選/靜音（純前端）、管理員操作——踢人（等級 ≥ `admin_min_level` 且目標等級較低）、禁言 30 秒、踢人並封鎖（IP+暱稱，需填理由，等級 ≥ `admin_max_level`） |
| `AnnouncementPanel.jsx` | 可拖曳的浮動公告檢視/編輯器（`/api/announcement*`），`◀`/`▶` 切換公告；編輯/新增/刪除限 `admin_max_level` |
| `ColorSwatchPicker.jsx` | 約 33 種聊天文字顏色的下拉選單，每個選項用自己的顏色顯示 |
| `FunctionMenuPicker.jsx` | 通用 `{label, onClick}` 下拉選單元件，承載舊版介面的「功能選單」動作 |
| `Leaderboard.jsx` | 排行榜彈窗，類型（貨幣/魅力/煙火/經驗）× 區間（總計/本月/上月），資料來自 `/api/gold-apple-leaderboard`、`/api/exp-leaderboard` |
| `MessageBoard.jsx` | 公開/私人留言板（`/api/message-board*`），發文/刪除/管理員回覆；私人「悄悄話」只有作者+管理員看得到 |
| `MessageLogPanel.jsx` | 管理員專用（`admin_max_level`）發言紀錄查詢（`/admin/message-logs`），可依帳號/對象/關鍵字/日期篩選，附 IP/國家 |
| `MyMessageLogPanel.jsx` | 自助版，查 `/admin/my-message-logs`，固定查自己、不需帳號篩選 |
| `PingPong.jsx` | 完整的桌球小遊戲彈窗：挑戰/接受/拒絕流程 + 即時球拍/球畫面（`pingpongState`/`pingpongStart` 事件） |
| `QuickPhrasePanel.jsx` | 個人快速回覆片語的 CRUD 下拉選單（`/api/quick-phrases*`），可插入聊天輸入框；可用 `openSignal` prop 從外部開啟 |
| `RPS.jsx` | 剪刀石頭布彈窗，跟 PingPong 同一套挑戰/socket 模式，每回合倒數 10 秒 |
| `ShopPanel.jsx` | 聊天室內商城彈窗（鑽石、飛機、跑車、煙火、經驗球、升級卡），透過 `/api/shop/buy` 購買 |
| `SurpriseHistoryPanel.jsx` | 管理員用，查最近 10 天的「驚喜抽獎」紀錄（`/admin/surprise-history`） |
| `TextEmotionPicker.jsx` | 約 50 種預設中文情緒/動作字串的下拉選單，可插入訊息 |
| `VideoPlayer.jsx` | 浮動的 YouTube 播放器（`react-youtube`），處理觸控裝置的自動播放靜音變通、關閉時的清理 |
| `VideoSafeBoundary.jsx` | 專門包 `VideoPlayer` 的 class-based error boundary（例如擋掉瀏覽器擴充功能造成的當機） |
| **features/admin/** — 全部限管理員使用，見下方細節 | |
| `AdminToolPanel.jsx` | 實際的分頁容器/進入點（「🛡 管理」按鈕）：房間設定/登入紀錄/發言紀錄/等級管理/調整紀錄（`admin_max_level`）、暱稱管理（`admin_min_level`）、IP 管制（僅 `admin_max_level`）分頁，組合其他面板當內容 |
| `AdminAdjustmentLogPanel.jsx` | 兩個分頁：等級/經驗/金幣調整紀錄（`/admin/adjustment-logs`）、金牡丹調整紀錄（`/admin/peony-logs`，僅 `roomConfig.open_peony` 開啟時顯示） |
| `AdminIPPanel.jsx` | IP 封鎖清單管理（附國旗/國名），封鎖/解封走 `/api/blocked-ips*` |
| `AdminLevelPanel.jsx` | 搜尋使用者並就地編輯等級/經驗/金幣/金牡丹，每次都要填理由，各自打不同的 `/admin/set-user-*` |
| `AdminLoginLogPanel.jsx` | 分頁式登入紀錄（`/admin/login-logs`），可依日期篩選，含 IP+國家、成功/失敗 |
| `AdminNicknamePanel.jsx` | 暱稱封鎖清單管理；門檻最低的面板（`admin_min_level`） |
| `AdminPeoniesPanel.jsx` | 獨立的金牡丹管理工具：查餘額、設定新數量（需理由）、變動紀錄；本身沒有等級檢查 |
| `AdminRoomSettingsPanel.jsx` | 房間層級開關（顯示名稱、AI 陪聊、開放訪客登入、顯示 IP、強制訊息靠左、舊版聊天介面、冷卻秒數、暱稱長度上限，以及 `new_function` 底下的金牡丹/同 IP 贈禮開關），透過 `/admin/set-settings` 儲存 |
| `AdminSettingsModal.jsx` | 最大的一份（約 975 行）：完整的經濟/遊戲設定（每日獎勵、轉帳限額、跑馬燈、每個小遊戲/賭場遊戲各自的開關+排程+機率，含 `new_section` 底下的接櫻桃/推幣機/賽車/殭屍生存）。讀寫 `/admin/settings`、`/admin/set-settings`。本身沒有等級檢查——是由 `ChatApp.jsx` 的 `showAppleSetting` 狀態在外部控制顯示 |
| **管理面板的權限檢查模式：不是統一集中的，而是分散且不太一致**——`AdminToolPanel` 自己檢查 `admin_min_level`，分頁按鈕再各自內嵌等級檢查；`AdminIPPanel`/`AdminLoginLogPanel` 自己檢查 `admin_max_level`；`AdminNicknamePanel` 自己檢查 `admin_min_level`；`AdminLevelPanel` 靠父層傳入的 `minLevel` prop；`AdminAdjustmentLogPanel`/`AdminRoomSettingsPanel`/`AdminPeoniesPanel`/`AdminSettingsModal` 完全沒有內部檢查，信任呼叫端。`shared/AppErrorBoundary.jsx`（generic class-based error boundary，`{label}發生錯誤，請重新整理頁面`）只用在 `ChatApp.jsx` 裡包整個管理工具區塊（兩處）跟 `UserList`，不是每個管理子面板各自包一層 | |
| **features/casino/** | |
| `CasinoPanel.jsx` | 分頁容器（223 行）。`variant` prop 是 `"casino"` 或 `"playground"`：casino 分頁是 21點/輪盤/骰寶/拉霸/百家樂（+ 可選推幣機），playground 分頁是推幣機/賽車/殭屍生存。所有遊戲都 `lazy()` 載入、共用一個 `Suspense`。推幣機分頁切走時只是 `display:none` 隱藏、不會卸載，藉此保留物理狀態 |
| `BaccaratGame.jsx` / `BlackjackGame.jsx` | 百家樂（莊/閒/和下注）、21點（要牌/停牌/加倍），兩者都用 `CardFaces.jsx` 畫牌面 |
| `CardFaces.jsx` | 百家樂、21點共用的牌面渲染元件 |
| `RouletteGame.jsx` | 輪盤（號碼/顏色/組合下注） |
| `SicBoGame.jsx` | 骰寶 |
| `SlotMachine.jsx` | 拉霸機 |
| `RacingGame.jsx` | 賽車下注小遊戲（playground 分頁） |
| `ZombieSurvivalGame.jsx` | 殭屍生存跑酷小遊戲（playground 分頁） |
| `PusherMachine.jsx` + `pusher/PusherGameScene.js` + `pusher/SoundManager.js` | 推幣機。**實際上是用 Phaser 做的**（`PusherMachine.jsx` 是掛載 Phaser game 的 React 外殼），物理效果是 Phaser 內建的 Matter 外掛（`this.matter.world`／`this.matter.add.rectangle/image`），所有幣/獎品物理、推板運動、瞄準發射、碰撞都在 `PusherGameScene.js`（Scene 子類別，555 行）裡；`SoundManager.js` 是音效輔助 |
| `PusherPhysics.js` | **這是孤兒程式碼、目前沒有任何地方引用**——直接 import 獨立的 `matter-js` 套件，重複實作了一個 `createPusherWorld()`，功能已被 `pusher/PusherGameScene.js`（Phaser+Matter 外掛）取代，可視為待清理的死碼 |
| `PusherDemo.jsx` | 對應 `/pusher-demo` 路由的獨立展示頁，純前端假資料 `<PusherMachine demo .../>`，不連後端 |
| **features/games/** — 排程型小遊戲，皆採「30 秒預告 → idle/playing/result 三段式 phase → client 暫報分數，結束時以伺服器權威分數為準」的共同模式 | |
| `CherryTreeGame.jsx` | 接櫻桃（`new_section` 模式專屬）。大樹持續掉落櫻桃，玩家移動籃子接取，每接到即時上報，時間到後有 1.5 秒結算視窗讓前端補交本地接取數，最終以後端數字為準（詳見下方反作弊說明）。`legacyUI`／`phaseRef` 判斷：非 `"playing"` 階段收到 `cherryGameEnd` 時一律回報 0，避免殘留上一輪資料被誤用 |
| `GoldAppleGame.jsx` | 兩種子遊戲：(1) 多顆金蘋果同時彈跳落下，拖曳網子即時撈取；(2) 單顆大金蘋果彈跳，先點先得全部。自製彈跳物理，獎勵透過 `setApples`+`/auth/me` 刷新 |
| `WhackAppleGame.jsx` | 3×3 打地鼠式打蘋果，隨機冒出間隔，10 秒/20 秒時難度遞增，380ms 命中鎖定防連點，1.5 秒無操作連擊歸零 |
| `ClawMachineGame.jsx` | 夾金蘋果機：爪子自動左右擺動，玩家按鈕/空白鍵下爪，伺服器依 40 格預設蘋果佈局驗證是否夾到，RAF 驅動物理效果 |
| `MarqueeGame.jsx` | 跑馬燈抽獎：使用者名稱橫向捲動（排除 AI），逐漸減速停在伺服器指定的贏家上；純觀眾端展示，不會送出任何事件 |
| **shared/** | |
| `socket.js` | 全專案唯一共用的 Socket.io client 實例（見上方「即時通訊」） |
| `roomConfig.js` | 執行期房間設定快取 + `loadRoomConfig()`（見上方「執行期房間設定」）；也匯出 `BACKEND`（`VITE_BACKEND_URL`）、`RN`（`VITE_ROOM_NAME`） |
| `constants.js` | `MAX_MESSAGES`=500、`HEARTBEAT_INTERVAL`=10000ms、`PENDING_LEAVE_DELAY`=3000ms、`EXP_TIP_DURATION`=1000ms、`LEVEL_UP_TIP_DURATION`=1200ms、`GENDER_COLORS`、`SYSTEM_AVATAR` |
| `utils.js` | `expForNextLevel(level)`（等級/經驗公式）、`safeText(v)`（把各種訊息形狀安全轉成字串，避免直接 render 物件） |
| `hooks/useUserState.js` | 管理目前登入使用者的所有狀態：從 `sessionStorage` 初始化、打 `/auth/me` 拿最新資料、處理 `updateUsers` 事件裡「自己」欄位的變化、飄動的 EXP/升級提示動畫；全程用 ref 讀最新值避免 socket handler 需要重新綁定 |
| `hooks/useMessages.js` | 維護有上限（`MAX_MESSAGES`）的訊息佇列；離開訊息延遲 `PENDING_LEAVE_DELAY` 顯示，快速重連時可被取消，藉此避免斷線閃爍造成的進出訊息洗版 |
| `hooks/useClickOutside.js` | 點擊元件外部關閉下拉/彈窗的共用 hook |
| `aiConfig.js` | `aiAvatars`（25 組 `[名字, 頭像網址]`，供 Login 頭像選單用）、`getAiAvatar(name)`、`aiProfiles`（18 個 AI 角色的完整人設：顏色/台詞/回覆模板/等級/性別/職業/頭像，驅動模擬 AI 聊天回應） |
| `countryZh.js` | 約 150 組 ISO 3166-1 alpha-2 國碼 → 繁體中文國名對照，`countryZh(code)` 查詢函式；供 `MessageList`/`MessageLogPanel`/`AdminIPPanel`/`AdminLoginLogPanel` 顯示 IP 對應國家用 |
| `AppErrorBoundary.jsx` | 通用 class-based React error boundary，`{label}發生錯誤，請重新整理頁面`（`label` 預設「此區塊」），只在少數幾處包裹關鍵區塊（見上方管理面板說明） |

## 關鍵領域概念

- **使用者類型：** `guest`（無帳號）vs `account`（已註冊）；管理員等級 91–99（實際數字來自 `roomConfig.admin_min_level`/`admin_max_level`，由後端 `room_settings`/`backend_setting` 決定，不是寫死或環境變數）
- **等級系統：** 會員等級 1–90（上限是 `admin_min_level - 1`）；每級所需 EXP = `floor(120 * level² + 200)`；公式在 `shared/utils.js`
- **貨幣：** 房間可自訂名稱/圖示/emoji（`roomConfig.currency_name`/`currency_icon`/`currency_emoji`，預設「金蘋果」🍎）；轉帳走 `POST /api/transfer-gold`；上限由後端 `MAX_GOLD_APPLES` 控制。**UI 細節：**「XXX樂園」這個字樣只在貨幣就是預設的「金蘋果」時才顯示（`ChatApp.jsx`），其他自訂貨幣名稱不會顯示這個字樣，只顯示圖示跟數量
- **訊息模式：** `public`、`private`（只有寄件人+收件人看得到，管理員可監看）、`publicTarget`（大家都看得到但特別標明對象）
- **中文轉換：** `opencc-js` 把訊息內容從簡體轉繁體再送出
- **新舊介面：** `roomConfig.legacy_chat_ui` 決定 `ChatApp.jsx` 用新版還是舊版（`legacyChatUI` state，CSS 上是 `chat-layout--legacy`）輸入區排版；`MessageList.jsx` 的 `legacyUI` prop 會把私聊訊息的標籤從 `(私聊)` 換成 `(密)`；舊版介面的「功能選單」（`FunctionMenuPicker.jsx`）是透過 `Listener.jsx`/`SongRoom.jsx` 暴露出來的 `start/stopListen`、`start/stopVoice` command ref 觸發聽/唱

## 重要常數（`constants.js`）

| 常數 | 值 | 用途 |
|---|---|---|
| `MAX_MESSAGES` | 500 | 訊息佇列上限 |
| `HEARTBEAT_INTERVAL` | 10000ms | Socket 心跳間隔 |
| `PENDING_LEAVE_DELAY` | 3000ms | 離開訊息延遲顯示，過濾快速重連雜訊 |
| `EXP_TIP_DURATION` | 1000ms | EXP 飄字顯示時間 |
| `LEVEL_UP_TIP_DURATION` | 1200ms | 升級提示顯示時間 |

發言冷卻秒數現在是 `roomConfig.message_cooldown_seconds`（後端每房間可調），**不再**是寫死的前端常數。

## 環境變數（`.env`）

實際會用到的只有這 3 個（已用 grep 全專案驗證）：

| 變數 | 用途 |
|---|---|
| `VITE_APP_VERSION` | 回報給後端 `/frontend-version-report` 的版本字串，後端會廣播 `frontendVersionUpdated` 通知舊分頁刷新 |
| `VITE_BACKEND_URL` | 後端 API/Socket.io 位址（目前設定為 `https://chatroom-backend.ek21.com`） |
| `VITE_ROOM_NAME` | 預設房間名稱 |

**注意：** `VITE_OPENAI`、`VITE_NEW_FUNCTION`、`VITE_ADMIN_MIN_LEVEL`/`VITE_ADMIN_MAX_LEVEL`、`VITE_MAX_GOLD_APPLES`、`VITE_LIVEKIT_URL` 這些**都不存在**於目前程式碼中——這些功能開關/門檻值全部改成執行期從後端 `/api/room-config` 抓（見上方「執行期房間設定」），前端完全沒有對應的 build-time 環境變數了。

## 小遊戲反作弊模式

`CherryTreeGame.jsx`（以及 `GoldAppleGame.jsx`/`WhackAppleGame.jsx`/`ClawMachineGame.jsx`）都採同一套模式：時間到時進入 `result` phase，client 端會把本地觀察到的接取/命中數送給後端做結算，後端會拿伺服器自己追蹤的權威數字跟 client 回報的數字比對，取較高值但設有上限，且**當伺服器端該玩家的計數是 0 時，一律以 0 為結算結果，不會採信 client 回報的數字**——這是為了防止「整個房間在回合結束瞬間斷線重連」時，client 端殘留的上一輪資料被誤當成這一輪的成績（`CherryTreeGame.jsx` 的 `onEnd` 只在 `phaseRef.current === "playing"` 時才會回報非零的本地接取數，否則一律回報 0；對應的後端邏輯在 `chatroom_backend/src/game/cherryTreeGame.js`）。
