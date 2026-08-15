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

## Create the Vercel environment file

The Firebase Admin service-account file does not contain the Firebase Web App configuration. Get the Web App configuration from **Firebase console → Project settings → General → Your apps → Web app**, then copy its six fields into a local file named `firebase-web-config.json` using [`firebase-web-config.example.json`](firebase-web-config.example.json) as the shape.

Keep the downloaded service-account JSON outside this project when possible. Generate the import file without passing any secret value on the command line:

```bash
npm run env:vercel -- \
  --service-account "/secure/path/firebase-adminsdk.json" \
  --web-config "/secure/path/firebase-web-config.json"
```

If the production gateway already exists, append its public URL and expected audience:

```bash
npm run env:vercel -- \
  --service-account "/secure/path/firebase-adminsdk.json" \
  --web-config "/secure/path/firebase-web-config.json" \
  --gateway-url "https://gateway.example.com" \
  --gateway-audience "plexonpanel-gateway"
```

The command validates that both Firebase files refer to the same project, creates fresh high-entropy pairing and session secrets, and writes `.env.vercel` with restrictive file permissions. It never prints credentials. Import `.env.vercel` in **Vercel project → Settings → Environment Variables → Import .env**, apply it to Production (and Preview only when needed), then delete the local import file after confirming the values exist in Vercel. Mark the server-only variables as Sensitive when your Vercel plan supports that option.

Do not upload `.env.vercel`, the service-account JSON, or `firebase-web-config.json` with the source. They are ignored by Git and by Vercel uploads.

## Vercel deployment

For a direct browser upload, use the provided ZIP as-is with [Vercel Drop](https://vercel.com/drop). Its archive root contains `package.json`, `app/`, and the rest of the Next.js project directly, so no Root Directory override is needed.

For Git or CLI deployment:

1. Keep the repository private and run deployment from the directory containing `package.json`.
2. Use the detected **Next.js** framework preset.
3. Leave **Root Directory** at the project root, **Build Command** at `next build`, and **Output Directory** blank.
4. Import the environment variables before the production deployment, or redeploy once after adding them.
5. Run the authenticated session and readiness tests before enabling real data.

Vercel Drop creates a new project for each upload. Connect a private Git repository or use the Vercel CLI when future deployments must keep the same project and production URL.

The expected service boundaries, pairing flow, and Firestore model are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Never commit `.env.local`, Firebase service-account JSON files, private signing keys, pairing codes, or session secrets.
