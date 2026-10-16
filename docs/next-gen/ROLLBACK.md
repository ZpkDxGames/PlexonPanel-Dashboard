# Rollback preparation

Known previous frontend source: `4357a66bc674fddce7432cbc27a4fead00ac8234` (Control Room, merged PR #90). Backend reference: `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`.

The feature branch contains isolated baseline, foundation and workspaces commits. Revert feature commits in reverse order, or build the immutable previous frontend ref in an independent worktree. Do not reset owner work or force-push main. Obtain owner authorization before a merge, production promotion or same-origin artifact rollback.

No browser-storage migration was introduced. Keep the frontend origin and IndexedDB pairing records. Never roll back by deleting credentials, wiping preferences, changing relay origins, or modifying Host audit/job/recovery state. No VPS, relay, backend, credential or provider change is part of this rollback.

The delivery archive includes a Git bundle, a source snapshot, production build, verification reports and screenshots. Use the Git bundle to recover feature history locally if remote publication is blocked.
