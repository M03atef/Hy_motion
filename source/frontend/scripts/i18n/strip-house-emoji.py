# -*- coding: utf-8 -*-
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "apps" / "web" / "src" / "app"
HOUSE = "\U0001f3e0"
DASH = '<span data-en="Dashboard" data-ar="لوحة التحكم">Dashboard</span>'
DASH_A = '<a href="/dashboard/" data-en="Dashboard" data-ar="لوحة التحكم">Dashboard</a>'

n = 0
for f in list(ROOT.rglob("*.html")) + list(ROOT.rglob("*.js")):
    t = f.read_text(encoding="utf-8")
    if HOUSE not in t:
        continue
    nt = t.replace(f'<span>{HOUSE}</span><span class="sep">/</span>', DASH + '<span class="sep">/</span>')
    nt = nt.replace(f'<a href="/dashboard/">{HOUSE}</a>', DASH_A)
    nt = nt.replace(f"<span>{HOUSE}</span>", DASH)
    nt = nt.replace(HOUSE, "")
    if nt != t:
        f.write_text(nt, encoding="utf-8")
        print("updated", f.relative_to(ROOT.parents[3]))
        n += 1
print("done", n)
