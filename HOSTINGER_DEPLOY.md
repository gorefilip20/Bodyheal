# BODYHEALING — Hostinger production deployment

This repository is configured as one Express web app that serves the Vite site and `/api/*` routes from the same origin. Client API calls use relative `/api/...` paths. Payment screenshots are stored as private MySQL `LONGBLOB` data and are served only through the authenticated admin API; no Manus storage token, S3 key, or writable `/uploads` directory is needed.

## Hostinger app settings

Deploy the GitHub repository `https://github.com/gorefilip20/Bodyheal` on branch `main`, with the repository root (`/`) as the app root. Use these Node.js Web App values:

- Framework: **Express**
- Node.js: **22** (the package declares `22.x`)
- Package manager: **npm**
- Build command: **`npm run build`**
- Output directory: **leave blank** (this is an Express server app)
- Entry file: **`server.js`**
- Start command when a command field is shown: **`npm start`**

The `package.json` scripts are `"build": "vite build"` and `"start": "node server.js"`. Hostinger's Node app flow installs the dependencies, runs the selected build script, then starts/restarts the Node app. Select the repository's `main` branch; Git-connected deployment enables auto-deployment on pushes. If an existing Hostinger website already occupies `bodyheal.shop`, do not remove it until you have backed it up and are ready to replace that site slot.

## Required hPanel environment variables

In the app's **Environment variables** page (or the first-deploy environment-variable panel), set these values. Save/apply the values and then redeploy so the running Node process receives them.

```dotenv
NODE_ENV=production
BODYHEAL_ADMIN_PASSCODE=replace-with-a-long-unique-secret-at-least-16-characters
BODYHEAL_ADMIN_DEFAULT_PASSCODE=
DATABASE_URL=mysql://DB_USER:URL_ENCODED_PASSWORD@DB_HOST:3306/DB_NAME
CORS_ORIGINS=https://bodyheal.shop
VITE_BODYHEAL_CONTACT_EMAIL=concierge@bodyheal.shop
```

`BODYHEAL_ADMIN_PASSCODE` is the primary private passcode and must be at least 16 characters. If absent, the app accepts `BODYHEAL_ADMIN_DEFAULT_PASSCODE` when supplied. If both are absent, first startup creates and persists a cryptographically random fallback under `data/admin-passcode.json`, and prints it once to the Node app startup log so you can sign in and then set `BODYHEAL_ADMIN_PASSCODE` in hPanel. Treat that log value as a secret and set the primary variable promptly. Neither passcode is included in the browser bundle or committed. Do not add a fixed, publicly shared default password.

`DATABASE_URL` is optional. When set to a reachable MySQL server, that is the primary store; create a dedicated production database and user, grant permission to create/alter tables, and URL-encode reserved characters in the DSN. Do **not** reuse the Manus/Webdev `DATABASE_URL`, because it is not automatically reachable from Hostinger. The app creates `bodyheal_payments` on first API use. If `DATABASE_URL` is omitted or empty, the app automatically uses `data/bookings.json` and private screenshots in `data/uploads/`. Keep the app root writable and back up `data/`; confirm Hostinger retains this directory across redeploys, since local files are not a substitute for off-server backups.

If you do not have a reachable MySQL service, you may leave `DATABASE_URL` unset and use the local JSON/file fallback; for stronger durability, provision a MySQL-compatible database accessible to Hostinger and set its DSN. Providers may require TLS or source-IP permissions. Never put database credentials in the Git repository.

`VITE_BODYHEAL_CONTACT_EMAIL` is the public recipient used by the prefilled `mailto:` inquiry button. The official public inquiry recipient is `concierge@bodyheal.shop`. Set this value in the Hostinger build environment before building; Vite embeds it in the browser bundle. The address is public and is not a secret.

`CORS_ORIGINS` is a comma-separated exact-origin allowlist for a browser frontend hosted separately from this API. Because this deployment serves both the site and API at `https://bodyheal.shop`, same-origin requests need no CORS exception; the value above is safe for that origin and also makes the intended public origin explicit. Do not use `*` with credentialed admin requests. If the site is also served from `https://www.bodyheal.shop` or another separate origin, add that exact origin, comma-separated, only if it is actually in use. `PORT` is assigned by the Node hosting runtime; the server reads `process.env.PORT` and falls back to `3000` for local/container use, so do not pin a different port in hPanel.

