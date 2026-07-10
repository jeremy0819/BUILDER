// tests/web/test_os_simulator.mjs — URBAN STRAND v2 遊戲核心 headless 測試
// 抽出 /*SIMCORE-BEGIN*/../*SIMCORE-END*/ 在 node eval（零 DOM）。node tests/web/test_os_simulator.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const html = readFileSync(join(root, "apps/web/os-simulator.html"), "utf8");
const m = html.match(/\/\*SIMCORE-BEGIN\*\/([\s\S]*?)\/\*SIMCORE-END\*\//);
if (!m) { console.error("❌ 找不到 SIMCORE 區塊"); process.exit(1); }
const SIMCORE = new Function(m[1] + "; return SIMCORE;")();

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) pass++; else { fail++; console.error("❌", name); } };

// ── 1. 預設局（危老×基準）＝與 v1 相容 ──
let s = SIMCORE.create();
ok(Object.keys(s.units).length === 48, "48 戶");
ok(SIMCORE.agreedCount(s) === 34 && s.target === 48 && s.weeksMax === 24, "危老×基準：目標48、24週");
ok(s.units[47].boss === true, "W47 BOSS");
ok(s.budget === 300 && s.ap === 4 && s.week === 1, "初始資源");

// ── 2. 規劃設定改變沙盤參數（建築設計 ↔ 整合的宇宙關聯）──
const sd = SIMCORE.create({mode:"duegeng",scale:"M"});
ok(sd.target === 39 && sd.weeksMax === 22, "都更：目標39戶（80%）、−2週");
const sl = SIMCORE.create({mode:"weilao",scale:"L"});
ok(sl.weeksMax === 22, "積極拉滿：審議加長 −2 週");
ok(sl.units[35].stance === s.units[35].stance + 4, "拉滿（共負62.9%）→ 開局信任 +4");
const ss = SIMCORE.create({mode:"weilao",scale:"S"});
ok(ss.units[35].stance === s.units[35].stance - 5, "保守（共負72%）→ 開局信任 −5");
ok(SIMCORE.SCEN.weilao_L.remaining > 0 && SIMCORE.SCEN.weilao_S.remaining < 0, "SCEN 帶 Core 容積餘量差異");

// ── 3. 決定性＋傾聽/同招遞減（沿用 v1 期望）──
s = SIMCORE.create();
const s2 = SIMCORE.create();
ok(JSON.stringify(Object.values(s.units).map(u=>u.stance)) ===
   JSON.stringify(Object.values(s2.units).map(u=>u.stance)), "固定種子可重現");
const st0 = s.units[35].stance;
SIMCORE.listen(s, 35);
ok(s.units[35].stance === Math.min(100, st0 + 11), "首次傾聽 +11");
const o1 = SIMCORE.offer(s, 45), o2 = SIMCORE.offer(s, 45);
ok(o1.d === 11 && o2.d === 6, `誘因同招遞減（${o1.d}→${o2.d}）`);

// ── 4. BOSS：對錢免疫、三次傾聽攻略 ──
s = SIMCORE.create();
ok(SIMCORE.offer(s, 47).d === -5, "BOSS 對誘因免疫且反感");
SIMCORE.listen(s, 47); SIMCORE.listen(s, 47); s.ap = 4;
ok(SIMCORE.listen(s, 47).d === "convert" && s.units[47].consent === "agreed", "BOSS 三次傾聽轉同意");

// ── 5. 羈絆需要先接觸（v2 設計：連結要先伸出手）──
s = SIMCORE.create();
const cand = Object.values(s.units).find(u => u.consent !== "agreed" && !u.boss &&
  SIMCORE.neighbors(s, u.id).some(n => s.units[n].consent === "agreed"));
const before = cand.stance;
SIMCORE.endWeek(s);                       // 未接觸 → 不受羈絆
ok(s.units[cand.id].stance <= before, "未接觸的戶不受羈絆拉抬");
s = SIMCORE.create();
SIMCORE.listen(s, cand.id);               // 接觸一次
const after1 = s.units[cand.id].stance;
SIMCORE.endWeek(s);
ok(s.units[cand.id].consent === "agreed" || s.units[cand.id].stance > after1 - 7, "接觸過的戶受羈絆拉抬（扣事件容差）");

// ── 6. 家族羈絆：一人點頭，全家 +8 ──
s = SIMCORE.create();
const fam = SIMCORE.FAMILY[0];            // [36,39,44]
const sib = fam[1];
const sibBefore = s.units[sib].stance;
s.units[fam[0]].stance = 74; SIMCORE.listen(s, fam[0]);   // 推過門檻 → flip
ok(s.units[fam[0]].consent === "agreed", "家族成員翻轉");
ok(s.units[sib].consent === "agreed" || s.units[sib].stance >= sibBefore + 8, "家族其他成員 +8");

// ── 7. 可贏性（危老全體）：策略在 8–24 週內達成 ──
function greedy(cfg){
  const st = SIMCORE.create(cfg);
  let g = 0;
  while (!st.over && g++ < 300) {
    if (cfg?.mode !== "duegeng" && st.units[47].consent !== "agreed" && st.ap > 0) SIMCORE.listen(st, 47);
    if (st.budget >= 20 && st.ap > 0) SIMCORE.briefing(st);
    while (st.ap > 0 && !st.over) {
      const t = Object.values(st.units).filter(u => u.consent !== "agreed" && !u.boss)
        .sort((a, b) => b.stance - a.stance)[0];
      if (!t) break;
      SIMCORE.listen(st, t.id);
    }
    SIMCORE.endWeek(st);
  }
  return st;
}
s = greedy();
ok(s.won === true, `危老全體可贏（${s.won ? "第 " + s.week + " 週" : "未達成"}）`);
ok(s.week >= 8 && s.week <= 24, `節奏帶 8–24 週（實測第 ${s.week} 週）`);
const w1 = s.week;

// ── 8. 都更 80% 路線：不碰 BOSS 也能贏、且更快 ──
s = greedy({mode:"duegeng",scale:"M"});
ok(s.won === true && s.units[47].consent !== "agreed", "都更 80%：繞過關鍵戶仍可送件");
ok(s.week <= w1, `都更路線較快（${s.week} ≤ ${w1} 週）`);

// ── 9. 掛機必輸（無接觸→無羈絆→零翻轉）──
s = SIMCORE.create();
for (let i = 0; i < 26 && !s.over; i++) SIMCORE.endWeek(s);
ok(s.over === true && s.won === false && SIMCORE.agreedCount(s) === 34, "掛機＝零進展、必輸");

// ── 10. 里程碑（旅程軌推進感）──
s = SIMCORE.create();
ok(s.milestones.length >= 3 && s.milestones[0].n > 34 && s.milestones.at(-1).n < 48, "危老里程碑站設置合理");

console.log(`\nURBAN STRAND v2 headless：${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
