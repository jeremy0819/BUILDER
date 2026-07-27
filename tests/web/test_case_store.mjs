// tests/web/test_case_store.mjs — M7.1 Case OS Foundation headless 測試
// 以最小 IndexedDB 假實作在 node 驗證 case-store.js 的**紀律**（非瀏覽器行為）：
//   §1 只記事實與意圖（推論欄位寫入必須被擋）
//   §3 Activity append-only（改/刪必須被拒）
//   §4 Session 只存區間、不複製事件
//   §5 History 攜帶完整 input set
//   §2 localStorage 一次性遷移（舊資料保留不刪）
// 執行：node tests/web/test_case_store.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) pass++; else { fail++; console.error("❌", n); } };
const rejects = async (p, n) => { try { await p; fail++; console.error("❌", n, "(應該被拒但成功了)"); } catch { pass++; } };

// ── 極簡 IndexedDB 假實作（足以驗紀律，不模擬完整規格）──
function makeFakeIDB() {
  const stores = { cases: new Map(), activity: new Map(), meta: new Map() };
  let auto = 0;
  const idx = {
    activity: { by_case: (v) => [...stores.activity.values()].filter(r => r.case_id === v) }
  };
  function objectStore(name, mode) {
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
          transaction(name, mode) {
            const t = { objectStore: (n) => objectStore(n, mode) };
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

// ── 載入 case-store.js（以 self 為全域）──
const fakeIDB = makeFakeIDB();
const lsData = {};
global.self = {
  indexedDB: fakeIDB,
  localStorage: {
    getItem: (k) => (k in lsData ? lsData[k] : null),
    setItem: (k, v) => { lsData[k] = String(v); },
    removeItem: (k) => { delete lsData[k]; }
  }
};
global.localStorage = global.self.localStorage;
const fakeNav = { storage: null };                 // node 22 的 global.navigator 唯讀，改用注入
const src = readFileSync(join(root, "apps/web/case-store.js"), "utf8");
new Function("self", "localStorage", "navigator", "module", src)(
  global.self, global.localStorage, fakeNav, { exports: {} });
const CS = global.self.CaseStore;
ok(!!CS, "case-store 載入");

// ── 準備：舊 localStorage 資料（遷移來源）──
lsData["uros.workflow.v1"] = JSON.stringify({
  order: ["prj-x1", "prj-x2"],
  projects: {
    "prj-x1": { snap: { code_name: "案例X1" }, demo: true },
    "prj-x2": { snap: { code_name: "案例X2" }, demo: false }
  }
});

const run = async () => {
  // §2 遷移：舊資料進 IndexedDB，且 localStorage 原檔保留（唯讀備援，不刪）
  const m = await CS.migrateFromLocalStorage();
  ok(m.migrated === true && m.count === 2, "localStorage → IndexedDB 遷移 2 案");
  ok(lsData["uros.workflow.v1"] != null, "遷移後保留舊 localStorage 作唯讀備援（不刪）");
  const again = await CS.migrateFromLocalStorage();
  ok(again.migrated === false, "遷移具冪等性（第二次不重跑）");
  const cases = await CS.listCases();
  ok(cases.length === 2, "IndexedDB 內有 2 案");

  // §1 只記事實與意圖：推論欄位必須被擋
  await rejects(CS.append("prj-x1", { kind: "edit", field: "verdict", after: "GO" }), "verdict 應被擋");
  await rejects(CS.append("prj-x1", { kind: "edit", field: "return_rate", after: 0.5 }), "return_rate 應被擋");
  await rejects(CS.append("prj-x1", { kind: "edit", field: "shared_cost_ratio", after: 0.6 }), "共負比應被擋");
  await rejects(CS.append("prj-x1", { kind: "edit", field: "persuasion_queue", after: [] }), "先談誰清單應被擋");

  // 合法：記錄「輸入」的變更＋意圖
  await CS.append("prj-x1", { kind: "edit", target: { type: "product" }, field: "住宅單價",
                              before: 92, after: 96, intent: "地主要求增加坪數", by: "integrator" });
  await CS.append("prj-x1", { kind: "roster", target: { type: "stakeholder", id: "W12" },
                              field: "限制登記", before: "無", after: "繼承未辦" });
  const acts = await CS.listActivity("prj-x1");
  ok(acts.length === 2, "合法輸入事件寫入成功（2 筆）");
  ok(acts[0].intent === "地主要求增加坪數", "intent 有被保存（可解釋性的來源）");
  ok(acts.every(a => a.ts), "每筆事件都有時戳");

  // §3 append-only：改/刪必須被拒
  await rejects(CS.updateActivity(), "修改既有事件應被拒");
  await rejects(CS.deleteActivity(), "刪除既有事件應被拒");

  // 事件只屬於自己的案件
  await CS.append("prj-x2", { kind: "note", intent: "另一案的事件" });
  ok((await CS.listActivity("prj-x1")).length === 2, "案件間事件不互相污染");
  ok((await CS.listActivity("prj-x2")).length === 1, "prj-x2 有自己的 1 筆");

  // §4 Session：只存區間，不複製事件內容
  const se = await CS.startSession("prj-x1", "調整產品配比");
  ok(se.session_id && se.first_event, "Session 有 id 與起點");
  await CS.append("prj-x1", { kind: "edit", field: "公設比", before: 0.33, after: 0.35 });
  const se2 = await CS.endSession("prj-x1", se);
  ok(se2.ended_at && se2.last_event, "Session 有終點");
  ok(!("events" in se2) && !("activity" in se2), "Session 不複製事件內容（非第二真源）");

  // §2.3 備份三條之(3)：完整備份可匯出並還原
  const bak = await CS.exportAll();
  ok(bak.format === "uros-backup" && bak.cases.length === 2, "匯出完整備份（2 案）");
  ok(bak.activity.length >= 3, "備份含 Activity 事件");
  await rejects(CS.importAll({ format: "not-uros" }), "非 uros 備份檔應被拒");

  // (1) 自動匯出提醒
  ok((await CS.daysSinceBackup()) === Infinity, "從未備份 → Infinity（應提示）");
  await CS.markBackedUp();
  ok((await CS.daysSinceBackup()) < 1, "標記備份後天數歸零");

  console.log(`\nM7.1 CASE STORE headless：${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
};

run().catch(e => { console.error("❌ 例外：", e); process.exit(1); });
