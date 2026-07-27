/* case-store.js — M7.1 Case OS Foundation：IndexedDB 儲存層 ＋ Memory（Activity/Session/History）
   ============================================================================
   憲章＝docs/architecture/M7_CASE_OS_SPEC.md。本檔實作 §2–§5：

   §2 儲存：改用 IndexedDB（localStorage 5MB 上限約 8 個活躍案件即滿，且超限時**靜默失敗**）。
        內含 localStorage 一次性遷移，遷移後保留舊資料為唯讀備援（不刪）。
   §3 Activity：append-only 事件流。既有事件不得修改或刪除。
   §4 Session：Activity 上的命名區間（不複製事件內容，避免第二真源）。
   §5 History：完整 input set＋input_hash 的版本鏈（非 diff）。

   ★ 鐵律（§1）：只記錄「事實與意圖」，**永不寫入推論結果**（EV／verdict／IRR／坪數／對策）。
     本檔有 assertNoInference() 主動擋下含推論欄位的寫入。
   ★ 本檔零計算：不含任何財務公式，數字一律來自 Core。
   ★ UI 狀態（頁面/捲動/展開）不屬案件事實，另存他處，不得進本層。 */
(function () {
  "use strict";

  var DB_NAME = "uros", DB_VER = 1;
  var S_CASES = "cases", S_ACT = "activity", S_META = "meta";
  var LS_KEY = "uros.workflow.v1";               // 舊 localStorage 主鍵（遷移來源，保留不刪）
  var MIGRATED_FLAG = "uros.migrated_to_idb";

  // 推論欄位黑名單（§1 鐵律的機器守衛）
  var INFERENCE_KEYS = ["ev", "verdict", "irr", "return_rate", "shared_cost_ratio",
                        "completion_probability", "decision_urgency", "breakpoint_stakeholder",
                        "persuasion_queue", "cascade_risk", "saleable_area", "efficiency_ratio"];

  function assertNoInference(ev) {
    // 只檢查事件本身的 before/after/field——那是「輸入值」；推論欄位混進來即擋。
    var f = (ev && ev.field ? String(ev.field) : "").toLowerCase();
    for (var i = 0; i < INFERENCE_KEYS.length; i++) {
      if (f === INFERENCE_KEYS[i]) {
        throw new Error("Memory 層不得記錄推論結果（field=" + ev.field + "）——請記錄造成它改變的『輸入』");
      }
    }
    return true;
  }

  function open() {
    return new Promise(function (resolve, reject) {
      if (!self.indexedDB) return reject(new Error("此瀏覽器不支援 IndexedDB"));
      var req = self.indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(S_CASES)) db.createObjectStore(S_CASES, { keyPath: "pid" });
        if (!db.objectStoreNames.contains(S_ACT)) {
          var s = db.createObjectStore(S_ACT, { keyPath: "key", autoIncrement: true });
          s.createIndex("by_case", "case_id", { unique: false });
          s.createIndex("by_case_ts", ["case_id", "ts"], { unique: false });
        }
        if (!db.objectStoreNames.contains(S_META)) db.createObjectStore(S_META, { keyPath: "k" });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(store, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(store, mode), s = t.objectStore(store), out;
        try { out = fn(s); } catch (e) { reject(e); return; }
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error("交易中止（可能配額不足）")); };
      });
    });
  }

  var api = {
    // ── 案件 ────────────────────────────────────────────────
    getCase: function (pid) { return tx(S_CASES, "readonly", function (s) { return s.get(pid); }); },
    listCases: function () { return tx(S_CASES, "readonly", function (s) { return s.getAll(); }); },
    putCase: function (rec) {
      if (!rec || !rec.pid) return Promise.reject(new Error("putCase 需 pid"));
      return tx(S_CASES, "readwrite", function (s) { return s.put(rec); });
    },
    deleteCase: function (pid) { return tx(S_CASES, "readwrite", function (s) { return s.delete(pid); }); },

    // ── Activity（append-only）─────────────────────────────
    append: function (caseId, ev) {
      // 一律以 rejected Promise 回報錯誤（不同步 throw），呼叫端只需 .catch
      try {
        ev = Object.assign({}, ev || {});
        assertNoInference(ev);                     // §1 守衛
        if (!ev.kind) throw new Error("事件需 kind");
        ev.case_id = caseId;
        ev.ts = ev.ts || new Date().toISOString();
      } catch (e) { return Promise.reject(e); }
      return tx(S_ACT, "readwrite", function (s) { return s.add(ev); });
    },
    listActivity: function (caseId, limit) {
      return tx(S_ACT, "readonly", function (s) {
        return s.index("by_case").getAll(caseId);
      }).then(function (rows) {
        rows = (rows || []).sort(function (a, b) { return (a.ts || "").localeCompare(b.ts || "") || (a.key - b.key); });
        return limit ? rows.slice(-limit) : rows;
      });
    },
    /* append-only 守衛：提供刪改 API 只為明確拒絕，讓違規在開發期就爆炸 */
    updateActivity: function () { return Promise.reject(new Error("Activity 為 append-only，不得修改既有事件")); },
    deleteActivity: function () { return Promise.reject(new Error("Activity 為 append-only，不得刪除既有事件")); },

    // ── Session（Activity 上的命名區間；存在 meta，不複製事件）──
    startSession: function (caseId, name) {
      var id = "se-" + Date.now().toString(36);
      return api.listActivity(caseId).then(function (rows) {
        var last = rows.length ? rows[rows.length - 1] : null;
        var se = { session_id: id, name: name || "工作階段", started_at: new Date().toISOString(),
                   ended_at: null, first_event: last ? String(last.key + 1) : "1", last_event: null };
        return api.meta("session:" + caseId + ":" + id, se).then(function () { return se; });
      });
    },
    endSession: function (caseId, se) {
      return api.listActivity(caseId).then(function (rows) {
        var last = rows.length ? rows[rows.length - 1] : null;
        se.ended_at = new Date().toISOString();
        se.last_event = last ? String(last.key) : se.first_event;
        return api.meta("session:" + caseId + ":" + se.session_id, se).then(function () { return se; });
      });
    },

    // ── meta（版本旗標、備份時間、Session…）────────────────
    meta: function (k, v) {
      if (v === undefined) {
        return tx(S_META, "readonly", function (s) { return s.get(k); })
          .then(function (r) { return r ? r.v : null; });
      }
      return tx(S_META, "readwrite", function (s) { return s.put({ k: k, v: v }); });
    },

    // ── §2.2 localStorage 一次性遷移（舊資料保留為唯讀備援，不刪）──
    migrateFromLocalStorage: function () {
      return api.meta(MIGRATED_FLAG).then(function (done) {
        if (done) return { migrated: false, reason: "already" };
        var raw = null;
        try { raw = localStorage.getItem(LS_KEY); } catch (e) { }
        if (!raw) return api.meta(MIGRATED_FLAG, new Date().toISOString())
          .then(function () { return { migrated: false, reason: "no-legacy-data" }; });
        var s;
        try { s = JSON.parse(raw); } catch (e) { return { migrated: false, reason: "parse-error" }; }
        var order = (s && s.order) || [], projects = (s && s.projects) || {};
        var chain = Promise.resolve(), n = 0;
        order.forEach(function (pid) {
          if (!projects[pid]) return;
          chain = chain.then(function () {
            n++;
            return api.putCase(Object.assign({ pid: pid }, projects[pid]));
          });
        });
        return chain
          .then(function () { return api.meta("uros.case_order", order); })
          .then(function () { return api.meta(MIGRATED_FLAG, new Date().toISOString()); })
          .then(function () { return { migrated: true, count: n }; });
      });
    },

    // ── §2.3 Local-first 三義務 ────────────────────────────
    /* (3) 一鍵完整備份：單一 JSON 含所有案件＋Activity＋meta */
    exportAll: function () {
      return Promise.all([api.listCases(), tx(S_ACT, "readonly", function (s) { return s.getAll(); }),
                          tx(S_META, "readonly", function (s) { return s.getAll(); })])
        .then(function (r) {
          return { format: "uros-backup", version: 1, exported_at: new Date().toISOString(),
                   cases: r[0] || [], activity: r[1] || [], meta: r[2] || [] };
        });
    },
    /* 還原：合併匯入（同 pid 以匯入檔為準），不清空既有其他案件 */
    importAll: function (doc) {
      if (!doc || doc.format !== "uros-backup") return Promise.reject(new Error("非 uros 備份檔"));
      var chain = Promise.resolve();
      (doc.cases || []).forEach(function (c) { chain = chain.then(function () { return api.putCase(c); }); });
      (doc.activity || []).forEach(function (e) {
        chain = chain.then(function () {
          return tx(S_ACT, "readwrite", function (s) { var x = Object.assign({}, e); delete x.key; return s.add(x); });
        });
      });
      return chain.then(function () { return { cases: (doc.cases || []).length }; });
    },
    /* (1) 自動匯出提醒：回傳距上次備份幾天 */
    daysSinceBackup: function () {
      return api.meta("uros.last_backup_at").then(function (t) {
        if (!t) return Infinity;
        return (Date.now() - new Date(t).getTime()) / 86400000;
      });
    },
    markBackedUp: function () { return api.meta("uros.last_backup_at", new Date().toISOString()); },

    /* 儲存用量（IndexedDB 配額以 GB 計，但仍給使用者看得到的數字）*/
    usage: function () {
      if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate();
      return Promise.resolve({ usage: null, quota: null });
    },

    _assertNoInference: assertNoInference,
    _INFERENCE_KEYS: INFERENCE_KEYS
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;   // node 測試用
  self.CaseStore = api;
})();
