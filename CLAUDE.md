# CLAUDE.md

Claude Code 在此專案工作的指引。後端在 `../chatroom_backend`（有自己的 CLAUDE.md）。

## 指令

```bash
npm run dev       # Vite 開發伺服器（port 5173）
npm run build     # 打包正式版
npm run preview   # 預覽打包結果
```

沒有 lint / test。改完至少跑一次 `npm run build`。

## 架構

- React 18 + Vite 單頁應用，介面全繁中；Bootstrap 5.3.3 從 CDN 載入。
- 路由（`src/App.jsx`）：`/`、`/login` → `features/auth/Login.jsx`；`/chat` → `features/chat/ChatApp.jsx`（核心）；另有 `/pusher-demo` 等 `*Demo.jsx` 展示頁（純前端假資料）。
- 登入狀態存在 `sessionStorage`（`token`、`name`、`level`、`apples`…），登出即清空。
- **Socket**：全專案唯一實例在 `shared/socket.js`，由 `ChatApp.jsx` 以 prop 傳給子元件；身分靠各事件帶 `token`。`ChatApp.jsx` 的 socket handler 刻意用 ref 讀最新狀態，**不要改成依賴 state 的 closure**。
- **房間設定（`shared/roomConfig.js`）**：啟動時 `loadRoomConfig()` 讀 `/api/room-config`，`Object.assign` 進共用物件。功能開關、管理員等級（`admin_min_level`/`admin_max_level`/`mini_admin_level`）、貨幣名稱、冷卻秒數等**全部由後端決定**，不是寫死、也不是環境變數。後台改設定會推 `roomConfigUpdate`，部分設定即時生效。
- 環境變數只有 `VITE_APP_VERSION`、`VITE_BACKEND_URL`、`VITE_ROOM_NAME`。

## 目錄

| 路徑 | 內容 |
|---|---|
| `features/auth/` | `Login.jsx`：訪客/帳號登入、註冊、編輯資料、忘記密碼（`?mode=`） |
| `features/chat/` | `ChatApp.jsx`（中樞，監聽大部分 socket 事件、延遲載入重的面板）、`MessageList.jsx`、`UserList.jsx`、`SongRoom.jsx`/`Listener.jsx`（LiveKit 唱/聽）、紅包 `RedEnvelopeGame.jsx`、慶典 `CelebrationModeGame.jsx`、商城、排行榜、留言板等 |
| `features/admin/` | `AdminToolPanel.jsx`（🛡 管理，分頁容器）、`AdminSettingsModal.jsx`（⚙️ 遊戲/經濟設定）、`AdminRoomSettingsPanel.jsx`（房間設定）、`AdminLevelPanel.jsx` + `LevelTitlePanel.jsx`（等級管理 / 等級稱謂）、各種紀錄面板 |
| `features/games/` | 排程小遊戲：金蘋果系列、接櫻桃、撒櫻桃、挖寶 `DigTreasureGame.jsx`、捕魚 `FishingGame.jsx`、小瑪莉、跑馬燈 |
| `features/casino/` | 賭場/遊樂場（21點、輪盤、骰寶、拉霸、百家樂、賽車、殭屍、推幣機＝Phaser + Matter）。`PusherPhysics.js` 是沒人引用的死碼 |
| `shared/` | `socket.js`、`roomConfig.js`、`levelTitles.js`、`FloatingPortal.jsx`、`hooks/useDraggable.js`、`hooks/useUserState.js`、`hooks/useMessages.js`、`utils.js`、`constants.js` |

## 慣例與注意事項

- **管理權限檢查是分散的**：有些面板自己檢查等級，有些信任呼叫端。新增管理功能時，前端要擋、後端也要擋。
- **後台設定存檔**：兩個設定面板都打 `/admin/set-settings`，用 `diffSettings()` 只送改過的欄位，避免互相覆蓋。
- **浮動管理視窗**要透過 `FloatingPortal` 掛到 `<body>`，並搭配 `useDraggable`。不要渲染在聊天輸入列裡，否則手機上會定位錯亂（✖ 被切掉、拖不動）。視窗高度上限 80vh、內容區內部捲動。
- **小遊戲反作弊**：結算以伺服器數字為準；前端只在 `playing` 階段才回報本地數字，其他階段一律回報 0。
- **等級**一律用在線名單（伺服器給的值）判斷，不採信訊息裡前端自帶的等級。
- 檔案換行符號有 LF 也有 CRLF，修改時要維持原檔的格式。

## 金幣房 / 櫻桃房功能重點

依 `roomConfig.currency_name` 判斷：`"金幣"` 為金幣房，含「櫻桃」為櫻桃房。

- **紅包／慶典分配**：份數＝大廳顯示總人數（含虛擬帳號與發起人；隱身者不算；AI 只在 `openai` 開啟時算）。只有其他真人玩家會實際入帳。紅包的均分/隨機由後台決定；慶典由發起人自己選（`startCelebration` 帶 `mode`），可自訂金額（上限 `celebration_max_amount`）。
- **挖寶**：`dig_times` 多時段字串（同撒櫻桃）＋ `dig_hole_count` 格數，`digGameStart` 會帶 `holeCount`。
- **捕魚**：魚的位置由伺服器給的 `spawnAt`/`duration` 加上校正後的伺服器時間算出。池塘尺寸用 `ResizeObserver` 追蹤，時鐘用 `fishingTimeSync` 來回校正。游速 `fishing_fish_speed` 由後端換算。
- **等級稱謂／圖案／進場歡呼**（`roomConfig.level_titles`，只有金幣房、櫻桃房開放）：透過 `shared/levelTitles.js` 的 `resolveLevelInfo()` 查詢。
  - 稱謂只在滑鼠移到頭像、圖案或暱稱時以提示框顯示。
  - 在線名單的等級圖案用這份設定。
  - 「熱烈歡迎」進場橫幅要 `cheer_enabled` 開啟且該區間有勾歡呼才顯示。
  - 沒設定過時，後端回傳櫻桃房原始表當預設。
  - 後台修改後，`ChatApp` 的 `levelTitlesVersion` 會遞增，觸發重繪。
- **高階進場歡迎詞**由後端在 `joinRoom` 時廣播，前端不用另外處理。
