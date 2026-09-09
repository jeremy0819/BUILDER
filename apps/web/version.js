/* version.js — 前端版本徽章的單一來源（SSOT for display）。
   權威＝core/redcf/_version.py 的 CORE_VERSION；本檔由 Gate 10（tools/check_web_version.py）
   守衛，不一致即 CI 紅 → 杜絕「首頁 0.5.0 / 某頁 0.3.0」這類版本漂移。
   注意：頁面上標示「快照 core x.y.z」者屬**歷史溯源戳記**（那份快照當時是哪版算的），
   依可溯源原則不回填，與本檔的「目前版本」不是同一件事，兩者不得混為一談。 */
(function () {
  "use strict";
  var V = {
    core: "0.6.0",          // ← 對齊 core/redcf/_version.py（Gate 10 守衛）
    schema: "v2.1",
    release: "os-v0.6.0",   // ← 對齊 os-v0.6.0 release tag
    engine: "0.2.0",        // Decision Engine（core.redcf.decision.ENGINE_VERSION，Gate 10 守衛）
    strategy: "0.2.0"       // Strategy Engine（core.redcf.strategy.STRATEGY_ENGINE_VERSION，Gate 10 守衛）
  };
  window.UROS_VERSION = V;
  // 自動填入帶 data-uros-ver 的元素：<span data-uros-ver="core"></span>
  function stamp() {
    var els = document.querySelectorAll("[data-uros-ver]");
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute("data-uros-ver");
      if (V[k]) els[i].textContent = (els[i].getAttribute("data-uros-prefix") || "") + V[k];
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", stamp);
  else stamp();
  window.urosStampVersions = stamp;
})();
