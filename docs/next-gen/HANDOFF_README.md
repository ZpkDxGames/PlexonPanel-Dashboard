# PlexonPanel Strata — review handoff

Open REVIEW.html after extraction for the before/after browser gallery. Reports contain exact checks, source identities, parity, performance, limitations, publication boundary and rollback. All screenshots and operations are labeled local synthetic fixtures. No real pairing, provider, Host lifecycle, backend/VPS/relay or destructive action was used.

The delivered archive is the immutable pre-publication snapshot at review tip `9c3308e`, with a complete source snapshot, a feature-only Git bundle, a production build and raw evidence. Its publication blocker is historical: the owner later approved the exact branch-only no-deploy guard for draft-PR publication. Current remote status is in DELIVERY_STATUS.md. It is not a deployment and does not authorize production. The five-pair steady-input timing gate fails (49.54ms candidate versus 33.34ms baseline); P7 environment gates remain blocked in DELIVERY_STATUS.md.

To recover history, clone ZpkDxGames/PlexonPanel-Dashboard into a new independent directory. From that clone, verify `recovery/strata-feature.bundle`, fetch its exact feature ref, then switch to `design/strata-next-gen-20261016`. The bundle requires base 4357a66bc674fddce7432cbc27a4fead00ac8234, available in the repository's history. Verify the resulting HEAD against MANIFEST.json. Do not reset or overwrite an existing owner checkout.

Use Node 24 with the unchanged lockfile: npm ci, npm run check, npm run build. Install the pinned Firefox with npx playwright install firefox. Local fixture checks run through node scripts/qa-local.mjs followed by the script path. Fixture modules are absent from the production build and a fixture URL cannot bypass pairing.

The source snapshot is an independent fallback for file inspection. Its .git directory and node_modules are intentionally omitted; recover the Git bundle to preserve build identity/history. The production artifact identifies the actual product build commit, while the review tip may add evidence/documentation only.

MANIFEST.json and SHA256SUMS inventory every packaged byte except the checksum files themselves. Canonical results are separated from earlier diagnostics, incomplete/noisy performance trials and corrected test-harness assumptions. Unsupported measurements are not passes.

Do not merge, deploy, change credentials/configuration or perform live destructive tests from this handoff. Production and live acceptance require separate owner authorization.
