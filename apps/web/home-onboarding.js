/* Lucide 0.468.0 icon geometry: https://github.com/lucide-icons/lucide/tree/0.468.0/icons
 * ISC License
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as
 * part of Feather (MIT). All other copyright (c) are held by Lucide Contributors 2022.
 * Permission to use, copy, modify, and/or distribute this software for any purpose
 * with or without fee is hereby granted, provided that the above copyright notice
 * and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */
(function (root) {
  "use strict";
  var icons = {
    map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
    chart: '<path d="M12 16v5"/><path d="M16 14v7"/><path d="M20 10v11"/><path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15"/><path d="M4 18v3"/><path d="M8 14v7"/>',
    users: '<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>',
    signpost: '<path d="M12 13v8"/><path d="M12 3v3"/><path d="M18 6a2 2 0 0 1 1.387.56l2.307 2.22a1 1 0 0 1 0 1.44l-2.307 2.22A2 2 0 0 1 18 13H6a2 2 0 0 1-1.387-.56l-2.306-2.22a1 1 0 0 1 0-1.44l2.306-2.22A2 2 0 0 1 6 6z"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    folder: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>'
  };
  function icon(name) {
    if (!Object.prototype.hasOwnProperty.call(icons, name)) return "";
    return '<svg class="home-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + icons[name] + '</svg>';
  }
  function mountIcons(host) {
    host.querySelectorAll("[data-home-icon]").forEach(function (node) {
      node.innerHTML = icon(node.getAttribute("data-home-icon"));
    });
  }
  function model(options) {
    options = options || {};
    var phase = options.phase || "input", current = phase === "save" ? 3 : phase === "review" && options.computed ? 2 : 1;
    return {
      hidden: !!options.editing,
      current: current,
      steps: [
        {state: current === 1 ? "current" : "complete", text: current === 1 ? "編輯中" : "已填寫"},
        {state: !options.computed && current === 3 ? "skipped" : current === 2 ? "current" : current > 2 ? "complete" : "pending", text: !options.computed ? "尚未計算" : current === 2 ? "本次 Core 結果" : current > 2 ? "已檢視" : "待檢視"},
        {state: current === 3 ? "current" : "pending", text: current === 3 ? "正在儲存" : options.unavailable ? "可先儲存輸入" : "待確認"}
      ]
    };
  }
  function render(host, options) {
    var view = model(options);
    host.hidden = view.hidden;
    host.querySelectorAll("[data-entry-step]").forEach(function (node, i) {
      node.dataset.state = view.steps[i].state;
      if (i + 1 === view.current) node.setAttribute("aria-current", "step");
      else node.removeAttribute("aria-current");
      node.querySelector(".entry-step-status").textContent = view.steps[i].text;
    });
  }
  var api = {icon: icon, mountIcons: mountIcons, model: model, render: render};
  root.HomeOnboarding = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
