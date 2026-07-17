# DOMAIN DEPTH LEDGER — 骨架長一寸，肉跟一寸

> 依 `docs/architecture/REDCF_DOMAIN_SPEC.md` PART 4：每道 CI Gate（治理骨架）
> 配一個領域深度問題（都更的肉）。每次大 commit 自問：「Core 今天有沒有比昨天更懂都更？」

| CI Gate（骨架） | 領域深度問題（肉） | 現況（2026-07-17） |
|---|---|---|
| Gate 1 pytest 黃金 | Core 是否比 Excel 更懂 §162？ | ✅ 逐層查核 vs 實案總量法——結構優勢已由真實案比對確認（M4.5 Case-A：容積層零誤差） |
| Gate 3 Excel 迴歸 | 對照範本是否覆蓋真實案的科目？ | 🟡 發現「公共基金＋信託費」子科目缺口（Case-B）→ backlog，未動公式 |
| Gate 5 沙盤 headless | 遊戲機制是否對應真實整合動力學？ | ✅ 三態/選屋券/家族連動＝權變辦法與實務原型；難度＝共負比（Core 因果） |
| Gate 6 Schema 凍結 | 更新前價值係數／decision 進 schema 了嗎？ | ✅ coefficients.json（核准四維）＋decision v0.1 凍結；stakeholder_profile＝M5 |
| Gate 7 Workspace SSOT | 三方 EV 有沒有 UI 自算？ | ✅ decision JSON 唯一來源，input_hash 配對，錯 hash 拒收 |
| （校準紀律） | p_survival 是校準值還是示意？ | 🔴 仍為示意預設——存活案只能校準 duration，需破局案才能校準 p（誠實標示中） |

**規則**：新增 Gate 時必須同時新增一行；答不出「肉」的 Gate 是裝飾品。
