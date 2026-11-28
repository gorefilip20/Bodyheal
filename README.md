# BODYHEALING
A responsive Scottsdale massage and bodywork website built with Vite, vanilla JavaScript, Express, and MySQL. The original reference photos, typefaces, and visual textures are stored under `public/`.

## Development
Requires Node.js and an enabled Webdev server/database. Configure `DATABASE_URL`, `MANUS_API_URL`, and `MANUS_API_KEY` through the managed runtime. Configure `BODYHEAL_ADMIN_PASSCODE` using Webdev's protected secret input; use a long, unique passphrase (24+ characters recommended). Never commit the passcode or place it in client-side configuration. The Webdev development and production environments share the managed database.

```sh
npm ci
npm run dev
```

## Production build and server
```sh
npm run build
npm start
```

The Express server serves the Vite build and `/api/*` endpoints. `/api/health` is the container readiness endpoint. The Dockerfile performs a clean install/build and runs the service on `PORT` (3000 by default). Booking/payment records use the managed MySQL database. Proof images are transferred to project object storage; only a short-lived signed URL is returned to an authenticated admin.

## USDT payment workflow
The displayed USDT figure is the dollar quote at a nominal 1 USD = 1 USDT. Bodywork Massage uses the listed $150 minimum. The wallet card is for USDT on BNB Smart Chain (BEP20) only. The QR encodes the receiving address; clients must verify the network and exact amount themselves. Submitting a TXID or image only creates a claim: it does not prove payment. An administrator must independently verify the transfer on-chain and manually mark it successful. No automatic blockchain monitoring or payment-provider settlement is implemented.

Bookings are created before a transfer, receive a `BH-...` reference, and can be checked in the payment panel. Clients can submit either a BNB Smart Chain transaction hash or a JPG/PNG/WEBP proof image (maximum 5 MB). Admin review is at `/admin`; actions are `Mark as Successful` and `Reject / Needs Review`. SMS inquiry remains available as a separate action and opens the visitor's messaging application; it is not sent by the server.

## Security and operations
Admin credentials and platform storage/database credentials must remain server-side. Admin sessions use signed HttpOnly cookies. Do not accept a screenshot or submitted hash as evidence of a confirmed transfer without independent verification. Payment status lookup intentionally reveals only reference, service, amount, timestamps, and submitted-proof summary. Uploaded proof is stored using a random object key; the authenticated dashboard receives temporary signed links.
