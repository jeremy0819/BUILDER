// tests/web/test_os_simulator.mjs — URBAN STRAND 遊戲核心 headless 測試（M2-C）
// 方法：從 os-simulator.html 抽出 /*SIMCORE-BEGIN*/../*SIMCORE-END*/ 純邏輯區塊，
// 在 node 內 eval（零 DOM），驗證機制與「可贏性」。執行：node tests/web/test_os_simulator.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const html = readFileSync(join(root, "apps/web/os-simulator.html"), "utf8");
const m = html.match(/\/\*SIMCORE-BEGIN\*\/([\s\S]*?)\/\*SIMCORE-END\*\//);
if (!m) { console.error("❌ 找不到 SIMCORE 區塊"); process.exit(1); }
const SIMCORE = new Function(m[1] + "; return SIMCORE;")();

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; } else { fail++; console.error("❌", name); } };

// ── 1. 初始盤面 ──
let s = SIMCORE.create();
ok(Object.keys(s.units).length === 48, "48 戶");
ok(SIMCORE.agreedCount(s) === 34, "開局 34 戶已同意");
ok(s.units[47].boss === true, "W47 是關鍵戶（BOSS）");
ok(s.budget === 300 && s.ap === 4 && s.week === 1, "初始資源 300萬/4AP/第1週");

// ── 2. 決定性：同種子兩次 create 結果一致 ──
const s2 = SIMCORE.create();
ok(JSON.stringify(Object.values(s.units).map(u => u.stance)) ===
   JSON.stringify(Object.values(s2.units).map(u => u.stance)), "固定種子＝可重現");

// ── 3. 傾聽與同招遞減 ──
s = SIMCORE.create();
const pid = 35; // pending
const st0 = s.units[pid].stance;
SIMCORE.listen(s, pid);
ok(s.units[pid].stance === Math.min(100, st0 + 11), "首次傾聽 +11");
const o1 = SIMCORE.offer(s, 45);           // opposed 非 boss：+11
const o2 = SIMCORE.offer(s, 45);           // 同招遞減：+6（round(11*0.5)）
ok(o1.d === 11 && o2.d === 6, `誘因同招遞減（${o1.d}→${o2.d}）`);
ok(s.budget === 300 - 100, "誘因扣預算 50萬×2");

// ── 4. BOSS：對錢免疫、三次傾聽攻略 ──
s = SIMCORE.create();
const rb = SIMCORE.offer(s, 47);
ok(rb.d === -5, "BOSS 對誘因免疫且反感（-5）");
SIMCORE.listen(s, 47); SIMCORE.listen(s, 47);
s.ap = 4; // 補 AP（測試直接補）
const rc = SIMCORE.listen(s, 47);
ok(rc.d === "convert" && s.units[47].consent === "agreed", "BOSS 三次傾聽後轉為同意");

// ── 5. 羈絆效應：已同意鄰居在週末拉抬 ──
s = SIMCORE.create();
const target = Object.values(s.units).find(u => u.consent !== "agreed" &&
  SIMCORE.neighbors(s, u.id).some(n => s.units[n].consent === "agreed"));
const before = target.stance;
SIMCORE.endWeek(s);
ok(s.units[target.id].consent === "agreed" || s.units[target.id].stance > before,
   "羈絆效應生效（同意鄰居拉抬信任）");

// ── 6. 可贏性：照「傾聽優先＋每週說明會＋BOSS 先攻」策略，24 週內全員同意 ──
s = SIMCORE.create();
let guard = 0;
while (!s.over && guard++ < 200) {
  if (s.units[47].consent !== "agreed" && s.ap > 0) SIMCORE.listen(s, 47);
  if (s.budget >= 30 && s.ap > 0) SIMCORE.briefing(s);
  while (s.ap > 0 && !s.over) {
    const t = Object.values(s.units).filter(u => u.consent !== "agreed" && !u.boss)
      .sort((a, b) => b.stance - a.stance)[0];      // 先收最接近的（衝刺策略）
    if (!t) break;
    SIMCORE.listen(s, t.id);
  }
  SIMCORE.endWeek(s);
}
ok(s.won === true, `策略可贏（${s.won ? "第 " + s.week + " 週達成" : "24 週未達成"}）`);
ok(s.week >= 8 && s.week <= 24, `節奏帶 8–24 週（實測第 ${s.week} 週）`);
const weeksToWin = s.week;

// ── 7. 擺爛必輸：什麼都不做 24 週 → lose ──
s = SIMCORE.create();
for (let i = 0; i < 25 && !s.over; i++) SIMCORE.endWeek(s);
// 註：純羈絆擴散可能收掉部分 pending，但 BOSS 無傾聽永不轉——必輸
ok(s.over === true && s.won === false, "掛機 24 週＝失敗（BOSS 需要傾聽）");

console.log(`\nURBAN STRAND headless：${pass} passed, ${fail} failed（可贏性：第 ${weeksToWin} 週）`);
process.exit(fail ? 1 : 0);
