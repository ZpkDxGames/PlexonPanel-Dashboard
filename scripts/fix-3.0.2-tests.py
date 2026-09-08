from pathlib import Path

p = Path("relay/src/index.ts")
text = p.read_text()
old = '''  if (\n    /event not allowed|presence|save lease|host backups disabled|only paper reports/i.test(\n      message,\n    )\n  )\n    return "INVALID_EVENT";'''
new = '''  if (\n    /event not allowed|presence|save lease|host backups disabled|only paper reports|invalid name|invalid eventId|invalid sessionId|invalid uuid|invalid observedAt|invalid sessionStartedAt|invalid sessionEndedAt|invalid persistence state/i.test(\n      message,\n    )\n  )\n    return "INVALID_EVENT";'''
if old not in text:
    raise SystemExit("missing INVALID_EVENT classifier anchor")
p.write_text(text.replace(old, new, 1))

p = Path("relay/tests/worker.test.mjs")
text = p.read_text()
if "version: \"2.2.0\"" not in text:
    raise SystemExit("missing old relay health version expectation")
p.write_text(text.replace('version: "2.2.0"', 'version: "3.0.2"', 1))
