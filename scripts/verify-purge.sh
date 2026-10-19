#!/usr/bin/env bash
set -euo pipefail
command -v rg >/dev/null || { echo "ripgrep (rg) is required for the purge check" >&2; exit 1; }
BAN='gate-reason|kpi-grid|server-hero|overview-main|below-grid|hero-actions|min-height: ?250px|\.sidebar\b|\.topbar\b'
if rg -n "$BAN" src app -g '*.ts' -g '*.tsx' -g '*.css'; then echo 'FAIL: legacy structure found'; exit 1; fi
if rg -n "from ['\"](@/ui|\.\./ui|\.\./\.\./ui)" src/adapter src/presentation src/store src/lib; then echo 'FAIL: core imports UI'; exit 1; fi
if rg -n '(localStorage|sessionStorage|indexedDB)' src/ui/console src/ui/routes/Console.tsx; then echo 'FAIL: storage in console/chat'; exit 1; fi
echo 'purge OK'
