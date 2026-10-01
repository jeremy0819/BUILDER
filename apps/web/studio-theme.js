/* Shared first-paint preference. No case data is read or written. */
(function () {
  "use strict";
  var theme = "dark";
  try { if (localStorage.getItem("uros.theme") === "light") theme = "light"; } catch (e) {}
  document.documentElement.setAttribute("data-theme", theme);
})();
