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
DATABASE_URL=mysql://DB_USER:URL_ENCODED_PASSWORD@DB_HOST:3306/DB_NAME
CORS_ORIGINS=https://bodyheal.shop
```

`BODYHEAL_ADMIN_PASSCODE` must be private, unique, and at least 16 characters; a randomly generated 24+ character passphrase is recommended. Do not commit it or include it in any client-side variable.

`DATABASE_URL` must point to a MySQL server reachable from the Hostinger Node app. Create a dedicated production database and user in the database section provided by the hosting account, grant that user permission to create and alter tables, and use the exact hostname, port, database name, username, and password shown there. URL-encode reserved characters in the username/password before placing them in the URL. Do **not** reuse the Manus/Webdev `DATABASE_URL`: its managed database endpoint is not automatically available to Hostinger. The app creates `bodyheal_payments` on first API use and adds the proof columns if they are missing. Back up the database before any later schema changes.

Hostinger's currently published Node.js app database wizard documents Supabase and MongoDB Atlas rather than a generic MySQL connector. If your hPanel plan does not provide a MySQL database that this app can reach, provision a MySQL-compatible database accessible to Hostinger, then set its DSN as `DATABASE_URL`. The database provider may require TLS or source-IP permissions; use its connection details and allowlist requirements. Never put database credentials in the Git repository.

`CORS_ORIGINS` is a comma-separated exact-origin allowlist for a browser frontend hosted separately from this API. Because this deployment serves both the site and API at `https://bodyheal.shop`, same-origin requests need no CORS exception; the value above is safe for that origin and also makes the intended public origin explicit. Do not use `*` with credentialed admin requests. If the site is also served from `https://www.bodyheal.shop` or another separate origin, add that exact origin, comma-separated, only if it is actually in use. `PORT` is assigned by the Node hosting runtime; the server reads `process.env.PORT` and falls back to `3000` for local/container use, so do not pin a different port in hPanel.

No `MANUS_API_URL`, `MANUS_API_KEY`, or S3/object-storage variables are required. Screenshot uploads are limited to 5 MB and accepted only as JPG, PNG, or WEBP. The browser sends the image as multipart form data to the relative booking API; Express validates the image signature and saves the original binary in MySQL. The admin dashboard loads a full-size image from `/api/admin/bookings/:ref/proof`; that endpoint requires the signed admin session cookie and sends `Cache-Control: private, no-store`. Since proof images occupy database space, include the database in regular backups.

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
