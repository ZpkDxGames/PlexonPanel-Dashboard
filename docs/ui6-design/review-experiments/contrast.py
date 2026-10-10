"""Recalculate from the canonical documentation tokens; never rewrite them."""
from pathlib import Path
import csv
import json
import re

root = Path(__file__).resolve().parents[1]
tokens = json.loads((root / 'tokens.json').read_text())
design = (root.parent / 'UI_6_DESIGN.md').read_text()
mapping = {'border-quiet':'borderQuiet','text-muted':'muted','status-ok':'ok',
           'status-warn':'warn','status-critical':'critical','status-info':'info',
           'status-unknown':'unknown','on-accent':'onAccent','monochrome':'mono'}
checked = 0
for line in design.splitlines():
    if not line.startswith('|'):
        continue
    cells = [x.strip() for x in line.split('|')[1:-1]]
    colors = [x for x in cells if x.startswith('#')]
    if not colors:
        continue
    assert len(colors) == 2 and all(re.fullmatch(r'#[0-9A-Fa-f]{6}', c) for c in colors), line
    key = mapping.get(cells[0], cells[0])
    assert colors == [tokens['light'][key], tokens['dark'][key]], line
    checked += 1
assert checked == 19, checked

def luminance(color):
    channels = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    linear = [c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4 for c in channels]
    return sum(c*w for c, w in zip(linear, (.2126, .7152, .0722)))

def ratio(a, b):
    low, high = sorted((luminance(a), luminance(b)))
    return (high+.05)/(low+.05)

rows = []
for theme, palette in tokens.items():
    for role in ['text','muted','ok','warn','critical','info','unknown','mono','cyan',
                 'violet','emerald','amber','lapis','copper','boundary','borderQuiet']:
        for background in ['canvas','surface','raised','sunken']:
            value = ratio(palette[role], palette[background])
            threshold = 3 if role == 'boundary' else 4.5
            rows.append(dict(theme=theme,foreground=role,background=background,
                             ratio=round(value,4),threshold=threshold,
                             required=role!='borderQuiet',passed=value>=threshold))
    for accent in ['mono','cyan','violet','emerald','amber','lapis','copper']:
        value = ratio(palette['onAccent'], palette[accent])
        rows.append(dict(theme=theme,foreground='onAccent',background=accent,
                         ratio=round(value,4),threshold=4.5,required=True,passed=value>=4.5))
assert all(r['passed'] for r in rows if r['required'])
result = dict(method='WCAG relative sRGB luminance, unrounded ratios used for threshold checks',
              opaquePairs=rows, requiredPassed=sum(r['required'] and r['passed'] for r in rows),
              decorativePairsFailing=sum(not r['required'] and not r['passed'] for r in rows),
              minimumTextRatio=min(r['ratio'] for r in rows if r['required'] and r['threshold']==4.5),
              minimumBoundaryRatio=min(r['ratio'] for r in rows if r['foreground']=='boundary'))
(root/'contrast-results.json').write_text(json.dumps(result,indent=2)+'\n')
with (root/'contrast-results.csv').open('w') as file:
    writer=csv.DictWriter(file,fieldnames=rows[0].keys());writer.writeheader();writer.writerows(rows)
print(json.dumps({**{k:v for k,v in result.items() if k!='opaquePairs'},'markdownTokenRowsMatched':checked}))
