# STANDARD WORKFLOW — Site → Product → People → Decision

> **層級**：最高層級產品文件（Ubiquitous Language 的唯一定義處）
> **狀態**：v0.9 草案——⚠️ 本文件是產品心智模型，**應由 repo 擁有者親筆定稿**；
> 本草案由 M5 憲法（`docs/architecture/M5_WORKFLOW_SPEC.md` §1–§3）忠實展開，待擁有者修訂後升 v1.0。
> 之後每一個新功能、每一份文件、每一次對外介紹，都從這條語言長出來。

## 一句話

**BUILDER 是 Urban Renewal Decision OS：把一個都更案，走成一條可稽核的決策流程——
Site → Product → People → Decision。**

## 通用語言（對外 ↔ 對內映射，不改檔名）

| STEP | 產品語言 | 問句 | 頁面 | 答案來源 |
|---|---|---|---|---|
| 1 | **Site Analysis 基地診斷** | 這塊地值不值得開發？ | dashboard.html | Core（Site facts）；「值不值得」verdict＝Decision Engine |
| 2 | **Product Planning 產品規劃** | 最佳產品配置？ | evaluator.html | RE-DCF Core（唯一正式計算入口） |
| 3 | **Negotiation Strategy 整合推演** | 整合機率多少？先談誰？ | simulator/workspace | Decision Engine（EV/verdict）；逐型對策＝M6 |
| ✓ | **Decision Report 決策報告** | 下一步該做什麼？ | report.html | 組合三引擎輸出（不計算） |

## 兩層 IA

```
Workspace（多案）＝案件組合：挑案/匯入/開案
   └─▶ Case Workspace（單案）＝該案容器：STEP 1 → 2 → 3 → ✓ Decision Report
```

## 三條語言紀律

1. **問句屬於卡片，答案屬於引擎**——UI 提出問題並呈現引擎答案（input_hash 溯源），永不自己算。
2. **對外講決策，對內講模組**——行銷/文件/首頁用產品語言；工程檔名不動（映射層）。
3. **Decision Report 是 payoff**——組合 Core＋Decision Engine（＋M6 Strategy）輸出成
   「開發商下一步」，不是遊戲結束畫面。

## 版本沿革

- v0.9（2026-07）：M5 P0 初稿（依 M5_WORKFLOW_SPEC 展開；待擁有者親筆定稿）。
