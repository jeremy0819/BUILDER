// tests/web/test_scenario.mjs — M7.3 Scenario headless 測試
// 驗證 case-store.js 的 Scenario 管理紀律（M7_CASE_OS_SPEC §7）：
//   規則1：Scenario 只改 Input 不改 Output（engine 不得含推論欄位）
//   規則2：恰好一個 authoritative（作準），其餘為 exploratory
//   規則3：攜帶完整 input set（engine 不得為空物件）
//   對抗 Case D：切換作準方案 → decision 只反映作準；非作準不產生 verdict
// 執行：node tests/web/test_scenario.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; } else { fail++; console.error("❌", n); } };
const rejects = async (p, n) => {
  try { await p; fail++; console.error("❌", n, "(應該被拒但成功了)"); }
  catch { pass++; }
};

// ── 極簡 IndexedDB 假實作 ──
function makeFakeIDB() {
  const stores = { cases: new Map(), activity: new Map(), meta: new Map() };
  let auto = 0;
  const idx = {
    activity: { by_case: (v) => [...stores.activity.values()].filter(r => r.case_id === v) }
  };
  function objectStore(name) {
    const m = stores[name];
    return {
      get: (k) => ({ result: m.get(k) }),
      getAll: () => ({ result: [...m.values()] }),
      put: (v) => { m.set(name === "meta" ? v.k : v.pid, v); return { result: v }; },
      add: (v) => { const key = ++auto; m.set(key, { ...v, key }); return { result: key }; },
      delete: (k) => { m.delete(k); return { result: true }; },
      index: (iname) => ({ getAll: (v) => ({ result: idx[name][iname](v) }) }),
      createIndex: () => { }
    };
  }
  return {
    open() {
      const req = {};
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => ({ createIndex: () => { } }),
          transaction(name) {
            const t = { objectStore: (n) => objectStore(n) };
            setTimeout(() => t.oncomplete && t.oncomplete(), 0);
            return t;
          }
        };
        req.onsuccess && req.onsuccess();
      }, 0);
      return req;
    },
    _stores: stores
  };
}

// ── 載入 case-store.js ──
const fakeIDB = makeFakeIDB();
global.self = {
  indexedDB: fakeIDB,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
};
global.localStorage = global.self.localStorage;
const src = readFileSync(join(root, "apps/web/case-store.js"), "utf8");
new Function("self", "localStorage", "navigator", "module", src)(
  global.self, global.localStorage, { storage: null }, { exports: {} });
const CS = global.self.CaseStore;

const CASE_ID = "prj-test";
const makeEngine = (override) => ({
  "基地面積": 1500, "容積率": 300, "獎勵率": 0.2,
  "住宅單價": 92, "車位售價": 250, ...override
});
const fakeHash = (n) => "sha256:" + String(n).padStart(64, "0");

