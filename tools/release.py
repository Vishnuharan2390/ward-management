#!/usr/bin/env python3
"""Bump the app version everywhere it matters.

    python3 tools/release.py 26 "2 Nov"

Updates the label in the title bar, the ?v= on every local script and
stylesheet (so browsers never mix old and new files) and the offline-cache
name in sw.js.
"""
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
v, label = sys.argv[1], sys.argv[2]

index = root / 'index.html'
s = index.read_text()
s = re.sub(r'v\d+ · [^<]+</span>', f'v{v} · {label}</span>', s)
s = re.sub(r'(src|href)="((?:js|css)/[^"?]+|config\.js)(\?v=\d+)?"', lambda m: f'{m.group(1)}="{m.group(2)}?v={v}"', s)
index.write_text(s)

sw = root / 'sw.js'
sw.write_text(re.sub(r"const VERSION = 'v\d+';", f"const VERSION = 'v{v}';", sw.read_text()))
print(f'v{v} · {label}')
