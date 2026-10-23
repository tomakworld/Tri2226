# 訓練課表（三份合一）

Vite + React。`npm run build` → `dist/`，整個 dist 可以直接丟任何靜態主機。

| 網址 | 內容 | 實作 |
|---|---|---|
| `/` | 三鐵 226/113 產生器 | React，`src/App.jsx` |
| `/#/season` | Season 超長距離（游 5k / 騎 205k / 跑 50k） | React，`src/Season.jsx` |
| `/run/` | 跑跑跑，向前跑（全馬課表產生器） | 單檔 HTML，`public/run/index.html` |

**兩種東西混在一起，這點要記得：** 前兩份是 React 元件、走 hash 路由；跑跑跑是一個自己完整的 HTML 檔，放在 `public/` 讓 Vite 原樣複製過去，所以 `main.jsx` 裡它是一般連結（`run/`）不是路由。這樣做的好處是它不用改寫成 JSX，壞處是點過去就離開 SPA —— 它左上角的標題連回 `../` 當返回鍵。

## Zeabur 部署

推整個資料夾上 Git 就好，`zbpack.json` 已經指定好：

```json
{ "build_command": "npm ci --no-audit --no-fund && npm run build",
  "output_dir": "dist", "cache_dependencies": false }
```

`output_dir` 一設，Zeabur 就用 Caddy 當純靜態站台，不會去跑 Node server。

## build failed 的話

**先看 ERROR 那行的上面幾行** —— 真正的原因在那裡（`npm ERR!`、`Could not resolve`、`[vite:...]`），`exit code: 1` 本身沒有資訊。

依序檢查：

1. **devDependencies 不要有 `playwright`、`puppeteer`**
   Zeabur 看到這兩個會自動幫你準備瀏覽器環境，下載幾百 MB，常常就掛在這。本專案已移除。
2. **檔名大小寫**
   Linux 容器區分大小寫。`main.jsx` 寫 `./Season.jsx`，檔案就必須是 `Season.jsx`。
3. **package-lock.json 要同步**
   改過 package.json 就重跑 `npm install` 更新 lock，不然 `npm ci` 直接失敗。
4. **Node 版本**
   `engines` 已鎖 22.x、`packageManager` 已鎖 npm，Zeabur 預設是 yarn，不鎖會用錯的。

## 要換掉某一份

| 課表 | 覆蓋這個檔 | main.jsx 要動嗎 |
|---|---|---|
| 三鐵產生器 | `src/App.jsx` | 不用 |
| Season | `src/Season.jsx` | 不用 |
| 跑跑跑 | `public/run/index.html` | 不用 |

跑跑跑那個檔如果是從 artifact 另存下來的，**開頭要自己補文件骨架**：

```html
<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

artifact 平台會自動幫頁面包這一層，另存出來的檔案沒有 —— 少了 doctype 瀏覽器會進 quirks mode，`box-sizing` 失效、版面會橫向溢出；少了 charset 中文全部變亂碼。

## 要新增第四份 React 課表

三步缺一不可（只丟檔案進去沒用，路由找不到會退回第一個）：

1. 檔案放 `src/`，開頭大寫，例如 `src/Alice.jsx`
2. `main.jsx` 最上面加 `import AlicePlan from "./Alice.jsx";`
3. 同一個檔的 `ROUTES` 陣列加 `{ hash: "#/alice", label: "Alice", el: <AlicePlan /> },`

## 本機

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```
