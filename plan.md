# BODYHEALING BNB Smart Chain USDT payments

## Implementation and design

Extend the existing Vite/vanilla-JavaScript site with an Express API process, the project’s managed MySQL database, and durable project object storage for proof images. The API derives amounts from a server-side service catalog, creates booking references, validates transaction hashes and image content, and returns only a minimal public status view. Admin login uses the protected Webdev passcode secret and a signed, HttpOnly session cookie; payment approval is a manual admin decision, not an on-chain verification claim. Admin proof URLs are short-lived signed storage URLs, not public permanent file links. Existing SMS inquiry behavior remains available separately from payment.

The site’s established quiet editorial BODYHEALING visual system remains authoritative: warm paper surfaces, ink typography, sage accents, generous spacing, and compact accessible forms. Payment panels use the existing booking dialog; admin and status screens use the same palette and typography. Responsive layout prioritizes readable wallet instructions and controls on small screens.

## Main modules

- `src/main.js`: existing homepage, service selection and booking dialog.
- `src/payments.js`: client booking/payment/status interaction and QR display.
- `src/admin.js`: `/admin` login, review queue and manual approval/review actions.
- `server.js`: API, database schema, upload storage, signed sessions, production/static serving and Vite middleware in development.
- `Dockerfile`: production install/build/start contract.
- `README.md` and `TODO.md`: operations, secret setup, network limitations and explicit acceptance clauses.

The USDT amount displayed is the USD quote in USDT at a 1:1 nominal rate; all BSC transfers must still be checked manually by the business before approval. Bodywork Massage uses its $150 listed minimum. Database records persist in the managed project database, while proof objects are stored in managed object storage.
