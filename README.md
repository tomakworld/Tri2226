# 訓練課表集（A 版，四份合一）

Vite + React，用 hash 路由把四份課表放在同一個網站。

| 網址 | 內容 |
|---|---|
| `/` | 三鐵 226/113 產生器 |
| `/#/season` | Season 超長距離（游 5k / 騎 205k / 跑 50k） |
| `/#/sub3` | Sub-3 全馬產生器（任何人填自己的數據） |
| `/#/tomak` | tomak 專屬 Sub-3（2027/01/10 渣打） |

## Zeabur 部署

直接把整個資料夾推上 Git，Zeabur 會自動偵測成 Vite 專案。

- Build command：`npm run build`
- Output directory：`dist`
- Node：18 以上（package.json 的 engines 已指定）

## ⚠️ build failed 的話，先看這三個

1. **devDependencies 不要有 `playwright`、`puppeteer`**
   它們的 postinstall 會下載幾百 MB 的瀏覽器，build 容器常常在這裡掛掉。
   本專案已移除。如果你本機跑過測試又裝回去了，推之前要再刪掉。

2. **檔名大小寫要完全一致**
   Linux 容器區分大小寫，`main.jsx` 寫 `./Tomak.jsx`，檔案就必須叫 `Tomak.jsx`。
   直接把下載的 `tomak-sub3.jsx` 丟進 src/ 是不行的 —— 一定要改名。

3. **package-lock.json 要跟 package.json 同步**
   改過 package.json 就重跑一次 `npm install` 讓 lock 更新，不然 `npm ci` 會失敗。

## 要新增第五份課表

三個步驟缺一不可（只丟檔案進去是沒有用的，路由找不到會退回第一個）：

1. 檔案放到 `src/`，開頭大寫，例如 `src/Alice.jsx`
2. `src/main.jsx` 最上面加一行 import：
   ```js
   import AlicePlan from "./Alice.jsx";
   ```
3. 同一個檔案的 `ROUTES` 陣列加一筆：
   ```js
   { hash: "#/alice", label: "Alice", el: <AlicePlan /> },
   ```

## 只是要換掉某一份課表

把新的 .jsx 覆蓋到對應檔名就好，main.jsx 不用動：

| 課表 | 檔名 |
|---|---|
| 三鐵產生器 | `src/App.jsx` |
| Season | `src/Season.jsx` |
| Sub-3 產生器 | `src/Sub3.jsx` |
| tomak | `src/Tomak.jsx` |

## 本機跑

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 產生 dist/
npm run preview  # 預覽 build 結果
```