const run = async () => {
  // 前置：建案件
  await CS.putCase({ pid: CASE_ID, snap: { code_name: "測試案" } });

  // ── 規則 3：engine 不得為空 ──
  await rejects(
    CS.addScenario(CASE_ID, { scenario_id: "sc-empty", name: "空", engine: {}, input_hash: fakeHash(0) }),
    "空 engine 應被拒（規則3：完整 input set）"
  );

  // ── 規則 1：engine 不得含推論欄位 ──
  await rejects(
    CS.addScenario(CASE_ID, {
      scenario_id: "sc-bad", name: "含推論", input_hash: fakeHash(0),
      engine: { "基地面積": 1500, verdict: "GO" }
    }),
    "engine 含 verdict 應被拒（規則1：只改 Input 不改 Output）"
  );
  await rejects(
    CS.addScenario(CASE_ID, {
      scenario_id: "sc-bad2", name: "含IRR", input_hash: fakeHash(0),
      engine: { "基地面積": 1500, irr: 0.12 }
    }),
    "engine 含 irr 應被拒"
  );
  await rejects(
    CS.addScenario(CASE_ID, {
      scenario_id: "sc-bad3", name: "含EV", input_hash: fakeHash(0),
      engine: { "基地面積": 1500, ev: { "地主": 100 } }
    }),
    "engine 含 ev 應被拒"
  );

  // ── 必填欄位驗證 ──
  await rejects(
    CS.addScenario(CASE_ID, { name: "缺ID", engine: makeEngine(), input_hash: fakeHash(0) }),
    "缺 scenario_id 應被拒"
  );
  await rejects(
    CS.addScenario(CASE_ID, { scenario_id: "sc-x", engine: makeEngine(), input_hash: fakeHash(0) }),
    "缺 name 應被拒"
  );

  // ── 規則 2：第一個方案自動成為 authoritative ──
  const sc1 = await CS.addScenario(CASE_ID, {
    scenario_id: "sc-001", name: "基準", engine: makeEngine(), input_hash: fakeHash(1)
  });
  ok(sc1.authoritative === true, "第一個方案自動 authoritative");

  // 新增第二個（未宣告 authoritative → 預設 exploratory）
  const sc2 = await CS.addScenario(CASE_ID, {
    scenario_id: "sc-002", name: "積極拉滿",
    engine: makeEngine({ "獎勵率": 0.52 }), input_hash: fakeHash(2)
  });
  ok(sc2.authoritative === false, "第二個方案預設 exploratory");

  // 新增第三個
  await CS.addScenario(CASE_ID, {
    scenario_id: "sc-003", name: "保守",
    engine: makeEngine({ "獎勵率": 0.1 }), input_hash: fakeHash(3)
  });

  // 驗證恰好一個 authoritative
  let list = await CS.listScenarios(CASE_ID);
  ok(list.length === 3, "共 3 個方案");
  let authCount = list.filter(s => s.authoritative).length;
  ok(authCount === 1, "恰好一個 authoritative（規則2）");
  ok(list[0].authoritative === true, "sc-001 是作準");

  // ── 切換 authoritative ──
  await CS.setAuthoritative(CASE_ID, "sc-002");
  list = await CS.listScenarios(CASE_ID);
  authCount = list.filter(s => s.authoritative).length;
  ok(authCount === 1, "切換後仍恰好一個 authoritative");
  ok(list.find(s => s.scenario_id === "sc-002").authoritative === true, "sc-002 現在是作準");
  ok(list.find(s => s.scenario_id === "sc-001").authoritative === false, "sc-001 已取消作準");

  // getAuthoritative 回傳正確
  const auth = await CS.getAuthoritative(CASE_ID);
  ok(auth && auth.scenario_id === "sc-002", "getAuthoritative 回傳作準方案");

  // 切換不存在的方案 → 被拒
  await rejects(CS.setAuthoritative(CASE_ID, "sc-999"), "不存在的方案應被拒");

  // ── 對抗 Case D：Scenario 不污染 SSOT ──
  // 驗證方案攜帶完整 input set
  const authSc = await CS.getAuthoritative(CASE_ID);
  ok(authSc.engine && typeof authSc.engine === "object", "作準方案攜帶 engine");
  ok(authSc.input_hash && authSc.input_hash.startsWith("sha256:"), "作準方案有 input_hash");
  ok(Object.keys(authSc.engine).length >= 4, "engine 包含完整輸入欄位");

  // 各方案 engine 獨立（修改一個不影響另一個）
  const sc1Engine = list.find(s => s.scenario_id === "sc-001").engine;
  const sc2Engine = list.find(s => s.scenario_id === "sc-002").engine;
  ok(sc1Engine["獎勵率"] === 0.2, "sc-001 保留原始獎勵率 0.2");
  ok(sc2Engine["獎勵率"] === 0.52, "sc-002 使用積極獎勵率 0.52");

  // ── 新增宣告 authoritative 的方案 → 自動取消其他的 ──
  await CS.addScenario(CASE_ID, {
    scenario_id: "sc-004", name: "新作準",
    engine: makeEngine({ "住宅單價": 100 }), input_hash: fakeHash(4),
    authoritative: true
  });
  list = await CS.listScenarios(CASE_ID);
  ok(list.length === 4, "共 4 個方案");
  authCount = list.filter(s => s.authoritative).length;
  ok(authCount === 1, "新增宣告 authoritative 後仍恰好一個");
  ok(list.find(s => s.scenario_id === "sc-004").authoritative === true, "sc-004 現在是作準");
  ok(list.find(s => s.scenario_id === "sc-002").authoritative === false, "sc-002 已自動取消");

  // ── 刪除方案 ──
  // 刪除非作準方案
  const afterDel = await CS.deleteScenario(CASE_ID, "sc-003");
  ok(afterDel.length === 3, "刪除後剩 3 個");
  ok(!afterDel.find(s => s.scenario_id === "sc-003"), "sc-003 已不存在");

  // 刪除作準方案 → authoritative 轉移
  await CS.deleteScenario(CASE_ID, "sc-004");
  list = await CS.listScenarios(CASE_ID);
  ok(list.length === 2, "刪除作準方案後剩 2 個");
  authCount = list.filter(s => s.authoritative).length;
  ok(authCount === 1, "刪除作準方案後 authoritative 自動轉移");

  // 不得刪除最後一個方案
  await CS.deleteScenario(CASE_ID, list.find(s => !s.authoritative).scenario_id);
  list = await CS.listScenarios(CASE_ID);
  ok(list.length === 1, "剩最後一個");
  await rejects(
    CS.deleteScenario(CASE_ID, list[0].scenario_id),
    "至少保留一個方案"
  );

  // ── Activity 追蹤：scenario 操作應留下紀錄 ──
  const acts = await CS.listActivity(CASE_ID);
  const scenarioActs = acts.filter(a => a.kind === "scenario");
  ok(scenarioActs.length >= 4, "Scenario 操作有 Activity 紀錄（新增/切換/刪除）");
  ok(scenarioActs.every(a => a.target && a.target.type === "scenario"), "Activity target.type = scenario");

  // ── 跨案件隔離 ──
  const OTHER = "prj-other";
  await CS.putCase({ pid: OTHER, snap: {} });
  await CS.addScenario(OTHER, {
    scenario_id: "sc-other", name: "別案", engine: makeEngine(), input_hash: fakeHash(9)
  });
  const otherList = await CS.listScenarios(OTHER);
  const mainList = await CS.listScenarios(CASE_ID);
  ok(otherList.length === 1 && mainList.length === 1, "案件間方案不互相污染");

  console.log(`\nM7.3 SCENARIO headless：${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
};

run().catch(e => { console.error("❌ 例外：", e); process.exit(1); });
