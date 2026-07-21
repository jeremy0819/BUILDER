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

// ── 9b. 說明會刷分必輸（傾聽經濟學 D1：說明會只暖不closing，最後一哩得逐戶聽）──
ok(SIMCORE.BRIEF_CEIL < SIMCORE.AGREE_AT, "說明會上限 < 同意門檻（單靠說明會無法翻轉）");
s = SIMCORE.create({mode:"duegeng",scale:"L"});   // 最寬鬆配置也擋得住
for (let i = 0; i < 30 && !s.over; i++) { if (s.budget >= 20) SIMCORE.briefing(s); SIMCORE.endWeek(s); }
ok(s.won === false && SIMCORE.agreedCount(s) === 34, "只刷說明會＋結束週＝零翻轉、必輸");

// ── 10. 里程碑（旅程軌推進感）──
s = SIMCORE.create();
ok(s.milestones.length >= 3 && s.milestones[0].n > 34 && s.milestones.at(-1).n < 48, "危老里程碑站設置合理");

// ── 11. B1 更新前價值矩陣（讀 coefficients.json；決定性＋權值守恆＋戶數界限）──
const coeff = JSON.parse(readFileSync(join(root, "apps/web/coefficients.json"), "utf8"));
ok(!!coeff._note && /非估價值/.test(coeff._note), "coefficients.json 保有核准標示（非估價值）");
const M = SIMCORE.buildOwnerMatrix(24, 7, 60, coeff);
ok(M.length === 24, "矩陣戶數＝24");
ok(Math.abs(M.reduce((a, x) => a + x.weight, 0) - 1) < 1e-3, "權值總和≈1（§56 權值比例）");
ok(M.every(x => x.pre_value > 0 && x.weight > 0), "每戶 pre_value/weight > 0");
ok(JSON.stringify(M) === JSON.stringify(SIMCORE.buildOwnerMatrix(24, 7, 60, coeff)), "同 (n,seed) 決定性一致");
ok(JSON.stringify(M) !== JSON.stringify(SIMCORE.buildOwnerMatrix(24, 8, 60, coeff)), "不同 seed→不同矩陣");
for (const n of [12, 48, 80]) ok(SIMCORE.buildOwnerMatrix(n, 1, 60, coeff).length === n, `n=${n} 可生成`);
let threw = false; try { SIMCORE.buildOwnerMatrix(11, 1, 60, coeff); } catch (e) { threw = true; }
ok(threw, "戶數 <12 拋錯");

// ── 12. B1 參數化 create：N∈{24,48} 測試矩陣 ──
// 12a. 經典局重現（預設參數＝v2 完全一致，上方 1–10 全數即為證）
s = SIMCORE.create();
ok(s.N === 48 && s.agreed0 === 34 && s.units[47].boss === true, "預設＝經典局（48/34/BOSS47）");
ok(JSON.stringify(s.families) === JSON.stringify(SIMCORE.FAMILY), "經典局家族＝固定 FAMILY");
// 12b. 決定性：同參數→同盤面；異 seed→異盤面
const mk = c => { const st = SIMCORE.create(c);
  return JSON.stringify(Object.values(st.units).map(u => [u.consent, u.stance, u.family])) + "|" + st.pos.join(","); };
ok(mk({N:24, seed:5}) === mk({N:24, seed:5}), "N=24 同 seed 決定性");
ok(mk({N:24, seed:5}) !== mk({N:24, seed:6}), "N=24 異 seed 異盤面");
// 12c. 戶籍守恆＋滑桿比例
for (const [n, cons] of [[24, 71], [48, 50], [12, 71], [80, 60]]) {
  const st = SIMCORE.create({N:n, consent:cons, seed:9});
  const a = Object.values(st.units).filter(u => u.consent === "agreed").length;
  const o = Object.values(st.units).filter(u => u.consent === "opposed").length;
  ok(Object.keys(st.units).length === n && a === st.agreed0 && a + o < n,
     `N=${n} consent=${cons}%：戶數守恆＋三籍分佈`);
  ok(st.target === (n === 48 && cons === 50 ? 48 : n) || st.cfg.mode !== "weilao", `N=${n} 危老 target=N`);
}
let threwN = false; try { SIMCORE.create({N:11}); } catch (e) { threwN = true; }
ok(threwN, "N=11 拋錯（12–80 界限）");
// 12d. 程序家族：全員非同意非BOSS、規模 2–3、索引一致
s = SIMCORE.create({N:24, seed:5, fam:60});
ok(s.families.length > 0, "N=24 fam=60% 有家族生成");
ok(s.families.every(f => f.length >= 2 && f.length <= 3 &&
   f.every(id => s.units[id].consent !== "agreed" && !s.units[id].boss)), "家族成員皆非同意非BOSS·規模2–3");
