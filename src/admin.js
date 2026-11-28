const esc = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const usd = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const statusText = { payment_pending: "Payment Details Pending", waiting_confirmation: "Waiting for Confirmation", successful: "Payment Successful", needs_review: "Needs Review" };
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function setupAdmin() {
  const root = document.querySelector("#admin-app");
  root.innerHTML = `<main class="admin-shell"><a class="admin-back" href="/">← BODYHEALING</a><p class="eyebrow"><span class="eyebrow-dot"></span>PRIVATE OPERATIONS</p><h1>Payment <em>review.</em></h1><p class="admin-intro">Verify each transfer independently on BNB Smart Chain before confirming a booking.</p><div id="admin-message" role="status" aria-live="polite"></div><section id="admin-login"><form id="admin-login-form"><label for="admin-passcode">Admin passcode</label><input id="admin-passcode" type="password" autocomplete="current-password" required><button class="button button-dark" type="submit">Sign in <span aria-hidden="true">↗</span></button></form></section><section id="admin-dashboard" hidden><div class="admin-dashboard-top"><p id="admin-count"></p><button class="button button-outline" id="admin-refresh" type="button">Refresh</button><button class="button button-outline" id="admin-logout" type="button">Sign out</button></div><div id="admin-bookings" class="admin-bookings"></div></section></main>`;
  const message = document.querySelector("#admin-message");
  const login = document.querySelector("#admin-login");
  const dashboard = document.querySelector("#admin-dashboard");
  async function loadBookings() {
    message.textContent = "Loading payment records…";
    try {
      const data = await api("/api/admin/bookings");
      login.hidden = true; dashboard.hidden = false;
      document.querySelector("#admin-count").textContent = `${data.bookings.length} recent bookings`;
      document.querySelector("#admin-bookings").innerHTML = data.bookings.length ? data.bookings.map((booking) => `<article class="admin-booking"><header><div><span class="booking-ref">${esc(booking.bookingRef)}</span><span class="admin-status ${esc(booking.status)}">${esc(statusText[booking.status] || booking.status)}</span></div><span>${esc(new Date(booking.createdAt).toLocaleString())}</span></header><div class="admin-booking-grid"><div><small>Client</small><strong>${esc(booking.name)}</strong><a href="tel:${esc(booking.phone)}">${esc(booking.phone)}</a></div><div><small>Package / amount</small><strong>${esc(booking.service)}</strong><span>${usd(booking.amount)} USD · ${usd(booking.amount)} USDT</span></div>${booking.destination ? `<div><small>Travel plan</small><strong>${esc(booking.destination)}</strong><span>${esc(booking.travelDates)}</span></div>` : ""}<div><small>Transaction hash</small><span class="txid">${esc(booking.txid || "Not supplied")}</span></div>${booking.note ? `<div><small>Client note</small><span>${esc(booking.note)}</span></div>` : ""}${booking.proofUrl ? `<div><small>Payment screenshot</small><a class="proof-link" href="${esc(booking.proofUrl)}" target="_blank" rel="noopener noreferrer"><img src="${esc(booking.proofUrl)}" alt="Payment proof for ${esc(booking.bookingRef)}"><span>Open full-size proof ↗</span></a></div>` : ""}</div><div class="admin-actions"><button class="button button-dark" data-status="successful" data-ref="${esc(booking.bookingRef)}" ${booking.status === "successful" ? "disabled" : ""}>Mark as Successful</button><button class="button button-outline" data-status="needs_review" data-ref="${esc(booking.bookingRef)}">Reject / Needs Review</button></div></article>`).join("") : `<p class="admin-empty">No payment submissions yet.</p>`;
      message.textContent = "Status updates are manual. Approval should follow independent on-chain verification.";
    } catch (error) {
      if (error.message.includes("Admin sign-in")) { dashboard.hidden = true; login.hidden = false; }
      message.textContent = error.message;
    }
  }
  document.querySelector("#admin-login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button"); button.disabled = true;
    try { await api("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: document.querySelector("#admin-passcode").value }) }); document.querySelector("#admin-passcode").value = ""; await loadBookings(); }
    catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
  document.querySelector("#admin-refresh").addEventListener("click", loadBookings);
  document.querySelector("#admin-logout").addEventListener("click", async () => { await api("/api/admin/logout", { method: "POST" }); dashboard.hidden = true; login.hidden = false; message.textContent = "Signed out."; });
  document.querySelector("#admin-bookings").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-status]"); if (!button) return;
    if (button.dataset.status === "successful" && !window.confirm("Confirm only after independently verifying the BNB Smart Chain transfer on-chain. Mark this booking successful?")) return;
    button.disabled = true;
    try { await api(`/api/admin/bookings/${encodeURIComponent(button.dataset.ref)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: button.dataset.status }) }); await loadBookings(); }
    catch (error) { message.textContent = error.message; button.disabled = false; }
  });
  api("/api/admin/setup-status").then((status) => {
    const missing = [];
    if (!status.passcodeConfigured) missing.push("BODYHEAL_ADMIN_PASSCODE");
    if (!status.databaseConfigured) missing.push("DATABASE_URL");
    if (missing.length) message.textContent = `Admin setup incomplete: configure ${missing.join(" and ")} in the Hostinger Node.js app environment, then restart the app.`;
  }).catch((error) => { message.textContent = `Unable to check admin setup: ${error.message}`; });
  loadBookings();
}
