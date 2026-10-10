# 6.0.0 rollback anchor and session boundary

Remote main was read-only verified on 2026-10-08 at `86b6a0cefb2c5e420c9c862a7897705e1ea59146` (accepted 5.0.0 activation, PR #79). `git ls-remote origin HEAD refs/heads/main refs/heads/release/6.0.0 refs/tags/v5.0.0` returned this HEAD/main and no release branch or v5.0.0 tag.

The exact commit is the rollback anchor; no tag is fabricated. This session uses an isolated worktree on `release/6.0.0` from that commit. Main is untouched. Scope is M0 discovery and M1 design only. No deployment, version bump, production UI change or external agent/protocol change is authorized in this session.

A rollback deployment or promotion procedure belongs to M9 and has not been executed. Existing source/preview evidence is not live server certification.