ok(s.families.every((f, fi) => f.every(id => s.units[id].family === fi)), "family 索引雙向一致");
// 12e. N=24 可贏帶（貪婪流程）＋掛機必輸
s = SIMCORE.create({N:24, seed:5, mode:"weilao"});
for (let w = 0; w < 40 && !s.over; w++) {
  while (s.ap > 0 && !s.over) {
    const t = Object.values(s.units).filter(u => u.consent !== "agreed")
      .sort((a, b) => (b.boss ? 200 : b.stance) - (a.boss ? 200 : a.stance))[0];
    if (!t) break; SIMCORE.listen(s, t.id);
  }
  if (!s.over) SIMCORE.endWeek(s);
}
ok(s.won === true, "N=24 貪婪傾聽可贏（可贏帶）");
s = SIMCORE.create({N:24, seed:5});
for (let i = 0; i < 30 && !s.over; i++) SIMCORE.endWeek(s);
ok(s.won === false && SIMCORE.agreedCount(s) === s.agreed0, "N=24 掛機＝零進展、必輸");

// ── 13. B1 權值矩陣掛載（傳 coeff → 每戶有 pre_value/weight）──
s = SIMCORE.create({N:24, seed:5, coeff});
const us = Object.values(s.units);
ok(us.every(u => u.pre_value > 0 && u.weight > 0), "每戶掛 pre_value/weight");
ok(Math.abs(us.reduce((a, u) => a + u.weight, 0) - 1) < 1e-3, "戶權值總和≈1");

// ── 14. B3 三態＋順位券 ──
s = SIMCORE.create({N:24, seed:5});
ok(s.tickets === SIMCORE.TICKETS0, "開局順位券＝TICKETS0");
const pend = Object.values(s.units).find(u => u.consent === "pending" && !u.boss);
const stanceB4 = pend.stance;
ok(SIMCORE.ticket(s, pend.id).ok === true && pend.stance === Math.min(100, stanceB4 + 12), "順位券 +12 信任");
ok(s.tickets === SIMCORE.TICKETS0 - 1 && pend.ticketed === true, "券數遞減＋標記");
ok(SIMCORE.ticket(s, pend.id).ok === false, "同戶第二張無效");
const bossU = Object.values(s.units).find(u => u.boss);
if (bossU) ok(SIMCORE.ticket(s, bossU.id).ok === false, "祖厝對順位券免疫");
// 拿券戶翻轉→三態＝選屋
while (pend.consent !== "agreed" && s.ap > 0) SIMCORE.listen(s, pend.id);
if (pend.consent !== "agreed") { s.ap = 4; while (pend.consent !== "agreed") SIMCORE.listen(s, pend.id); }
ok(pend.tri === "選屋", "拿券翻轉＝選屋");
// 三態守恆
const stl = SIMCORE.settle(s);
ok(stl.total === s.N && stl.選屋.length + stl.抽籤.length + stl.現金.length === s.N, "三態守恆 Σ=N");
ok(stl.選屋.includes(pend.id), "選屋名單含拿券戶");
ok(JSON.stringify(SIMCORE.settle(s).抽序) === JSON.stringify(stl.抽序), "抽序決定性（同 seed）");

// ── 15. B4 匯入 owners 開局（事實 verbatim）──
const owners = v21ex();
function v21ex(){
  const doc = JSON.parse(readFileSync(join(root, "schemas/examples/v2/v2_1_案例D_權變示範.json"), "utf8"));
  const alloc = Object.fromEntries((doc.result.owner_allocations||[]).map(a => [a.owner_id, a]));
  return doc.input.owners.map(o => ({owner_id:o.owner_id, consent:o.consent,
    pre_value:(alloc[o.owner_id]||{}).pre_value, value_share:(alloc[o.owner_id]||{}).value_share,
    alloc:alloc[o.owner_id]||null}));
}
s = SIMCORE.create({mode:"weilao", scale:"M", owners});
ok(s.N === owners.length, "B4：N＝owners 數");
ok(SIMCORE.agreedCount(s) === owners.filter(o => o.consent === "agreed").length, "B4：開局同意數＝owners 事實");
ok(Object.values(s.units).every(u => u.oid && (u.weight == null || u.weight > 0)), "B4：每戶掛 owner_id＋verbatim value_share");
const bossImp = Object.values(s.units).find(u => u.boss);
ok(!bossImp || Object.values(s.units).filter(u => u.consent === "opposed")
   .every(u => (u.pre_value||0) <= (bossImp.pre_value||0)), "B4：關鍵戶＝最高更新前價值反對戶");

