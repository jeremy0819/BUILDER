/* Shared case context and compact workspace header for the four-step OS. */
(function (root) {
  "use strict";

  var PAGES = {
    "dashboard.html": { key: "site", n: "01 / 04", title: "基地與地政" },
    "evaluator.html": { key: "product", n: "02 / 04", title: "產品與財務" },
    "os-simulator.html": { key: "people", n: "03 / 04", title: "地主整合" },
    "report.html": { key: "decision", n: "04 / 04", title: "決策與行動" }
  };
  var PRODUCT_VIEWS = [
    { id: "core", label: "Core 摘要" },
    { id: "l1", label: "量體教學" },
    { id: "l2", label: "財務教學" },
    { id: "health", label: "健檢與敏感度" },
    { id: "import", label: "匯入比對" }
  ];

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fileName() { return (location.pathname.split("/").pop() || "").toLowerCase(); }
  function activeRecord() {
    try { return root.CaseBus && root.CaseBus.activeRecord ? root.CaseBus.activeRecord() : null; }
    catch (e) { return null; }
  }
  function shortHash(value) { return String(value || "").replace(/^sha256:/, "").slice(0, 10); }
  function fmt(value, unit) {
    if (value == null) return "—";
    if (unit === "ratio") return (Number(value) * 100).toFixed(1) + "%";
    if (typeof value === "number") return value.toLocaleString("en-US", { maximumFractionDigits: 1 }) + (unit ? " " + unit : "");
    return String(value);
  }
  function optionsHtml(active) {
    if (!root.CaseBus || !root.CaseBus.readStore) return '<option>尚無案件</option>';
    var store;
    try { store = root.CaseBus.readStore(); } catch (e) { return '<option>案件資料無法讀取</option>'; }
    return (store.order || []).filter(function (pid) { return store.projects && store.projects[pid]; }).map(function (pid) {
      var rec = store.projects[pid], snap = rec.snap || {};
      return '<option value="' + esc(pid) + '"' + (pid === active ? " selected" : "") + '>'
        + esc(snap.code_name || pid) + (rec.demo ? "（示範）" : "") + "</option>";
    }).join("") || '<option>尚無案件</option>';
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("uros.theme", theme); } catch (e) {}
  }
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem("uros.theme"); } catch (e) {}
    if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);
  }

  function productHub(rec) {
    var old = document.getElementById("uros-product-hub");
    if (old) old.remove();
    var v = (rec && rec.view) || {};
    var hub = document.createElement("main");
    hub.id = "uros-product-hub";
    hub.className = "uros-product-hub";
    hub.innerHTML = '<div class="uros-product-title"><div><h1>產品規劃工作區</h1>'
      + '<p>作用中案件 · Core 權威摘要</p></div>'
      + '<a href="dashboard.html" class="uros-icon-btn" title="回基地頁" aria-label="回基地頁">←</a></div>'
      + '<div class="uros-kpis">'
      + kpi("允建容積", fmt(v.allow_floor_area, "㎡"))
      + kpi("銷售坪數", fmt(v.saleable_area, "坪"))
      + kpi("共同負擔比", fmt(v.shared_cost_ratio, "ratio"))
      + kpi("全案投報率", fmt(v.return_rate, "ratio"))
      + '</div><div class="uros-view-tabs" role="tablist" aria-label="產品工作區視圖">'
      + PRODUCT_VIEWS.map(function (x) {
        return '<button type="button" role="tab" data-view="' + x.id + '" aria-selected="' + (x.id === "core")
          + '" tabindex="' + (x.id === "core" ? "0" : "-1") + '">' + x.label + "</button>";
      }).join("") + "</div>";
    var firstSection = document.querySelector("section");
    document.body.insertBefore(hub, firstSection || document.body.firstChild);
    var buttons = hub.querySelectorAll("[data-view]");
    function show(id) {
      PRODUCT_VIEWS.forEach(function (x) {
        var section = document.getElementById(x.id);
        if (section) section.hidden = id === "core" || x.id !== id;
      });
      Array.prototype.forEach.call(buttons, function (b) {
        var selected = b.getAttribute("data-view") === id;
        b.setAttribute("aria-selected", String(selected));
        b.setAttribute("tabindex", selected ? "0" : "-1");
      });
    }
    Array.prototype.forEach.call(buttons, function (b, index) {
      b.addEventListener("click", function () { show(b.getAttribute("data-view")); });
      b.addEventListener("keydown", function (event) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        var next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length;
        buttons[next].focus(); buttons[next].click();
      });
    });
    var requested = location.hash ? location.hash.slice(1) : "core";
    show(PRODUCT_VIEWS.some(function (x) { return x.id === requested; }) ? requested : "core");
  }
  function kpi(label, value) {
    return '<div class="uros-kpi"><span>' + label + '</span><b>' + esc(value) + "</b></div>";
  }

  function build() {
    var page = PAGES[fileName()];
    if (!page || !document.body) return;
    initTheme();
    document.body.classList.add("uros-unified", "uros-page-" + page.key);
    var existing = document.getElementById("uros-shell");
    if (existing) existing.remove();
    var rec = activeRecord(), pid = rec && rec.pid, snap = (rec && rec.snap) || {};
    var shell = document.createElement("header");
    shell.id = "uros-shell";
    shell.className = "uros-shell";
    shell.innerHTML = '<div class="uros-shell-inner">'
      + '<div class="uros-shell-id"><span class="uros-mark">UR</span><div><div class="uros-step-id">' + page.n
      + '</div><div class="uros-shell-title">' + page.title + "</div></div></div>"
      + '<div class="uros-shell-case"><label for="uros-shell-case">作用中案件</label><select id="uros-shell-case">'
      + optionsHtml(pid) + "</select></div>"
      + '<div class="uros-shell-actions"><a class="uros-icon-btn" href="index.html" title="OS 主選單" aria-label="OS 主選單">⌂</a>'
      + '<a class="uros-icon-btn" href="workspace.html" title="案件工作區" aria-label="案件工作區">▦</a>'
      + '<button class="uros-icon-btn" id="uros-theme" type="button" title="切換主題" aria-label="切換主題">◐</button></div>'
      + '<div class="uros-shell-prov"><span>案件快照</span><b>' + esc(snap.code_name || "尚無案件") + "</b><span>" + esc(snap.case_type === "danger_building" ? "危老重建" : "都市更新")
      + '</span><span>input ' + esc(shortHash(snap.input_hash) || "—") + '</span><span>core ' + esc(snap.core_version || "—") + "</span></div></div>";
    var stepnav = document.getElementById("uros-stepnav");
    if (stepnav && stepnav.nextSibling) stepnav.parentNode.insertBefore(shell, stepnav.nextSibling);
    else if (stepnav) stepnav.parentNode.appendChild(shell);
    else document.body.insertBefore(shell, document.body.firstChild);

    var selector = document.getElementById("uros-shell-case");
    if (selector) selector.addEventListener("change", function () {
      if (!selector.value || !root.CaseBus) return;
      root.CaseBus.setActive(selector.value);
      location.reload();
    });
    var theme = document.getElementById("uros-theme");
    if (theme) theme.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme");
      if (!current) current = matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
    if (page.key === "product") productHub(rec);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  root.UROSShell = { build: build, fmt: fmt, pages: PAGES };
})(typeof self !== "undefined" ? self : this);
