# Vercel deployment checklist

Use this checklist for the private PlexonPanel dashboard repository. Never add
Firebase service-account JSON files, `.env.vercel`, `.env.local`, pairing codes,
or generated session secrets to Git.

## 1. Prepare the Firebase Web App configuration

1. Open Firebase Console.
2. Select the PlexonPanel project.
3. Open **Project settings → General → Your apps**.
4. Register or select the dashboard Web App.
5. Choose the **Config** SDK snippet.
6. Create a temporary local `firebase-web-config.json` using
   `firebase-web-config.example.json` as the shape.

The six required Web App fields and optional Analytics measurement ID are
browser-visible identifiers. Database authorization must still be enforced with
Firebase Authentication, Security Rules, server-side membership checks, and App
Check.

## 2. Generate the Vercel import file locally

Keep the Firebase Admin service-account JSON outside the repository. From the
dashboard root, run:

```bash
npm run env:vercel -- \
  --service-account "/secure/path/firebase-adminsdk.json" \
  --web-config "/secure/path/firebase-web-config.json"
```

This creates `.env.vercel` with file mode `0600`, validates that both Firebase
files belong to the same project, and generates independent pairing and session
secrets. It does not print credential values.

Leave the gateway URL and audience unset until the production gateway exists.
When they are available, use the optional `--gateway-url` and
`--gateway-audience` arguments documented in `README.md`.

## 3. Connect the private GitHub repository to Vercel

1. Make `ZpkDxGames/PlexonPanel-Dashboard` private.
2. In Vercel, create or open the PlexonPanel Dashboard project.
3. Connect that exact GitHub repository.
4. Confirm that the Vercel GitHub App can read the private repository.
5. Keep **Framework Preset** set to **Next.js**.
6. Keep **Root Directory** at the repository root.
7. Keep **Build Command** at the detected `next build` default.
8. Leave **Output Directory** blank.
9. Use Node.js 22 or newer.

## 4. Import variables safely

1. Open **Vercel project → Settings → Environment Variables**.
2. Choose **Import .env** and select `.env.vercel`.
3. Apply public Firebase values to Preview and Production.
4. Apply server-only values to the environments that require authenticated
   server behavior.
5. Mark server-only values as Sensitive when the plan supports it.
6. Verify that none of the Admin or session variables starts with
   `NEXT_PUBLIC_`.
7. Delete the local `.env.vercel` and temporary Web config after confirming the
   Vercel values.

## 5. Deploy through a review branch

1. Push `agent/vercel-dashboard-refresh` to GitHub.
2. Vercel automatically creates a Preview deployment for the branch.
3. Check desktop and mobile layouts and `/api/system/status`.
4. Open a pull request into `main`.
5. Merge only after the clean build and preview review pass.
6. The merge to `main` creates the Production deployment.

Changing an environment variable only affects new deployments. Redeploy after
every environment-variable change.