// ── 16. M5.5 傳動軸：C2 七條方向斷言（領域真理；幅度可調、方向不可違反）──
const wcfg = JSON.parse(readFileSync(join(root, "apps/web/willingness_config.json"), "utf8"));
const WD = (h) => SIMCORE.willingnessDelta(h, wcfg);
const H = (chg, alloc=true, park=true) => ({delta:{interior_ping_change_pct:chg, can_be_allocated:alloc},
                                            after:{parking_satisfied:park}});
ok(WD(H(-0.2)) < WD(H(-0.1)) && WD(H(-0.1)) < 0, "D1：室內實坪↓→意願↓（越縮越痛）");
// D2：公設比↑→全體實坪↓→全體意願↓（以兩組 outcome 模擬 33% vs 38%）
const 全體33 = [H(-0.05), H(-0.02), H(0.01)], 全體38 = [H(-0.12), H(-0.09), H(-0.06)];
ok(全體38.reduce((a,h)=>a+WD(h),0) < 全體33.reduce((a,h)=>a+WD(h),0), "D2：公設比↑→全體意願↓");
ok(WD(H(0, false)) <= wcfg.no_unit_penalty, "D3：配不到單元→重挫");
ok(WD(H(0, true, false)) < WD(H(0, true, true)), "D4：車位未達→意願↓");
ok(WD(H(0.08)) > 0, "D5：餅變大（實坪↑）→意願↑");
ok(WD(H(-0.08)) < WD(H(0.08)), "D6：共負↑→分回↓（實坪↓）→意願↓");
ok(SIMCORE.willingnessBase(2000, 1000, wcfg) < 0 && SIMCORE.willingnessBase(1000, 1000, wcfg) === 0,
   "D7：蛋黃區（V0 高於中位）基準線低於蛋白區");
// 幅度歸 config：同方向、不同 config 幅度可變
ok(SIMCORE.willingnessDelta(H(-0.1), {...wcfg, interior_loss_scale:120}) < WD(H(-0.1)), "幅度由 config 調（方向不變）");

// ── 17. A1.4 意願來源標示：沙盤＝simulated（Workspace＝recorded 在 Gate 7 驗）──
ok(SIMCORE.create().willingness_source === "simulated", "沙盤 willingness_source=simulated");

// 17b. WILLING_DEFAULT 與 willingness_config.json 幅度一致（防嵌入值漂移）
for (const k of ["interior_loss_scale", "no_unit_penalty", "parking_penalty", "subsidy_gain", "v0_anchor_scale"])
  ok(SIMCORE.WILLING_DEFAULT[k] === wcfg[k], `WILLING_DEFAULT.${k} 與 config 一致（${k}）`);

// 17c. 傳動軸→遊戲 D7：匯入案件中，更新前價值高的未同意戶開局信任較低（蛋黃區 holdout）
const owners17 = Array.from({length: 24}, (_, i) => ({
  owner_id: "W" + String(i + 1).padStart(2, "0"),
  consent: i < 10 ? "agreed" : "pending",
  pre_value: 800 + i * 120, value_share: 1 / 24
}));
s = SIMCORE.create({ N: 24, owners: owners17, seed: 5 });
const 低值戶 = Object.values(s.units).find(u => u.consent === "pending" && !u.boss && Math.round(u.pre_value) <= 1200);
const 高值戶 = Object.values(s.units).filter(u => u.consent === "pending" && !u.boss).sort((a, b) => b.pre_value - a.pre_value)[0];
ok(高值戶.v0base < 0 && 高值戶.v0base <= (低值戶 ? 低值戶.v0base : 0), "D7 在遊戲：高更新前價值戶開局信任被壓低（蛋黃區）");
ok(高值戶.stance <= 70 && 高值戶.stance >= 5, "v0base 調整後開局信任仍在合理帶");

// ── 18. C4 數字溯源（聚焦版）：意願函數只消費 household_outcome，不推導坪數/財務 ──
const wdSrc = SIMCORE.willingnessDelta.toString() + SIMCORE.willingnessBase.toString();
ok(!/每坪均價|公設比|均價|registered_ping\s*[*\/]|return_value|total_sales|scr\b/.test(wdSrc),
   "C4：意願函數零坪數/財務推導（只讀 outcome 欄位）");

console.log(`\nURBAN STRAND v2 headless：${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
