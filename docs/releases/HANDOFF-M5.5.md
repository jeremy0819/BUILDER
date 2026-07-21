# 交接與體檢報告 — M5.5 完成時點（M6 前）

> 基準 commit：`e587c57`（main；已同步 claude/…svoum0 分支）
> 狀態：M1–M5.5 完成、九道 Gate 全綠、pytest 95。下一里程碑＝M6 THE STRATEGIST。

## A. 專案體檢（肥大？）→ 健康，無需清理

| 指標 | 值 | 判定 |
|---|---|---|
| 版控內容（不含 .git） | ~3 MB | 正常 |
| `.git` | 5.3 MB | 正常 |
| 最大追蹤檔 `apps/web/core-bundle.js` | 135 KB | Pyodide 必需＋Gate 9 守衛；內容＝內嵌 core 源碼（非空白），minify 無效益 → 不動 |
| 誤追蹤產物（egg-info/pycache/node_modules） | 0 | 乾淨 |
| `local_calibration/`（8.8 MB 真實 Excel） | gitignored | 未進版控 ✅ |
| 死碼／舊面板殘留 id | 0 | 已檢查 |

**結論：無肥大、無潛藏 bug、無死連結（76 條全可達）。**

## B. M6 前的缺漏（誠實盤點）

### (i) Schema 先行才能做（非 bug，是紀律）
- **Site Facts 未帶建蔽率/法規限制**：`input.site` 目前只有 5 欄（面積/plaza/far/獎勵率/容移），
  無建蔽率、coverage、法規限制 → 需先動 schema 才能誠實呈現。P1 DoD 此項半完成，記 backlog。

### (ii) 已規劃、尚未做的功能（DUAL_TRACK 指令書 PART B）
- **沙盤回合階段化 HUD**：情勢→行動→結算→檢視 四階段＋永遠可見 HUD（尚未重構）。
- **三個實務要素玩法**：產權複雜度（`ownership_complexity` schema 欄已備，玩法未接）、
  安置補貼滑桿、選配衝突。屬「碰實務」加值項。
- **沙盤本身尚未接 Pyodide**：目前「改產品→即時反應」在儀表板駕駛艙已成；但沙盤（STEP 3）
  仍吃 SCEN baked＋willingnessBase（D7）。完整「改產品→沙盤人心動」需沙盤也消費
  household_outcome（可列 M5.6 或併入 M6 前置）。

### (iii) 需部署／擁有者操作才能驗或做（見 C 節）
- B4 即時運算實測（需 Pages＋CDN）、os-v0.3.0 release、15 分鐘人測、stage_tree 存活率校準。

## C. 需要「你（repo 擁有者）」執行的事 — 依優先序

1. **部署驗證即時運算（最高優先）**——我在沙盒連不到 Pyodide CDN，這段只能你驗。
2. **發 os-v0.3.0 Release**——CI 環境 403 發不了 tag。
3. **15 分鐘人測**（M4.5 DoD）——只有真人能驗。
4. **破局案校準存活率**（把 verdict 從方向感升到可信）——需要一份「失敗/破局」的案。
5. （可選）舊分支清理、MCP 連接器授權。

## D. 換 session 建議

**M6 建議開新 session。** 理由：本 session 已跨 M1→M5.5，脈絡巨大；M6 是乾淨新里程碑，
不需背舊細節。所有狀態都在 git＋`CLAUDE.md`＋`docs/architecture/*_SPEC.md`。
新 session 開場請貼 M6 spec，並指向：`CLAUDE.md` →
`docs/architecture/DUAL_TRACK_DIRECTIVE.md`、`DECISION_ENGINE_SPEC.md`、本檔。
例外：若只是部署後修小 bug，沿用本 session 更快。
