import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    // 舊瀏覽器（不支援 ES modules / 用到的 ?. ?? 等新語法）會另外拿到一份降級+polyfill
    // 過的 bundle（透過 <script nomodule> 載入），避免現代語法直接讓整包 script 解析失敗、
    // 畫面卡在空白 #root + 深色 body 背景變成「黑屏」
    legacy(),
  ],
})