No `MANUS_API_URL`, `MANUS_API_KEY`, or S3/object-storage variables are required. Screenshot uploads are limited to 5 MB and accepted only as JPG, PNG, or WEBP. The browser sends the image as multipart form data to the relative booking API; Express validates the image signature and saves the original binary in MySQL. The admin dashboard loads a full-size image from `/api/admin/bookings/:ref/proof`; that endpoint requires the signed admin session cookie and sends `Cache-Control: private, no-store`. Since proof images occupy database space, include the database in regular backups.

## Ensure Hostinger is running the Node.js app (not static-only hosting)

In hPanel, open the website’s **Node.js** application settings and confirm the application is deployed as a Node.js web app with the project root as its app root, `npm install`/`npm ci` dependencies installed, `npm run build` run during deployment, and `npm start` as the startup command. The start command launches `server.js`, which serves `dist/`, handles `/api/*`, and falls back to `dist/index.html` for `/admin` and other client-side routes. Set `PORT` only if Hostinger explicitly provides it; the server reads the platform-provided value. Redeploy/restart the Node app after changing environment variables.

Do not deploy only the contents of `dist/` as a static Website if bookings, payment proof, admin login, or status APIs are needed: static hosting cannot execute Express or `/api/*`. `public/.htaccess` is included as an Apache-compatible SPA fallback when Apache serves the built files, but it does not provide the Node APIs or admin data. Verify the app mode by opening `https://bodyheal.shop/api/health` and confirming a JSON response such as `{"status":"ok"}`, then open `https://bodyheal.shop/admin` directly. Use `/api/admin/setup-status` to check whether MySQL or the local-file fallback is active. Missing `DATABASE_URL` is supported; it does not block bookings. The admin passcode falls back to `BODYHEAL_ADMIN_DEFAULT_PASSCODE`, or a one-time generated secret printed to the first-start Node log and persisted in `data/admin-passcode.json`.

## Domain and HTTPS

In hPanel, attach `bodyheal.shop` to this Node.js web app and enable/issue SSL before launch. If DNS is managed at Hostinger, use hPanel's domain/website connection flow. If DNS stays at another registrar, copy the exact website IP shown in hPanel and point the apex (`@`) and, if desired, `www` A records to that IP. Hostinger assigns site-specific nameservers and IPs, so do not copy values from a tutorial or guess them. DNS propagation can take up to 24–48 hours. Preserve email-related MX/TXT records if changing nameservers. The current public domain is already serving a BODYHEAL page; verify the selected Hostinger site slot and take a backup before replacing it.

## Deploy and verify

1. Connect Hostinger's GitHub integration to `gorefilip20/Bodyheal` and deploy `main` with the app settings above. If this app already exists, review its connected repository/branch and use **Redeploy** after saving the environment variables.
2. Confirm the deployment log shows dependency installation, `npm run build`, and a successful app start. Check `https://bodyheal.shop/api/health` returns `{"status":"ok"}` and `/` and `/admin` load over HTTPS.
3. After setting the environment values, submit a disposable QA booking and image, verify the waiting state and admin-only image, test manual approval and public status lookup, then delete the QA row and screenshot from the production database. Never mark a real booking successful without independently verifying its BNB Smart Chain transfer on-chain.

## Official Hostinger references

- [Creating a Node.js App](https://docs.hostinger.com/node.js/creating-an-app) — GitHub onboarding, supported Node versions, build settings, and database wizard limits.
- [Build Settings](https://docs.hostinger.com/node.js/build-settings) — Node versions, root, build script, output directory, and entry file.
- [Environment Variables](https://docs.hostinger.com/node.js/environment-variables) — hPanel entry, saving, and redeployment behavior.
- [GitHub and GitLab deployments](https://docs.hostinger.com/node.js/git-deployments) — repository connection, auto-deployment, and Redeploy.
- [Connecting a Domain](https://docs.hostinger.com/getting-started/connecting-a-domain) — use hPanel's site-specific nameservers or the IP shown for that site; DNS propagation and SSL links.
