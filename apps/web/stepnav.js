/* stepnav.js — 四步決策動線・統一進度軌（Site→Product→People→Decision）。
   單一來源、四頁一致（dashboard/evaluator/os-simulator/report）；當前步高亮；
   每步標「交棒什麼給下一步」，讓「數值移交下一階段」看得見。
   ── 連動（2026-08）──────────────────────────────────────────────
   舊版只是導覽列，四步之間看不出數字有沒有接上。現在每一步直接顯示它**當下**的
   關鍵數字，全部經 case-bus.js 的 stepValues() 逐欄取自同一份 Core result／
   Decision Engine 輸出。取不到就顯示「—」——本檔仍是零計算，只是不再沉默。
   case-bus.js 未載入時退回純導覽（不擋頁）。
   自含樣式（不依賴各頁 CSS 變數）、主題自適應；自我掛載到 body 頂或 #stepnav-mount。
   純導覽，零計算——不碰任何 Core 邏輯。 */
(function () {
  "use strict";
  var STEPS = [
    { n: "①", label: "Site 基地", href: "dashboard.html", hand: "基地事實", key: "site", pick: "允建容積" },
    { n: "②", label: "Product 產品", href: "evaluator.html", hand: "規劃滑桿", key: "product", pick: "全案投報率" },
    { n: "③", label: "People 人心", href: "os-simulator.html", hand: "地主意願", key: "people", pick: "同意進度" },
    { n: "④", label: "Decision 決策", href: "report.html", hand: "逐型對策", key: "decision", pick: "判定" }
  ];

  /* 取該步的代表數字。零計算：只格式化，不換算、不推導。 */
  function liveOf(step) {
    var B = self.CaseBus;
    if (!B || !B.stepValues) return null;
    var rec;
    try { rec = B.activeRecord(); } catch (e) { return null; }
    if (!rec) return null;
    var sv;
    try { sv = B.stepValues(rec); } catch (e) { return null; }
    var group = sv[step.key];
    if (!group) return null;
    /* ③ 顯示「同意 22/56」而不是「56 戶」——後者不會變，看了等於沒看。
       兩個數字都是既有的輸入事實，此處只是挑一個有資訊量的來顯示，不做任何計算。 */
    if (step.pick === "同意進度") {
      var 全 = (group.items || []).filter(function (x) { return x.label === "權變戶數"; })[0];
      var 同 = (group.items || []).filter(function (x) { return x.label === "已同意"; })[0];
      if (全 && 全.value != null && 同 && 同.value != null)
        return { label: "同意戶數", text: 同.value + "/" + 全.value, na: false };
      if (全 && 全.value != null) return { label: "權變戶數", text: 全.value + " 戶", na: false };
      return { label: "同意進度", text: "—", na: true };
    }
    var it = (group.items || []).filter(function (x) { return x.label === step.pick; })[0];
    if (!it || it.value == null) {
      /* 決策那格：說出「為什麼沒有值」。一個沉默的「—」會讓人以為系統壞了，
         而「需重算」是可行動的——這正是 N1 從嚴裁決要傳達給使用者的訊息。 */
      var 註 = (group.bound === false && group.bind_note) ? group.bind_note : step.pick;
      return { label: 註, text: "—", na: true };
    }
    var t;
    if (it.unit === "ratio") t = (it.value * 100).toFixed(1) + "%";
    else if (it.unit === "x") t = Number(it.value).toFixed(3);
    else if (it.unit === "text") t = String(it.value);
    else if (typeof it.value === "number") t = Number(it.value).toLocaleString("en-US", { maximumFractionDigits: 0 })
      + (it.unit && it.unit !== "text" ? " " + it.unit : "");
    else t = String(it.value);
    return { label: (step.key === "decision" ? "快照判定" : step.pick) + (step.key === "decision" && self.UROSCalibration ? " · " + self.UROSCalibration.label : ""), text: t, na: false };
  }
  var MAP = { "dashboard.html": 0, "evaluator.html": 1, "os-simulator.html": 2, "report.html": 3 };

  function currentIdx() {
    var f = (location.pathname.split("/").pop() || "").toLowerCase();
    if (f in MAP) return MAP[f];
    if (typeof window.UROS_STEP === "number") return window.UROS_STEP - 1;
    return 0;
  }

  function css() {
    return '#uros-stepnav{--sn-bg:#fff;--sn-ink:#171529;--sn-mute:#67637d;--sn-line:#e7e4f0;--sn-accent:#5A3FE0;--sn-soft:#eeeafb;'
      + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;'
      + 'background:var(--sn-bg);border-bottom:1px solid var(--sn-line);padding:7px 14px;position:sticky;top:0;z-index:60}'
      + '@media (prefers-color-scheme:dark){#uros-stepnav{--sn-bg:#181626;--sn-ink:#edeafb;--sn-mute:#a6a2c0;--sn-line:#2a2740;--sn-accent:#9a86ff;--sn-soft:#221d3c}}'
      + ':root[data-theme="dark"] #uros-stepnav{--sn-bg:#181626;--sn-ink:#edeafb;--sn-mute:#a6a2c0;--sn-line:#2a2740;--sn-accent:#9a86ff;--sn-soft:#221d3c}'
      + ':root[data-theme="light"] #uros-stepnav{--sn-bg:#fff;--sn-ink:#171529;--sn-mute:#67637d;--sn-line:#e7e4f0;--sn-accent:#5A3FE0;--sn-soft:#eeeafb}'
      + '#uros-stepnav .sn-wrap{max-width:1080px;margin:0 auto;display:flex;align-items:center;gap:2px;overflow-x:auto}'
      + '#uros-stepnav .sn-node{display:flex;flex-direction:column;gap:0;text-decoration:none;padding:3px 10px;border-radius:9px;white-space:nowrap;color:var(--sn-mute);line-height:1.35}'
      + '#uros-stepnav .sn-node b{font-size:12.5px;font-weight:700;color:var(--sn-ink)}'
      + '#uros-stepnav .sn-node small{font-size:10px;color:var(--sn-mute)}'
      + '#uros-stepnav .sn-live{display:block;font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;'
      + 'font-size:11px;font-weight:700;color:var(--sn-ink);letter-spacing:.01em}'
      + '#uros-stepnav .sn-live.na{color:var(--sn-mute);font-weight:400}'
      + '#uros-stepnav .sn-node.on .sn-live{color:var(--sn-accent)}'
      + '#uros-stepnav a.sn-node:hover{background:var(--sn-soft)}'
      + '#uros-stepnav .sn-node.on{background:var(--sn-soft)}'
      + '#uros-stepnav .sn-node.on b{color:var(--sn-accent)}'
      + '#uros-stepnav .sn-node.on small{color:var(--sn-accent)}'
      + '#uros-stepnav .sn-arrow{color:var(--sn-mute);font-size:12px;flex:0 0 auto;padding:0 1px}'
      + '#uros-stepnav .sn-cap{max-width:1080px;margin:2px auto 0;font-size:10.5px;color:var(--sn-mute)}';
  }

  function build() {
    if (document.getElementById("uros-stepnav")) return;
    var cur = currentIdx();
    if (!document.getElementById("stepnav-style")) {
      var st = document.createElement("style"); st.id = "stepnav-style";
      st.textContent = css(); document.head.appendChild(st);
    }
    var bar = document.createElement("nav");
    bar.id = "uros-stepnav";
    bar.setAttribute("aria-label", "案件四步工作流程");
    var inner = '<div class="sn-wrap">';
    var 有連動 = false;
    STEPS.forEach(function (s, i) {
      if (i) inner += '<span class="sn-arrow">→</span>';
      var on = i === cur ? " on" : "";
      var live = liveOf(s);
      if (live) 有連動 = true;
      var body = "<b>" + s.n + " " + s.label + "</b>"
        + (live ? '<span class="sn-live' + (live.na ? " na" : "") + '">' + String(live.text).replace(/[&<>"']/g, function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}) + "</span>"
                  + "<small>" + live.label + "</small>"
                : "<small>" + (i === cur ? "交棒：" : "") + s.hand + "</small>");
      inner += (i === cur)
        ? '<span class="sn-node' + on + '">' + body + "</span>"
        : '<a class="sn-node' + on + '" href="' + s.href + '">' + body + "</a>";
    });
    inner += "</div>";
    /* 陳舊快照要講出來：畫面上同時有 core 0.6.0 徽章和 0.4.0 算的數字，不標等於誤導。 */
    var 陳舊 = "";
    try {
      var B = self.CaseBus;
      if (B && B.provenance && B.activeRecord) {
        var pv = B.provenance(B.activeRecord());
        if (pv && pv.stale) 陳舊 = "　⚠️ " + pv.stale_note;
      }
    } catch (e) {}
    inner += '<div class="sn-cap' + (陳舊 ? ' sn-stale' : '') + '">'
      + (self.UROSSecurity ? self.UROSSecurity.esc(陳舊) : "") + "</div>";
    bar.innerHTML = inner;
    var mount = document.getElementById("stepnav-mount");
    if (mount) mount.appendChild(bar);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  /* 重畫（案件一改就重畫，四步的數字才會真的跟著動）。 */
  function refresh() {
    var old = document.getElementById("uros-stepnav");
    if (old && old.parentNode) old.parentNode.removeChild(old);
    build();
  }

  function boot() {
    build();
    try {
      if (self.CaseBus && self.CaseBus.onChange) self.CaseBus.onChange(refresh);
      else window.addEventListener("storage", function (e) {
        if (!e.key || e.key === "uros.workflow.v1" || e.key === "uros.active_case") refresh();
      });
    } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.urosStepNav = build;
  window.urosStepNavRefresh = refresh;
  if (typeof module !== "undefined" && module.exports) module.exports = { STEPS: STEPS, liveOf: liveOf };
})();
