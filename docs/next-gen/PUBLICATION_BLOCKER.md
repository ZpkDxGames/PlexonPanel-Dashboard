# PR publication boundary

The owner approved publishing after reviewing the concrete branch-only no-deploy proposal. On 2026-10-16 the exact `proposals/NO_AUTODEPLOY.patch` was applied: `git.deploymentEnabled["design/strata-next-gen-20261016"] = false`. This is the sole authorized deployment-policy exception to AGENTS.md. It disables automatic Vercel deployments for this branch; main and every other branch retain their previous behavior. No deployment, merge or production action is authorized.

Before applying it, the checkout was clean at `9c3308e05227362502add498f7f3ac8c8b639999`. Fresh remote checks still matched frontend main `4357a66bc674fddce7432cbc27a4fead00ac8234` and read-only backend main `209f8b41d4fe6360a8dcf2f9cdabe7b7df6cc128`; the feature ref did not yet exist remotely. The only GitHub workflow triggers on main or explicit dispatch, with a main-only job condition. It is unchanged and will not be dispatched.

The original blocker was a successful Vercel check on main combined with 403 read access to the intended `zpkdxgames-projects/plexon-panel-dashboard` project. Project policy remains unverified through that API. Publication now uses the owner-approved repository guard, whose exact branch-only behavior is documented by Vercel. JSON, branch identity and the otherwise unchanged configuration are checked before pushing. The initial push must contain this guard; never push the unguarded product tip separately.

Publication is authorized for a **draft PR**. P7 remains blocked by the failed mixed-source steady timing gate and unavailable CPU-throttled mobile/CLS/native-zoom measurements. Owner review and production acceptance remain NOT_EXECUTED. The completed remote publication receipt will be recorded in DELIVERY_STATUS.md.

The previously delivered review archive is an immutable pre-publication snapshot at `9c3308e`; its source, bundle and publication status are historical. Product verification remains tied to `5ea142d`. This publication changes documentation and the exact guard only; it does not reinterpret old evidence as new measurements.

Reference checked 2026-10-16: [Vercel Git deployment configuration](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentEnabled).
