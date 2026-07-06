# 測試員指南 — Urban Renewal OS（alpha）

> 給測試員的一頁上手：測什麼、怎麼開、怎麼回報。測試對象是 BUILDER 的**真實產品**
> （apps/web 靜態站＋apps/streamlit 計算工具），不是任何重製版。

---

## 一、測試員要開的兩個東西

| 產品 | 是什麼 | 怎麼開 |
|---|---|---|
| **互動網站（apps/web）** | 5 個頁面：儀表板 index／賽局沙盤 simulator／坪效投報試算 evaluator／白皮書 whitepaper／說明會簡報 briefing | GitHub Pages（見二）；或本地直接開 `apps/web/index.html` |
| **計算工具（apps/streamlit）** | RE-DCF 精確計算（容積/坪效/共負/投報），可匯出 Project JSON | Streamlit Cloud（見二）；或本地 `streamlit run apps/streamlit/app.py` |

## 二、部署成測試員可點的網址（repo 擁有者一次性設定）

> 產品已 deploy-ready，以下是把它變成公開網址的步驟（GitHub/Streamlit 後台操作）：

```
網站（多頁互動）：
  GitHub → BUILDER repo → Settings → Pages
    → Source: Deploy from a branch
    → Branch: main（或當前發布分支）/ 資料夾選 apps/web（若只能選 root，見註）
  → 存檔後得到 https://<帳號>.github.io/BUILDER/ 網址，發給測試員

計算工具（Streamlit）：
  Streamlit Community Cloud → New app → 選 BUILDER repo
    → Main file path: apps/streamlit/app.py，Python 3.11
  → 得到 https://<app>.streamlit.app 網址
```
註：GitHub Pages 若只能指到 repo 根，需把 apps/web 內容映射到根或用 `/docs` 慣例；
最省事是設 Pages 從 `apps/web` 子目錄（新版 GitHub 支援）。細節見 DEPLOYMENT_MIGRATION.md。

## 三、測試腳本（用合成範例，零真實資料）

計算工具（Streamlit）——每項預期都能對到畫面數字：

| # | 操作 | 預期 |
|---|---|---|
| T1 | 載入「案例C（防災都更）」範本 | L2→L6 帶出數字；容積超出顯示紅色警示 |
| T2 | 看 Tab① 容積帳 | 允建 4,018／計入修正 4,050／餘量 −31.9（與黃金測試一致） |
| T3 | 改基地面積或容積率 | 全鏈即時連動，KPI 卡片數字跟著變 |
| T4 | Tab⑤ 都更全案投報 | 六科目分拆＋售價×營造敏感度熱力圖出現 |
| T5 | Tab⑥ 匯出 Project JSON | 下載到含 result／warnings／core_version 的 JSON |

互動網站——evaluator「🔗 對接 Core」：

| # | 操作 | 預期 |
|---|---|---|
| T6 | evaluator → 匯入 T5 下載的 JSON（或 schemas/examples/ 內範例） | 讀取權威 result、warnings 逐條顯示、owners 逐戶分回表渲染 |
| T7 | index → simulator | 賽局沙盤可玩：地主人格/樞紐戶/談判事件 |
| T8 | 逐頁互鏈（index↔各頁） | 連結不斷、無 404 |

## 四、已知限制（測試員先知道，不用回報這些）

- **教學層數字是示意**：evaluator/simulator 頁內的即時試算是**教學示意**，權威數字以匯入的
  Core JSON（result 欄位）為準。兩者若有差異屬已知（見 ARCHITECTURE D2、ARCH_REVIEW R-1）。
- 字型走系統 fallback（頁面引用的 Google Fonts 在離線/受限環境不載入，不影響功能）。
- 逐戶分回的權變/找補、IRR/NPV 尚未實作（Core 技術債，排 P2），相關欄位可能為空。

## 五、怎麼回報 bug（給測試員的三問，抄自建築師反饋協議）

```
Q1 你在哪一步？（找不到欄位／數字不對／格式看不懂／頁面壞掉）
Q2 你的實際操作？（載入哪個範本？手動輸入還是匯入 JSON？哪一頁哪個 Tab？）
Q3 你期望看到什麼 vs 實際看到什麼？（附兩個數字或截圖）
```
回報進 GitHub Issues（BUILDER repo）。**切勿在 Issue 貼真實案件的地號/姓名/金額**——用代號。

## 六、給後續 session 的註記

若使用者要「一個立即可點的雲端連結」而 Pages 尚未開：可將**真實的** `apps/web/evaluator.html`
單頁內容原樣打包成 Artifact（字型 fallback、跨頁連結會失效，需標明）——**不得重新設計或改動頁面**
（那會 fork 封版產品、給測試員假貨）。多頁完整體驗仍以 GitHub Pages 為準。
