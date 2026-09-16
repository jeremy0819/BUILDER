/* Presentation metadata only. Historic snapshots are not retroactively calibrated. */
(function () {
  "use strict";
  /* 與 browser-backup 共用同一條掛載鏈與同一種摘要文法（圓點＋標籤＋狀態字樣＋展開）。
     原本這份提示在 index.html 找不到 #uros-shell／#uros-stepnav，便落到 body 最前面——
     於是進站第一眼看到的是免責聲明，產品名還在它下面。兩條狀態列現在併成同一帶。

     顏色：沿用 warn 橘（它確實是在修飾判定的可信度），但以字級與粗細降階——
     大而粗的橘色留給 verdict，這裡只是一行小字加一條細邊。同色系表示「這句在講那個判定」，
     層級差表示「先看結論，再看但書」。 */
  function mount() {
    var data = self.UROSCalibration;
    if (!data || document.getElementById("calibration-notice")) return;
    var notice = document.createElement("details");
    notice.id = "calibration-notice"; notice.className = "data-notice";
    var summary = document.createElement("summary");
    summary.className = "calib-sum";
    var dot = document.createElement("span"); dot.className = "calib-dot"; dot.setAttribute("aria-hidden", "true");
    var name = document.createTextNode("判定可信度");
    var chip = document.createElement("span"); chip.className = "calib-chip";
    chip.textContent = data.label + "，僅供方向性比較";
    summary.append(dot, name, chip);
    var text = document.createElement("p"); text.textContent = data.note;
    var history = document.createElement("p"); history.textContent = "此標示適用現行模型。匯入或歷史快照的校準狀態未經本介面另行驗證。";
    notice.append(summary, text, history);
    /* 先跟備份列排在一起；取不到再退回外殼與導覽列。 */
    var anchor = document.getElementById("browser-backup") || document.getElementById("uros-shell")
      || document.getElementById("uros-stepnav") || document.querySelector(".top") || document.querySelector(".hero");
    if (anchor) anchor.after(notice); else document.body.prepend(notice);
    /* 落點驗證：一個看不見的免責聲明比放錯位置更糟。
       os-simulator 的 .hero 包在 .stage 裡，版面完成前高度為 0，
       掃進去就永遠不會被看到。量不到高度就改掂回最前面。 */
    requestAnimationFrame(function () {
      if (notice.getBoundingClientRect().height < 1) document.body.prepend(notice);
    });
  }
  /* 延後一拍：外殼（os-shell）與備份列都是 DOMContentLoaded 後才掂上去的，
     立即執行會抓不到它們，逐一退到更差的落點。 */
  function schedule() { setTimeout(mount, 0); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", schedule); else schedule();
})();
