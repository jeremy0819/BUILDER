# 維護協議（Maintenance Protocol）

> 規範：哪些檔可自行改、哪些動前先問、教訓寫哪裡、什麼時候精簡。
> 讀者：所有後續 session（含弱模型）。

---

## 1. 檔案權限矩陣

### 🟢 可自行修改（改完照 R5 底線自驗即可）
- 各 repo `CHANGELOG.md`、`LESSONS.md`、`README.md` 的說明段
- `docs/` 下的筆記與報告類文件（governance/ 除外）
- 新增測試案例（不改既有期望值）

### 🟡 可修改，但必須先跑測試、後過 read-back
- `core/`（RE-DCF 計算核心）——pytest 硬門檻＋改 L6 要重跑 `make_template.py`
- `app.py`、HTML 靜態頁——必須實開畫面驗（R2-3）；`simulator.html` V4 封版，只准修 bug 不准重寫
- 各 repo `CLAUDE.md`——**改前先備份到 `docs/backups/CLAUDE-<日期>.md`**；改後仍須 ≤150 行

### 🔴 動前先問使用者（附建議選項再問）
- `ARCHITECTURE.md`（架構凍結文件——變更本檔＝架構變更）
- `schemas/project_schema.json`（v1.1 凍結，位元組不可變）
- `test_golden.py` 的**期望值**（改期望值＝改對錯的定義）
- 費率常數（`core/templates.py`／財務率預設——真實案校準成果）
- `governance/` 全部檔案（制度變更是使用者的決定）
- LICENSE、`.gitignore`、刪除任何檔案、部署設定（Streamlit Cloud／GitHub Pages）

---

## 2. 踩雷教訓怎麼寫回（LESSONS.md）

位置：各 repo 根目錄 `LESSONS.md`（沒有就建）。跨 repo 的教訓寫 BUILDER 的。

格式（一條 5 行內，寫給下一個弱模型 session 看）：

```
## 2026-07-05 陽台超出算法
症狀：案例C 陽台超出算出 ~300，黃金測試期望 29.40。
根因：用了 FA 總量 ×10%，正確是逐層樓板 ×10%（§162 逐層）。
規則：任何「免計」計算先確認基準是逐層還是總量，見 CLAUDE.md 六大踩坑點。
```

寫入時機：任何一次「重試 ≥2 輪才解掉」或「使用者糾正」的問題，解掉當下就寫，不要等收尾。

---

## 3. 精簡節奏（防制度腐化）

| 檔案 | 上限 | 超過時 |
|---|---|---|
| 各 repo `CLAUDE.md` | 150 行 | 長內容抽到 docs/ 引用檔，CLAUDE.md 只留索引 |
| `LESSONS.md` | 100 行 | 把已規則化的教訓合併進對應規範檔（CLAUDE.md 踩坑點／rubric），原條目刪除 |
| CLAUDE.md 直接引用的常載檔合計 | 500 行 | 降級為「按需引用」（寫路徑不寫「必讀」） |
| `governance/` 單檔 | 200 行 | 精簡：刪重複、刪已過時的查證值（重查後更新） |

精簡也是 🔴 類動作嗎？——刪減 governance 內容要先問；**更新過時事實**（如模型 ID 重查後更新）可自行做，但要在 commit 訊息註明新舊值。

---

## 4. 文件權威順序（多份文件打架時誰說了算）

由高到低；高位文件沒講的才看低位；發現矛盾 → 修低位文件並記 LESSONS：

1. 使用者當下的明確指示
2. `BUILDER/ARCHITECTURE.md`（架構凍結文件）＋ `governance/`
3. 各 repo `CLAUDE.md`
4. 各 repo `ROADMAP.md`／路線圖
5. 其餘 docs（歷史文件，可能過時）

已知的既存矛盾（凍結時已裁決，詳見 ARCH_REVIEW.md）：
- RE-DCF ROADMAP「永遠獨立 Repository」vs 合併計畫 monorepo → **以 ARCHITECTURE.md 裁決為準**。
- RE-DCF CLAUDE.md 舊分支名 `claude/claude-md-docs-ls9Bu` → 已過時，分支以當前 session 指定為準。

---

## 5. 版控紀律（所有 session 通用）

- commit 前：R5 品質底線全綠（`pytest`／grep 真實段名／schema hash）。
- 只 `git add <改過的檔>`，不用 `git add -A`（防止真實資料誤入）。
- commit 訊息：`feat:`／`fix:`／`docs:`／`refactor:` 開頭，一句話講清楚改了什麼。
- 禁止 force push；禁止對未授權分支 push。
