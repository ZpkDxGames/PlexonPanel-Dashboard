from pathlib import Path

p = Path("scripts/apply-3.0.2-reliability.py")
text = p.read_text()
marker = "# Protocol documentation and release notes."
if marker not in text:
    raise SystemExit("missing patcher tail marker")
prefix = text.split(marker, 1)[0]
tail = '''# Protocol documentation.\np = Path("docs/PROTOCOL.md")\ndocs = p.read_text().replace(\n    "Product/bundle version 3.0.1, wire version 3.",\n    "Product/bundle version 3.0.2, wire version 3.",\n    1,\n)\nnote = """\n## 3.0.2 post-authentication reliability\n\nAfter envelope, server, signature, session/replay, type and body validation succeeds, the agent packet is accepted. Dashboard fan-out, peer-agent delivery, Durable Object notifications and other post-authentication side effects are failure-isolated. A stale or broken destination may be discarded, but that failure cannot retroactively turn a valid sender packet into protocol corruption.\n\nHost `access.sync` remains removal-only. Safe stale or divergent Host snapshots are ignored and diagnosed without disconnecting the authenticated Host; malformed, replayed or tampered traffic still fails closed.\n"""\nif "## 3.0.2 post-authentication reliability" not in docs:\n    docs += note\np.write_text(docs)\n'''
p.write_text(prefix + tail)
