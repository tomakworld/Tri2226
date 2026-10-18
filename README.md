# 訓練課表 · 四合一

一個 Vite + React 專案,四份課表用 hash 路由分開。

| 路徑 | 內容 |
|---|---|
| `/` | 三鐵通用產生器(226 / 113) |
| `#/season` | Season 超長距離(游5k / 騎205k / 跑50k,2026-11-08) |
| `#/sub3` | Sub-3 全馬產生器(任何人填自己的數據) |
| `#/tomak` | tomak 專屬 Sub-3(2027-01-10 渣打) |

## 為什麼不能直接開 .jsx

`.jsx` 是 React 原始碼,瀏覽器看不懂。要先經過 build 變成 HTML + JS 才能開。
這個資料夾就是建好的專案,照下面做即可。

## Zeabur 部署

1. 把整個資料夾推到一個 GitHub repo(或直接用 Zeabur 的上傳)
2. Zeabur 會自動偵測到 Vite,不用額外設定
3. 若要手動指定:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

Zeabur 偵測為 Static 時只要 `dist` 就好;偵測為 Node 服務時會跑 `npm run preview`,
vite.config.js 裡已經設好 `host: 0.0.0.0` 與 `PORT` 環境變數,兩種都能動。

## 本機測試

```bash
npm install
npm run dev        # 開發,看 http://localhost:5173
npm run build      # 產生 dist/
npm run preview    # 預覽 build 後的結果
```

## 之後要更新某一份課表

把新的 .jsx 覆蓋到對應檔案就好,其他都不用動:

| 課表 | 檔案 |
|---|---|
| 三鐵產生器 | `src/App.jsx` |
| Season | `src/Season.jsx` |
| Sub-3 產生器 | `src/Sub3.jsx` |
| tomak | `src/Tomak.jsx` |

注意:這四個檔的 `export default` 名稱不同(IronmanPlan / SeasonPlan / Sub3Plan / App),
但 `main.jsx` 是用 default import,所以換檔案不用改 main.jsx。

## 資料儲存

每份課表的設定存在瀏覽器 localStorage,各自獨立的 key。
Sub-3 產生器另外支援 `?d=` 網址參數,複製連結就能把設定帶到別的裝置。
手機瀏覽器可能清除網站資料,建議把連結加入書籤或主畫面。
