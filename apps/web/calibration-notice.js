/* Presentation metadata only. Historic snapshots are not retroactively calibrated. */
(function () {
  "use strict";
  function mount() {
    var data = self.UROSCalibration;
    if (!data || document.getElementById("calibration-notice")) return;
    var notice = document.createElement("details");
    notice.id = "calibration-notice"; notice.className = "data-notice";
    var summary = document.createElement("summary");
    summary.textContent = data.label + " · 判定僅供方向性比較";
    var text = document.createElement("p"); text.textContent = data.note;
    var history = document.createElement("p"); history.textContent = "此標示適用現行模型。匯入或歷史快照的校準狀態未經本介面另行驗證。";
    notice.append(summary, text, history);
    var before = document.getElementById("uros-shell") || document.getElementById("uros-stepnav");
    if (before) before.after(notice); else document.body.prepend(notice);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
