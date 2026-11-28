# TODO

- [x] **Core BODYHEALING site** — Reference-matched responsive layout; booking, contact, address, and business hours.
- [x] **Private & Global Travel Intensives** — Add four intensive cards, prices, treatment imagery, worldwide availability badge/copy, travel logistics note, header and footer navigation links, and responsive layouts.
- [x] **Intensive inquiry details** — Make all four reservation buttons open the existing inquiry dialog with the matching package selected; conditionally require destination city/country and preferred travel dates; include package, price, destination, and dates in the generated SMS request.
- [x] **GitHub delivery** — Commit and push production-ready changes directly to `main` at `https://github.com/gorefilip20/Bodyheal`.
- [ ] **BEP20 wallet card** — Configure USDT on BNB Smart Chain (BEP20) to receive at `0xF071f5f6D703dF16cE3715A912ef08791b783CDe`; show the exact quoted USD/USDT amount for each service or intensive, dynamically render a QR for the wallet, provide copy plus “Copied!” feedback, and display the permanent-loss network warning.
- [ ] **Payment proof** — Require at least one of a BNB Smart Chain TXID or JPG/PNG/WEBP screenshot; preview screenshot uploads immediately; submit payment proof for verification.
- [ ] **Persistent status tracking** — Persist booking references and payment details; show timestamp, package, amount, and TXID/screenshot summary while waiting; poll for admin decisions; support lookup by booking ID; show “Payment Successful — Booking Confirmed” only after approval.
- [ ] **Protected admin dashboard** — Add `/admin` login and payment queue with client details, service/intensive, travel location/dates where applicable, amount, TXID and clickable full-size screenshot; provide successful and needs-review/reject actions; keep the admin passcode protected server-side and document setup without committing its value.
- [ ] **Retain existing inquiry behavior** — Keep SMS inquiries separate and available; do not claim an SMS was sent or that blockchain transfers are verified automatically.
- [ ] **Validation and delivery** — Build, static checks, dependency audit, and appropriate browser/API checks; push finished changes to GitHub `main` and the managed project remote without force-pushing.
