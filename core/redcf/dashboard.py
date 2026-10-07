"""Read-only historical projection; finance delegates to the existing Core chain."""
import calendar
import datetime as dt
import math

from ._version import CORE_VERSION
from .recompute import _analysis, input_hash, recompute
from .cashflow import 科目鍵

DASHBOARD_VERSION = "0.1.0"
METRICS = {
    "total_sales": ("全案總銷", "money"),
    "shared_cost": ("共同負擔", "money"),
    "owner_return_value": ("地主分回價值", "money"),
    "return_rate": ("全案投報率", "ratio"),
    "saleable_area": ("銷售坪數", "area"),
    "agreed": ("同意戶數", "count"),
    "funding_gap": ("資金缺口", "money"),
}


def _time(value):
    try:
        parsed = dt.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=dt.timezone(dt.timedelta(hours=8)))
        return parsed
    except (TypeError, ValueError):
        return None


def _finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _display(value, kind, signed=False):
    if not _finite(value):
        return "—"
    prefix = "+" if signed and value > 0 else ""
    if kind == "money":
        return prefix + (f"{value / 10000:,.2f} 億" if abs(value) >= 10000 else f"{value:,.1f} 萬")
    if kind == "ratio":
        return f"{prefix}{value * 100:.1f}" + (" pp" if signed else "%")
    return f"{prefix}{value:,.0f}" + (" 坪" if kind == "area" else " 戶")


def query_dashboard(points, metric="return_rate", start=None, end=None, period="all", today=None):
    """Replay only identified inputs; missing rows stay missing, never interpolated.

    Point time is the recorded snapshot/adoption/creation time, never replay time.
    Proposal creation points must be supplied in a separate scenario series.
    No persistence; no company profit or net funding-gap inference.
    """
    if metric not in METRICS or not isinstance(points, list) or len(points) > 4096:
        raise ValueError("Invalid dashboard query")
    now = dt.date.fromisoformat(today) if today else dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    last = dt.date.fromisoformat(end) if end else now
    if period in ("3m", "6m", "1y"):
        months = {"3m": 3, "6m": 6, "1y": 12}[period]
        y, m = divmod(last.year * 12 + last.month - 1 - months, 12)
        first = dt.date(y, m + 1, min(last.day, calendar.monthrange(y, m + 1)[1]))
    elif period in ("all", "custom"):
        first = dt.date.fromisoformat(start) if start else dt.date(1900, 1, 1)
    else:
        raise ValueError("Invalid period")
    if first > last:
        raise ValueError("開始日期不能晚於結束日期")
    rows = []
    seen = set()
    zone = dt.timezone(dt.timedelta(hours=8))
    for point in points:
        if not isinstance(point, dict):
            raise ValueError("Invalid dashboard point")
        if point.get("ts") is not None and not isinstance(point["ts"], str):
            raise ValueError("Dashboard timestamp must be a recorded string")
        identity = str(point.get("point_id", ""))
        if not identity or identity in seen:
            raise ValueError("Dashboard point IDs must be unique")
        seen.add(identity)
        timestamp = _time(point.get("ts"))
        if timestamp and not first <= timestamp.astimezone(zone).date() <= last:
            continue
        if len(rows) >= 256:
            raise ValueError("期間內歷史超過 256 筆，請縮小查詢期間")
        row = {"point_id": identity, "ts": timestamp.isoformat() if timestamp else point.get("ts"), "label": str(point.get("label", identity)),
               "source": str(point.get("source", "snapshot")), "source_id": str(point.get("source_id", identity)),
               "recorded_core_version": str(point.get("core_version", "")),
               "input_hash": str(point.get("input_hash", "")), "core_version": CORE_VERSION,
               "values": {key: None for key in METRICS}, "costs": {}, "error": None}
        engine = point.get("engine")
        if not timestamp:
            row["error"] = "日期未記錄，未放入時間圖"
        elif not isinstance(engine, dict) or not engine:
            row["error"] = "只有快照指紋，缺少完整輸入"
        else:
            try:
                if input_hash(engine) != row["input_hash"]:
                    raise ValueError("輸入指紋與現行正規化不符，無法安全重播")
                result = recompute(engine)
                _, _, _, finance = _analysis(engine)
                for key in ("total_sales", "shared_cost", "owner_return_value", "return_rate", "saleable_area"):
                    value = result.get(key)
                    row["values"][key] = value if _finite(value) else None
                row["costs"] = {key: finance[key] for key in 科目鍵 if _finite(finance.get(key))}
            except (KeyError, TypeError, ValueError, ZeroDivisionError) as error:
                row["error"] = str(error)[:120]
        if point.get("consent_source") == "recorded" and _finite(point.get("agreed")):
            row["values"]["agreed"] = point["agreed"]
        row["display"] = {key: _display(value, METRICS[key][1]) for key, value in row["values"].items()}
        row["cost_display"] = {key: _display(value, "money") for key, value in row["costs"].items()}
        rows.append(row)
    rows.sort(key=lambda row: ((_time(row["ts"]) or dt.datetime.min.replace(tzinfo=zone)), row["point_id"]))
    valid = [row for row in rows if _time(row["ts"])]
    if period == "all" and not start and valid:
        first = min(_time(row["ts"]).astimezone(zone).date() for row in valid)
    current = valid[-1] if valid else None
    previous = valid[-2] if len(valid) > 1 else None
    deltas = {}
    for key, (_, kind) in METRICS.items():
        a = previous["values"][key] if previous else None
        b = current["values"][key] if current else None
        delta = b - a if _finite(a) and _finite(b) else None
        deltas[key] = {"value": delta, "display": _display(delta, kind, True)}
    return {"schema_version": "dashboard-0.1", "dashboard_version": DASHBOARD_VERSION,
            "core_version": CORE_VERSION, "basis": "current-core-replay",
            "chart": {"x_field": "ts", "time_zone": "Asia/Taipei", "interpolation": "none",
                      "editable": False, "draggable": False,
                      "must_not_read_as": ["original-core-historical-results", "scenario-creation-is-adoption",
                                           "event-proximity-is-causality", "disbursement-is-funding-gap",
                                           "owner-return-is-developer-profit"]},
            "metric": metric, "range": {"start": first.isoformat(), "end": last.isoformat()},
            "points": rows, "current_id": current["point_id"] if current else None,
            "previous_id": previous["point_id"] if previous else None, "deltas": deltas}
