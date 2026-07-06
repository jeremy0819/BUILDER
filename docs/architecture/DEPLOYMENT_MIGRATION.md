# Deployment Migration Plan（M1 Task 3）

> 目的：合併後只有 BUILDER 保留部署；列出兩個舊庫的部署處置清單。
> 本次 session 已按使用者指示，在兩舊庫加「封存告示＋導向」（見 §3）；真正的
> repo Archive / 部署下架屬 GitHub 後台操作，需 repo 擁有者執行（本 session 無此權限）。

---

## 1. 目標部署拓撲（唯一保留＝BUILDER）

| 服務 | 來源 | 進入點 | 狀態 |
|---|---|---|---|
| GitHub Pages（靜態站） | BUILDER `apps/web/` | `apps/web/index.html`（含 `.nojekyll`） | ⏳ 待使用者在 Settings→Pages 指定 |
| Streamlit Cloud（計算工具） | BUILDER `apps/streamlit/app.py` | 主檔路徑 `apps/streamlit/app.py`，Python 3.11 | ⏳ 待使用者在 Streamlit Cloud 新增 app |

## 2. 舊部署處置清單

| 舊資產 | 處置 | 理由 | 誰執行 |
|---|---|---|---|
| **RE-DCF-Tool 舊 Streamlit Cloud 部署** | **立即下架/覆蓋**（最高優先） | 舊版頁面曾顯示真實案名（乾淨度報告殘留風險 #3）——資料紀律問題，非單純部署 | 使用者（Streamlit Cloud 後台） |
| **Urban-Renewal 舊 GitHub Pages** | 轉址：Pages 指向封存告示或直接停用 | 避免與 BUILDER Pages 內容分叉、外部連結指到舊版 | 使用者（Settings→Pages） |
| **RE-DCF-Tool repo** | 加封存告示（本 session 已做）→ 轉私有 + GitHub Archive | 歷史含真實資料，轉私有封存比洗歷史更有用（可查校準底稿） | 告示＝已完成；轉私有/Archive＝使用者 |
| **Urban-Renewal repo** | 加封存告示（本 session 已做）→ GitHub Archive（可維持 public 唯讀或轉私有） | 保留外部已分享連結的可達性，同時凍結為唯讀 | 告示＝已完成；Archive＝使用者 |

## 3. 本 session 已執行（封存告示＋導向）

- 兩舊庫 README 頂部加入 **ARCHIVED 橫幅**：說明已遷入 Urban Renewal OS（BUILDER），
  本庫凍結為唯讀、不再更新，並指向新庫。
- 分支：兩舊庫的 `claude/urban-renewal-os-arch-freeze-svoum0`（與本次工作同分支）。
- ⚠️ 告示合併進各自 `main` 前，舊庫對外顯示的仍是舊 README——**合併 main＋GitHub Archive
  是使用者操作**。

## 4. 使用者操作清單（GitHub / Streamlit 後台，本 session 無權限）

```
□ 1. Streamlit Cloud：下架 RE-DCF-Tool 舊 app（資料紀律，最急）
□ 2. Streamlit Cloud：新增 BUILDER app，主檔 apps/streamlit/app.py
□ 3. GitHub：BUILDER Settings→Pages→apps/web（或 root 調整）
□ 4. GitHub：Urban-Renewal Pages 停用或轉址
□ 5. 兩舊庫合併封存告示到 main → Settings→Archive this repository（或先轉私有）
□ 6. 補推 tag：git tag -a v0.2.0-premerge ea0fe9b && git push origin v0.2.0-premerge
```

## 5. 回退

- 封存告示只是 README 頂部區塊，誤加可直接 revert commit。
- GitHub Archive 可解除（Unarchive）；轉私有可轉回 public——皆可逆，唯舊 Streamlit 部署
  下架後外部連結即失效（這正是目的）。
