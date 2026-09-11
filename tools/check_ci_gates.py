"""Check CI gate identity; only the two explicitly named Gate 1 steps may share it."""
from collections import Counter
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PYTHON_STEPS = {
    "Gate 1 — pytest (golden + contract + headless + schema)",
    "Gate 1 — min_example smoke",
}


def errors(source):
    names = re.findall(r'^\s*- name:\s*["\']?(Gate \d+(?:\.\d+)?[^\r\n]*?)\s*$', source, re.M)
    names = [name.rstrip('"\'') for name in names]
    counts = Counter(re.match(r"Gate (\d+(?:\.\d+)?)", name)[1] for name in names)
    problems = [f"duplicate Gate {gate}" for gate, count in counts.items() if count > 1 and gate != "1"]
    ones = [name for name in names if re.match(r"Gate 1(?:\s|$)", name)]
    if len(ones) != 2 or set(ones) != PYTHON_STEPS:
        problems.append("Gate 1 must contain exactly the two documented Python checks")
    if not names:
        problems.append("no gates found")
    return problems


def self_test():
    base = "\n".join(f'      - name: "{name}"' for name in sorted(PYTHON_STEPS))
    assert not errors(base + '\n- name: "Gate 19 — browser"\n- name: "Gate 21 — security"')
    assert errors(base + '\n- name: "Gate 19 — browser"\n- name: "Gate 19 — security"')
    assert errors(base + '\n- name: "Gate 1 — unexpected"')
    assert errors('name: CI')


if __name__ == "__main__":
    self_test()
    problems = errors((ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8"))
    if problems:
        raise SystemExit("\n".join(problems))
    print("PASS: CI gate identities and guard self-tests")
