# BODYHEALING

Responsive Scottsdale massage and bodywork website built with Vite, vanilla JavaScript, Express, and MySQL. Original reference photos, typefaces, and textures are under `public/`.

## Development

Requires Node.js 22 and a MySQL-compatible database. Set `DATABASE_URL` and `BODYHEAL_ADMIN_PASSCODE` as server-side environment variables; use a unique passcode with at least 16 characters (24+ recommended). Never commit credentials or expose them in browser code. The app creates its payment table and adds missing screenshot columns on first database use.

```sh
npm ci
npm run dev
```

## Production

```sh
npm ci
npm run build
npm start
```

The `build` script runs `vite build`. The `start` script runs `node server.js`; the server serves the production bundle from `dist/`, serves the `/api/*` endpoints, and listens on `PORT` (3000 by default). Hostinger-specific deployment steps and environment values are in [`HOSTINGER_DEPLOY.md`](HOSTINGER_DEPLOY.md).

## USDT payment workflow

The listed USDT figure is a USD-denominated quote using a nominal 1 USD = 1 USDT. Bodywork Massage uses the $150 minimum; other standard services and travel intensives use their listed prices. The wallet card is for USDT on BNB Smart Chain (BEP20) only. The QR encodes the receiving address. Clients must verify the network and exact amount themselves.

Bookings receive a unique `BH-...` reference and can be looked up in the payment panel. Clients can submit a BNB Smart Chain TXID, a JPG/PNG/WEBP screenshot up to 5 MB, or both. Proof images are validated and stored as binary MySQL data, then served only through an authenticated admin endpoint. An uploaded image or TXID is a claim, not proof of settlement. An administrator must independently verify the transfer on-chain before manually marking a booking successful. The app does not perform automatic blockchain monitoring or payment-provider settlement.

Admin review is at `/admin`, with `Mark as Successful` and `Reject / Needs Review` actions. SMS inquiry remains separate and opens the visitor's messaging application; it is not sent by the server.

## Security and operations

Keep `BODYHEAL_ADMIN_PASSCODE`, `DATABASE_URL`, and any `CORS_ORIGINS` values server-side. Admin sessions use signed HttpOnly cookies. Cross-origin browser access is disabled except for same-origin traffic and exact origins explicitly listed in `CORS_ORIGINS`; do not use `*` with credentialed requests. Public status lookup returns only the booking reference, service, amount, timestamps, transaction hash, and whether proof was submitted. Uploaded payment screenshots remain private and should be covered by database backups.
