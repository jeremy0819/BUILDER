# -*- coding: utf-8 -*-
"""
core/redcf/timeline.py — M7.2 Watchtower：Timeline（過去 ＋ 未來）與「今天要做什麼」
================================================================================
憲章＝docs/architecture/M7_CASE_OS_SPEC.md §6。

  過去（已有地基）          現在                未來（Watchtower）
  Activity / History   →  今天要做什麼   →   deadline / 法定期限 / 風險窗

**為什麼未來半邊是必要的**：一個沒有「未來」的工作空間是日誌，不是作業系統。
整合人每天打開最想看的是「今天要做什麼、什麼快到期」。

## 紀律（本模組的紅線）

1. **衍生視圖，不新增第三份資料**：Timeline 由 Activity＋History＋milestones 排序而成，
   本模組**不儲存任何東西**，只做排序與分類。
2. **只記事實與意圖，不記推論**（M7 鐵律）：本模組輸出的是「幾號到期／逾期幾天／
   是否在風險窗內」——皆為**日期算術**，不是 EV/verdict/IRR 那類推論。
3. **規則出處分級**：milestone 的 `source` 必填；`statute` 必附 `legal_basis`。
   **72hr 風險窗是 heuristic**（源自破局案觀察：重大節點前後最易生變），
   **不是法律規定**，允許被真實案例推翻——輸出一律標示 source，供使用者自行判斷可信度。
4. **不自動判定逾期的責任歸屬**：只陳述「已逾期 N 天」，不評價、不建議懲處。

## 為什麼放在 Core

Timeline 的分類規則（什麼叫逾期、什麼叫進入風險窗）是**領域規則**，
不可由各前端各自發明——否則同一個案子在不同頁面會顯示不同的「今天要做什麼」。
本模組不含財務公式，SSOT 不受影響。
"""
import datetime as _dt
import json
import pathlib

_此處 = pathlib.Path(__file__).resolve().parent
_根 = _此處.parents[1]
MILESTONE_SCHEMA_PATH = _根 / "schemas" / "milestone.schema.v0.1.json"
STATUTORY_PATH = _此處 / "statutory_deadlines.json"
TIMELINE_VERSION = "0.1.0"

# 風險窗預設（heuristic，非法律）——可被 config/真實案例推翻
DEFAULT_RISK_WINDOW_HR = 72

_URGENCY = ("overdue", "risk_window", "due_soon", "upcoming", "done", "waived")


def _d(x):
    """寬鬆解析日期字串 → date。無法解析回 None（不臆造）。"""
    if not x:
        return None
    if isinstance(x, _dt.date) and not isinstance(x, _dt.datetime):
        return x
    if isinstance(x, _dt.datetime):
        return x.date()
    s = str(x).strip().replace("/", "-")
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return _dt.datetime.strptime(s[:len(fmt) + 2] if "T" in fmt else s[:10], fmt).date()
        except ValueError:
            continue
    try:
        return _dt.date.fromisoformat(s[:10])
    except Exception:
        return None


def load_statutory_deadlines(path=None) -> dict:
    """載入法定期限庫。每筆必附 legal_basis；缺標示或缺法源即拒載（防止經驗值混入法規）。"""
    data = json.loads((pathlib.Path(path) if path else STATUTORY_PATH).read_text(encoding="utf-8"))
    if not data.get("_source_disclaimer"):
        raise ValueError("statutory_deadlines.json 缺 _source_disclaimer（法規會修正之標示不得移除）")
    for d in data.get("deadlines", []):
        if not d.get("legal_basis"):
            raise ValueError(f"法定期限缺法源引註：{d.get('key')}——本檔只收明確載於法條者")
        if not d.get("verification"):
            raise ValueError(f"法定期限缺 verification 查核狀態：{d.get('key')}")
    return data


def statutory_milestone(key: str, anchor_date, deadlines: dict = None,
                        milestone_id: str = None, risk_window_hr: int = None) -> dict:
    """由法定期限庫產生一筆 milestone（source=statute，自動帶入 legal_basis 與到期日）。

    anchor_date＝起算日（如：核定發布實施日、通知日）。到期日＝起算日 ＋ days。
    """
    dl = deadlines or load_statutory_deadlines()
    item = next((d for d in dl["deadlines"] if d["key"] == key), None)
    if item is None:
        raise ValueError(f"法定期限庫無此項：{key}")
    start = _d(anchor_date)
    if start is None:
        raise ValueError(f"起算日無法解析：{anchor_date!r}")
    due = start + _dt.timedelta(days=int(item["days"]))
    ms = {
        "milestone_id": milestone_id or f"ms-{key}",
        "title": item["title"], "due": due.isoformat(),
        "source": "statute", "legal_basis": item["legal_basis"],
        "status": "open",
    }
    if item.get("stage"):
        ms["stage"] = item["stage"]
    if risk_window_hr:
        ms["risk_window_hr"] = int(risk_window_hr)
    note = [f"起算：{item.get('anchor','')}（{start.isoformat()}）＋{item['days']}日"]
    if item.get("verification") != "verified":
        note.append("⚠ 法源引註待複核（verification=%s）" % item.get("verification"))
    ms["note"] = "；".join(note)
    return ms


