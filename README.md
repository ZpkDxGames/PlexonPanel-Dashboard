# PlexonPanel Dashboard

Private Next.js dashboard for monitoring and managing Paper servers connected through the PlexonPanel plugin.

The interface currently uses clearly labelled preview data. Authentication, pairing, realtime telemetry, and remote actions must not be described as live until their production services are connected and validated.

## Included interface

- TPS, MSPT, uptime, CPU, memory, and disk monitoring
- Player search, session details, and guarded moderation previews
- Searchable console output with error and warning filters
- PlexonChats global-channel interaction preview
- Plugin inventory, compatibility, and update states
- Server pairing, remote-policy, and audit-history previews
- Responsive desktop and mobile layouts

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The UI can run without Firebase values, but `/api/system/status` returns `503` until the three `FIREBASE_ADMIN_*` variables have valid-looking values.

## Validation

```bash
npm run lint
npm test
```

`npm test` performs a clean production build, starts that build locally, checks the dashboard HTML and security headers, and verifies the Firebase readiness response without returning credentials.

## Vercel deployment

1. Keep this repository private.
2. Import it as a standard Next.js project in Vercel. No custom framework preset, output directory, or build command is required.
3. Configure the public Firebase Web App values and gateway URL for each environment.
4. Store Firebase Admin fields, session secrets, pairing pepper, and gateway credentials as protected server-only environment variables.
5. Run the authenticated session and readiness tests before enabling real data.

The expected service boundaries, pairing flow, and Firestore model are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Never commit `.env.local`, Firebase service-account JSON files, private signing keys, pairing codes, or session secrets.
