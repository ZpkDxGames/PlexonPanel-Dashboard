# Dashboard 3.0.1 Vercel Deployment Addendum

Dashboard 3.0.1 does not change the relay protocol, Vercel application topology, device grants or Paper/Host signing model. This document records the deployment-specific changes for telemetry presentation and player heads.

## Required public relay setting

```dotenv
NEXT_PUBLIC_PLEXON_RELAY_URL=https://YOUR-RELAY.workers.dev
```

Use the same trusted production relay origin already configured for the protocol-3 deployment.

## Player-head provider

No Vercel variable is required for the normal 3.0.1 deployment. When `NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE` is unset or blank, Dashboard uses:

```text
https://mc-heads.net/avatar/{uuid}/{size}
```

To override the provider:

```dotenv
NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE=https://approved-avatar.example/avatar/{uuid}/{size}
```

To disable all remote player-head requests:

```dotenv
NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE=disabled
```

### Template requirements

Production validation is fail-closed:

- HTTPS only;
- exactly one `{uuid}` placeholder;
- at most one optional `{size}` placeholder;
- no URL credentials;
- no fragment;
- no unknown placeholders;
- one exact provider origin for CSP.

If a nonblank custom value fails validation, the dashboard does not broaden CSP or silently fall back to another remote custom provider. The local deterministic player fallback remains available.

Changing this `NEXT_PUBLIC_*` value requires a new Vercel build because it is a client-visible deployment setting.

## Privacy note

The selected remote avatar provider receives ordinary browser image requests and can therefore observe the viewer's network address and the UUIDs requested for current online players. Dashboard does not proxy or persist those images through the relay. Historical/offline player rows do not request remote avatars by default.

## Display update rate

No Vercel variable controls Display update rate. It is a per-browser preference stored by the dashboard UI. Multiple paired browsers can select different display rates without redeploying Vercel and without changing Paper, Host or relay telemetry cadence.

## Deployment procedure

1. Deploy or verify the compatible protocol-3 relay.
2. Deploy Dashboard 3.0.1 from the reviewed release/merge commit.
3. Confirm `NEXT_PUBLIC_PLEXON_RELAY_URL` resolves to the expected production relay.
4. Leave `NEXT_PUBLIC_PLEXON_PLAYER_HEAD_URL_TEMPLATE` unset/blank for built-in MCHeads, set a validated custom HTTPS template, or set `disabled`.
5. Confirm the generated CSP allows only the intended avatar origin when remote heads are enabled.
6. Pair using locally approved credentials; do not alter existing immutable grants merely for UI convenience.
7. Execute `docs/VALIDATION_3.0.1.md` against real Paper and Host agents before treating the deployment as accepted.

A Vercel deployment succeeding is not proof that live agent cadence, Host lifecycle behavior, third-party avatar behavior or the full viewport/zoom matrix has passed.