def validate_milestones(docs: list) -> tuple:
    """對 milestone.schema.v0.1.json 驗證（含 statute 必附 legal_basis）。回傳 (ok, errors)。"""
    try:
        import jsonschema
    except ImportError:
        return (False, ["jsonschema 未安裝"])
    schema = json.loads(MILESTONE_SCHEMA_PATH.read_text(encoding="utf-8"))
    v = jsonschema.Draft7Validator(schema)
    errs = [f"{'/'.join(str(x) for x in e.path) or '(root)'}: {e.message}"
            for e in sorted(v.iter_errors(docs), key=lambda e: list(e.path))]
    return (len(errs) == 0, errs)


def classify_milestone(ms: dict, today=None, due_soon_days: int = 14) -> dict:
    """單一里程碑的時間分類（純日期算術，不含推論）。

    overdue      已逾期
    risk_window  在重大節點的高風險窗內（heuristic）
    due_soon     N 日內到期
    upcoming     尚未接近
    done/waived  已完成／經決定不辦
    """
    today = _d(today) or _dt.date.today()
    due = _d(ms.get("due"))
    st = ms.get("status", "open")
    out = {
        "milestone_id": ms.get("milestone_id"), "title": ms.get("title"),
        "due": ms.get("due"), "stage": ms.get("stage"),
        "source": ms.get("source"), "legal_basis": ms.get("legal_basis"),
        "days_remaining": None, "urgency": None,
        "in_risk_window": False, "risk_window_hr": ms.get("risk_window_hr"),
    }
    if st in ("done", "waived"):
        out["urgency"] = st
        return out
    if due is None:
        out["urgency"] = "upcoming"
        out["_note"] = "無有效到期日，無法分類（不臆造）"
        return out

    days = (due - today).days
    out["days_remaining"] = days
    win_hr = ms.get("risk_window_hr")
    win_days = (win_hr / 24.0) if win_hr else None

    if days < 0:
        out["urgency"] = "overdue"
        out["overdue_days"] = -days
    elif win_days is not None and days <= win_days:
        out["urgency"] = "risk_window"
        out["in_risk_window"] = True
        out["_risk_window_source"] = "heuristic"
        out["_risk_window_note"] = ("重大節點前後為高風險窗＝經驗啟發，非法律規定；"
                                    "允許被真實案例推翻。")
    elif days <= due_soon_days:
        out["urgency"] = "due_soon"
    else:
        out["urgency"] = "upcoming"
    return out


_ORDER = {"overdue": 0, "risk_window": 1, "due_soon": 2, "upcoming": 3, "done": 4, "waived": 5}


def build_today(milestones: list, today=None, due_soon_days: int = 14) -> dict:
    """「今天要做什麼」——整合人每天登入的第一眼。

    只回答：什麼逾期了、什麼在風險窗、什麼快到期。不評價、不建議懲處。
    """
    today_d = _d(today) or _dt.date.today()
    rows = [classify_milestone(m, today_d, due_soon_days) for m in (milestones or [])]
    rows.sort(key=lambda r: (_ORDER.get(r["urgency"], 9),
                             r["days_remaining"] if r["days_remaining"] is not None else 10**6,
                             str(r.get("milestone_id"))))
    by = {k: [r for r in rows if r["urgency"] == k] for k in _URGENCY}
    statute_n = sum(1 for r in rows if r.get("source") == "statute"
                    and r["urgency"] in ("overdue", "risk_window", "due_soon"))
    return {
        "timeline_version": TIMELINE_VERSION,
        "as_of": today_d.isoformat(),
        "action_required": by["overdue"] + by["risk_window"] + by["due_soon"],
        "counts": {k: len(v) for k, v in by.items()},
        "statute_pending": statute_n,
        "items": rows,
        "_note": ("本表為**衍生視圖**（由 milestones 排序而成），不新增資料、不含推論。"
                  "source 分級：statute 法定期限（附法源）／plan 自訂／heuristic 經驗啟發。"),
    }


def build_timeline(activity: list = None, history: list = None,
                   milestones: list = None, today=None) -> dict:
    """完整時間脈絡：過去（Activity/History）＋ 現在 ＋ 未來（milestones）。

    **衍生視圖**：三份既有資料排序合併，本函式不儲存、不改寫任何來源。
    """
    today_d = _d(today) or _dt.date.today()
    past = []
    for e in (activity or []):
        past.append({"kind": "activity", "ts": e.get("ts"),
                     "what": e.get("field") or e.get("kind"),
                     "before": e.get("before"), "after": e.get("after"),
                     "intent": e.get("intent"), "event_id": e.get("event_id") or e.get("key")})
    for h in (history or []):
        past.append({"kind": "snapshot", "ts": h.get("ts"),
                     "what": h.get("label") or h.get("snapshot_id"),
                     "input_hash": h.get("input_hash"),
                     "authoritative": h.get("authoritative")})
    past.sort(key=lambda r: str(r.get("ts") or ""))

    future = build_today(milestones, today_d)
    return {
        "timeline_version": TIMELINE_VERSION,
        "as_of": today_d.isoformat(),
        "past": past,
        "today": future["action_required"],
        "future": [r for r in future["items"] if r["urgency"] in ("due_soon", "upcoming")],
        "counts": future["counts"],
        "_note": "Timeline＝衍生視圖：Activity＋History＋milestones 排序而成，不新增第三份資料。",
    }
