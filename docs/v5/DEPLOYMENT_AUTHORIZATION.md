# Main-branch deployment authorization

On 2026-10-17 the owner explicitly requested deployment and merging both repositories into main. This supersedes the earlier hold on merge and frontend deployment. Earlier local review/verification documents describe the pre-publication candidate and are not deployment receipts.

The dashboard release enables main in Vercel's Git integration while keeping the staging branch disabled. Next.js output is explicitly .next to override a retained Vite dist project setting. Only the allowlisted public relay URL is migrated into the build; the installed VITE_PLEXON_RELAY_URL remains accepted when NEXT_PUBLIC_PLEXON_RELAY_URL is absent. No credentials, relay origin, DNS or VPS configuration are changed by this source update.

Fresh main reads matched both original archive baselines. Publication uses new commits parented to those actual upstream heads; local archive snapshot history will not replace upstream history. The current deployment check passes TypeScript and71 unit/contract tests, and a production build using only the legacy public variable passes nonce/no-store response checks. Actual merge/build/deployment identities are recorded in the later deployment receipt.

Direct Vercel API access currently reports insufficient team scope and no CLI credential is present. The existing installed Git integration is the deployment path. VPS installation and live cold-backup execution require an available authorized VPS connection; none is provided in this workspace.
