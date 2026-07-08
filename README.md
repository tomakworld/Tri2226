# Ironman 226 訓練面板

18 週 226 全程超鐵訓練課表（游泳/單車自動生成、跑步手動填入、訓練台強度指引）。

## 本地開發
```bash
npm install
npm run dev
```

## 部署到 Zeabur
1. 將本專案推上 GitHub
2. Zeabur → New Project → Deploy from GitHub → 選這個 repo
3. Zeabur 會自動偵測 Vite 並完成建置,綁定網域後即可分享

資料儲存:使用瀏覽器 localStorage,每位訪客的身高/FTP/跑步課表各自獨立保存在自己的裝置上。
