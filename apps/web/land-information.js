/* Local-first land administration view. No parcel data is sent to external services. */
(function (root) {
  "use strict";

  var SERVICES = [
    { id: "cadastral-map", label: "地籍圖資", note: "位置、地段與鄰近資訊", url: "https://easymap.land.moi.gov.tw/Index" },
    { id: "transcript", label: "電子謄本", note: "登記、地價、地籍圖謄本", url: "https://ep.land.nat.gov.tw/Home/SNWorkItem" },
    { id: "actual-price", label: "實價登錄", note: "交易、租賃與預售資訊", url: "https://lvr.land.moi.gov.tw/" },
    { id: "survey-map", label: "國土測繪圖資", note: "底圖與公開圖層", url: "https://maps.nlsc.gov.tw/" }
  ];

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function buildModel(rec) {
    var roster = (rec && rec.roster) || [], assets = (rec && rec.assets) || {};
    return {
      rows: roster.map(function (row) {
        return {
          parcel_id: row["土地編號"] != null ? row["土地編號"] : null,
          section: row["地段"] != null ? row["地段"] : null,
          lot_number: row["地號"] != null ? row["地號"] : null,
          building_number: row["地上建物建號"] != null ? row["地上建物建號"] : null,
          land_area_sqm: row["土地面積_㎡"] != null ? row["土地面積_㎡"] : null,
          owner_id: row["土地所有權人"] != null ? row["土地所有權人"] : null
        };
      }),
      attachments: {
        cadastral: !!assets.cadastral,
        zoning: !!assets.zoning,
        site_plan: !!assets.site_plan,
        street: !!assets.street
      },
      services: SERVICES
    };
  }
  function chip(label, ready) {
    return '<span class="uros-land-chip' + (ready ? " ready" : "") + '">' + esc(label) + "</span>";
  }
  function render(rec) {
    var model = buildModel(rec), rows = model.rows.slice(0, 3);
    var rowHtml = rows.length ? rows.map(function (row) {
      var location = [row.section, row.lot_number].filter(Boolean).join(" ") || "待補";
      return '<div class="uros-land-row"><b>' + esc(row.parcel_id || "—") + '</b><span>' + esc(location)
        + '</span><span>' + esc(row.building_number || "無建號") + '</span><span>'
        + esc(row.land_area_sqm == null ? "—" : row.land_area_sqm + " ㎡") + "</span></div>";
    }).join("") : '<div class="uros-land-row"><b>尚無清冊</b><span>可在下方新增，或由 Workspace 匯入</span><span>—</span><span>—</span></div>';
    var services = model.services.map(function (service) {
      return '<a class="uros-service" href="' + service.url + '" target="_blank" rel="noopener noreferrer"><span>'
        + esc(service.label) + '<br><small>' + esc(service.note) + '</small></span><b aria-hidden="true">↗</b></a>';
    }).join("");
    return '<section class="uros-land" id="land-information"><div class="uros-land-head"><div><h2>地政資訊</h2>'
      + '<p>案件清冊與圖件留在本機；官方入口不附帶案件參數。</p></div><div class="uros-land-status">'
      + chip("清冊 " + model.rows.length + " 筆", model.rows.length > 0)
      + chip(model.attachments.cadastral ? "地籍圖已附" : "待附地籍圖", model.attachments.cadastral)
      + chip(model.attachments.zoning ? "分區圖已附" : "待附分區圖", model.attachments.zoning)
      + '</div></div><div class="uros-land-body"><div class="uros-land-preview"><div class="uros-land-label">本機地籍事實</div>'
      + rowHtml + '<div style="margin-top:8px"><a href="#land-roster">查看與編輯完整清冊 ↓</a></div></div>'
      + '<div class="uros-land-services"><div class="uros-land-label">內政部與國土測繪官方服務</div><div class="uros-service-list">'
      + services + '</div></div></div><div class="uros-land-foot">外部服務僅開啟首頁；BUILDER 不自動傳送地段、地號、門牌、所有權人或附件。</div></section>';
  }

  var api = { SERVICES: SERVICES, buildModel: buildModel, render: render };
  root.LandInformation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : this);
