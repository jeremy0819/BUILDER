/* stepnav.js — 四步決策動線・統一進度軌（Site→Product→People→Decision）。
   單一來源、四頁一致（dashboard/evaluator/os-simulator/report）；當前步高亮；
   每步標「交棒什麼給下一步」，讓「數值移交下一階段」看得見。
   自含樣式（不依賴各頁 CSS 變數）、主題自適應；自我掛載到 body 頂或 #stepnav-mount。
   純導覽，零計算——不碰任何 Core 邏輯。 */
(function () {
  "use strict";
  var STEPS = [
    { n: "①", label: "Site 基地", href: "dashboard.html", hand: "基地事實" },
    { n: "②", label: "Product 產品", href: "evaluator.html", hand: "規劃滑桿" },
    { n: "③", label: "People 人心", href: "os-simulator.html", hand: "地主意願" },
    { n: "④", label: "Decision 決策", href: "report.html", hand: "逐型對策" }
  ];
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
    var st = document.createElement("style");
    st.textContent = css();
    document.head.appendChild(st);
    var bar = document.createElement("nav");
    bar.id = "uros-stepnav";
    var inner = '<div class="sn-wrap">';
    STEPS.forEach(function (s, i) {
      if (i) inner += '<span class="sn-arrow">→</span>';
      var on = i === cur ? " on" : "";
      if (i === cur) {
        inner += '<span class="sn-node' + on + '"><b>' + s.n + " " + s.label + "</b><small>交棒：" + s.hand + "</small></span>";
      } else {
        inner += '<a class="sn-node' + on + '" href="' + s.href + '"><b>' + s.n + " " + s.label + "</b><small>" + s.hand + "</small></a>";
      }
    });
    inner += "</div>";
    inner += '<div class="sn-cap">決策動線：每步產出交棒下一步 — 基地事實 → 規劃滑桿 → 地主意願 → 逐型對策</div>';
    bar.innerHTML = inner;
    var mount = document.getElementById("stepnav-mount");
    if (mount) mount.appendChild(bar);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  window.urosStepNav = build;
})();
