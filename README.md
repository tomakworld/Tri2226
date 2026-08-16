# 訓練課表平台

三個獨立課表,以網址區分:
- `/` — 三鐵課表產生器(226/113,任何人輸入數據即生成)
- `/#/season` — Season 專屬超長距離課表(游5k/騎205k/跑50k)
- `/#/sub3` — Sub-3 全馬課表(Daniels VDOT)

## 部署到 Zeabur
推上 GitHub → Zeabur New Project → Deploy from GitHub → 自動偵測 Vite → Generate Domain

資料儲存於各使用者瀏覽器 localStorage。
