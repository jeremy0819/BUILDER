/* Local-only, versioned recovery envelope. No case data leaves the browser. */
(function (root) {
  "use strict";
  var LIMIT = 32 * 1024 * 1024, pending = false;
  function locals() {
    var out = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf("uros.") === 0) out[key] = localStorage.getItem(key);
    }
    return out;
  }
  function validate(doc) {
    if (!doc || doc.format !== "uros-browser-backup" || doc.version !== 1 || !doc.idb ||
        doc.idb.format !== "uros-backup" || doc.idb.version !== 1 ||
        !Array.isArray(doc.idb.cases) || !Array.isArray(doc.idb.activity) || !Array.isArray(doc.idb.meta) ||
        !doc.local_storage || typeof doc.local_storage !== "object" || Array.isArray(doc.local_storage))
      throw new Error("備份格式或版本不支援；既有資料未變更");
    Object.keys(doc.local_storage).forEach(function (key) {
      if (!/^uros\./.test(key) || typeof doc.local_storage[key] !== "string") throw new Error("備份含非 BUILDER 儲存鍵");
    });
    if (doc.local_storage["uros.workflow.v1"]) {
      var store = root.UROSSecurity.parseJSON(doc.local_storage["uros.workflow.v1"]);
      if (!Array.isArray(store.order) || !store.projects || Array.isArray(store.projects)) throw new Error("案件索引無效");
      store.order.forEach(function (pid) { if (typeof pid !== "string" || !store.projects[pid]) throw new Error("案件索引不完整"); });
    }
    [[doc.idb.cases, "pid"], [doc.idb.activity, "key"], [doc.idb.meta, "k"]].forEach(function (pair) {
      var seen = new Set();
      pair[0].forEach(function (row) {
        var key = row && row[pair[1]];
        if ((pair[1] === "key" ? !Number.isSafeInteger(key) || key < 1 : typeof key !== "string" || !key) || seen.has(key)) throw new Error("備份資料鍵無效或重複");
        seen.add(key);
      });
    });
    return doc;
  }
  async function snapshot() {
    var doc = { format: "uros-browser-backup", version: 1, exported_at: new Date().toISOString(),
      local_storage: locals(), idb: await root.CaseStore.exportAll() };
    if (JSON.stringify(doc.local_storage) !== JSON.stringify(locals())) throw new Error("備份期間有本機資料變更，請暫停編輯後重試");
    return validate(root.UROSSecurity.parseJSON(JSON.stringify(doc), LIMIT));
  }
  function statusText(timestamp, now) {
    var age = timestamp ? (now - Date.parse(timestamp)) / 86400000 : Infinity;
    if (!Number.isFinite(age) || age < 0) return { due: true, text: "尚無有效備份紀錄" };
    return { due: age >= 7, text: "上次確認備份：" + Math.floor(age) + " 天前" };
  }
  async function refresh() {
    var status = document.getElementById("backup-status"); if (!status) return;
    try {
      var s = statusText(await root.CaseStore.meta("uros.last_backup_at"), Date.now());
      status.textContent = pending ? "下載已開始；請確認檔案已儲存，再按「已確認存檔」" : s.text;
      document.getElementById("browser-backup").classList.toggle("backup-due", s.due || pending);
      document.getElementById("backup-confirm").hidden = !pending;
    } catch (e) { status.textContent = "無法讀取備份狀態；請勿清除瀏覽資料"; }
  }
  async function confirmed() {
    await root.CaseStore.markBackedUp(); pending = false; await refresh();
  }
  async function save() {
    var handle = null;
    try {
      // Acquire the picker during user activation; cancellation is never a successful backup.
      if (root.showSaveFilePicker) handle = await root.showSaveFilePicker({ suggestedName: "BUILDER-backup.json",
        types: [{ description: "BUILDER backup", accept: { "application/json": [".json"] } }] });
      var doc = await snapshot(), text = JSON.stringify(doc, null, 2);
      if (handle) {
        var stream = await handle.createWritable(); await stream.write(text); await stream.close(); await confirmed();
      } else {
        var url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
        var a = document.createElement("a"); a.href = url; a.download = "BUILDER-backup.json"; a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        pending = true; await refresh();
      }
    } catch (e) {
      if (e.name !== "AbortError") document.getElementById("backup-status").textContent = "備份未完成；原資料保留。" + e.message;
    }
  }
  async function restore(doc) {
    doc = validate(root.UROSSecurity.parseJSON(JSON.stringify(doc), LIMIT));
    var old = locals();
    var business = Object.keys(old).filter(function (key) {
      if (["uros.theme", "uros.active_case", "uros.last_backup_at", "uros.diagnostics.v1"].includes(key)) return false;
      if (key === "uros.workflow.v1") {
        var s = root.UROSSecurity.parseJSON(old[key]); return !s || !Array.isArray(s.order) || s.order.length || Object.keys(s.projects || {}).length;
      }
      return true;
    });
    if (business.length) throw new Error("請在沒有 BUILDER 資料的瀏覽器設定檔還原；不會覆蓋現有資料");
    // Restore only into an empty database. Preserve event IDs and session references together.
    var db = await new Promise(function (resolve, reject) {
      var req = indexedDB.open("uros", 1); req.onsuccess = function () { resolve(req.result); }; req.onerror = function () { reject(req.error); };
    });
    try {
      await new Promise(function (resolve, reject) {
        var tx = db.transaction(["cases", "activity", "meta"], "readwrite"), failure = null, remaining = 3, counts = {};
        tx.oncomplete = resolve;
        tx.onabort = function () {
          try { Object.keys(locals()).forEach(function (k) { localStorage.removeItem(k); }); Object.keys(old).forEach(function (k) { localStorage.setItem(k, old[k]); }); }
          catch (e) { failure = new Error("還原失敗且瀏覽器拒絕回復設定；請保留原備份檔"); }
          reject(failure || tx.error || new Error("還原未完成"));
        };
        ["cases", "activity", "meta"].forEach(function (name) {
          var req = tx.objectStore(name).getAll();
          req.onsuccess = function () {
            counts[name] = req.result;
            if (--remaining) return;
            try {
              if (counts.cases.length || counts.activity.length || counts.meta.some(function (r) { return !["uros.last_backup_at", "uros.migrated_to_idb", "uros.case_order"].includes(r.k); }))
                throw new Error("IndexedDB 已有案件資料；拒絕覆蓋");
              ["cases", "activity", "meta"].forEach(function (store) { tx.objectStore(store).clear(); doc.idb[store].forEach(function (r) { tx.objectStore(store).add(r); }); });
              Object.keys(old).forEach(function (k) { localStorage.removeItem(k); });
              Object.keys(doc.local_storage).forEach(function (k) { localStorage.setItem(k, doc.local_storage[k]); });
            } catch (e) { failure = e; tx.abort(); }
          };
        });
      });
    } finally { db.close(); }
  }
  function mount() {
    if (!root.CaseStore || document.getElementById("browser-backup")) return;
    var host = document.createElement("section"); host.id = "browser-backup"; host.className = "data-notice";
    host.setAttribute("aria-label", "本機資料與備份");
    host.innerHTML = '<div class="backup-row"><strong>資料僅存在此瀏覽器，清除瀏覽資料可能永久遺失。</strong>'
      + '<button type="button" id="backup-save">匯出完整備份</button><button type="button" id="backup-confirm" hidden>已確認存檔</button></div>'
      + '<span id="backup-status" role="status" aria-live="polite">讀取備份狀態…</span>'
      + '<details><summary>還原備份</summary><p>備份含案件、歷程、方案及本機草稿，可能包含個人資料，請妥善保管。僅能還原至沒有 BUILDER 資料的瀏覽器設定檔。</p>'
      + '<label>選取完整備份 JSON <input id="backup-restore" type="file" accept=".json,application/json"></label></details>'
      + '<details><summary>本機診斷</summary><p>僅包含錯誤類別與時間，不含案件名稱、輸入、錯誤原文或堆疊，最多 50 筆。</p><button type="button" id="diagnostics-export">匯出診斷摘要</button></details>';
    var anchor = document.getElementById("uros-shell") || document.querySelector(".top") || document.querySelector(".hero");
    if (anchor) anchor.after(host); else document.body.prepend(host);
    document.getElementById("backup-save").addEventListener("click", save);
    document.getElementById("diagnostics-export").addEventListener("click", function () {
      var events = root.UROSDiagnostics ? root.UROSDiagnostics.read() : [];
      var url=URL.createObjectURL(new Blob([JSON.stringify({format:"uros-diagnostics",version:1,events:events},null,2)],{type:"application/json"}));
      var link=document.createElement("a");link.href=url;link.download="BUILDER-diagnostics.json";link.click();
      setTimeout(function(){URL.revokeObjectURL(url);},60000);
    });
    document.getElementById("backup-confirm").addEventListener("click", function () { confirmed().catch(function () { document.getElementById("backup-status").textContent = "備份時間寫入失敗，請保留下載檔"; }); });
    document.getElementById("backup-restore").addEventListener("change", async function (event) {
      var file = event.target.files[0]; if (!file) return;
      try {
        if (file.size > LIMIT) throw new Error("檔案超過 32 MB 限制");
        var doc = validate(root.UROSSecurity.parseJSON(await file.text(), LIMIT));
        if (!confirm("還原此 BUILDER 備份？現有案件不會被覆蓋。")) return;
        await restore(doc); location.href = "index.html";
      } catch (e) { document.getElementById("backup-status").textContent = "還原未完成：" + e.message; }
      finally { event.target.value = ""; }
    });
    refresh(); root.addEventListener("storage", refresh); root.addEventListener("focus", refresh); root.addEventListener("uros:case-changed", refresh);
  }
  root.BrowserBackup = { snapshot: snapshot, restore: restore, save: save, validate: validate, statusText: statusText };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount,0); }); else mount();
})(typeof self !== "undefined" ? self : this);
