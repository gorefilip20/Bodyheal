const esc = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const usd = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value) || 0);
const statusText = { payment_pending: "Payment details ready", waiting_confirmation: "Waiting for Confirmation", successful: "Payment Successful", needs_review: "Needs Review" };

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function setupAdmin() {
  const root = document.querySelector("#admin-app");
  root.innerHTML = `<main class="admin-shell"><a class="admin-back" href="/">← BODYHEALING</a><p class="eyebrow"><span class="eyebrow-dot"></span>PRIVATE OPERATIONS</p><h1 id="admin-title">Admin <em>sign in.</em></h1><p class="admin-intro" id="admin-intro">Sign in to review bookings and payment proofs.</p><div id="admin-message" role="status" aria-live="polite">Enter your administrator passcode to continue.</div><section id="admin-login"><form id="admin-login-form"><label for="admin-passcode">Admin Passcode</label><input id="admin-passcode" type="password" autocomplete="current-password" required><button class="button button-dark" type="submit">Sign in to Admin <span aria-hidden="true"></span></button></form></section><section id="admin-dashboard" hidden><div class="admin-metrics" aria-label="Booking summary"><article><span>Total Bookings</span><strong id="metric-total">0</strong></article><article><span>Waiting for Confirmation</span><strong id="metric-waiting">0</strong></article><article><span>Confirmed Revenue</span><strong id="metric-revenue">$0</strong></article></div><div class="admin-dashboard-top"><p id="admin-count"></p><button class="button button-outline" id="admin-refresh" type="button">Refresh</button><button class="button button-outline" id="admin-logout" type="button">Sign out</button></div><div id="admin-bookings" class="admin-bookings"></div></section></main>`;
  const message = document.querySelector("#admin-message");
  const login = document.querySelector("#admin-login");
  const dashboard = document.querySelector("#admin-dashboard");
  const passcodeInput = document.querySelector("#admin-passcode");
  const title = document.querySelector("#admin-title");
  const intro = document.querySelector("#admin-intro");

  function renderBookings(data) {
    const bookings = Array.isArray(data?.bookings) ? data.bookings : [];
    document.querySelector("#metric-total").textContent = String(bookings.length);
    document.querySelector("#metric-waiting").textContent = String(bookings.filter((item) => item?.status === "waiting_confirmation").length);
    document.querySelector("#metric-revenue").textContent = usd(bookings.filter((item) => item?.status === "successful").reduce((sum, item) => sum + (Number(item?.amount) || 0), 0));
    document.querySelector("#admin-count").textContent = `${bookings.length} ${bookings.length === 1 ? "booking" : "bookings"}`;
    document.querySelector("#admin-bookings").innerHTML = bookings.length ? bookings.map((booking) => `<article class="admin-booking"><header><div><span class="booking-ref">${esc(booking.bookingRef)}</span><span class="admin-status ${esc(booking.status)}">${esc(statusText[booking.status] || booking.status || "Unknown status")}</span></div><span>${esc(booking.createdAt ? new Date(booking.createdAt).toLocaleString() : "")}</span></header><div class="admin-booking-grid"><div><small>Client</small><strong>${esc(booking.name)}</strong><a href="tel:${esc(booking.phone)}">${esc(booking.phone)}</a>${booking.email ? `<a href="mailto:${esc(booking.email)}">${esc(booking.email)}</a>` : ""}</div><div><small>Package / amount</small><strong>${esc(booking.service)}</strong><span>${usd(booking.amount)} USD · ${usd(booking.amount)} USDT</span>${booking.appointmentAt ? `<span>Appointment: ${esc(String(booking.appointmentAt).replace("T", " "))}</span>` : ""}${booking.rescheduleStatus === "requested" ? `<span class="admin-reschedule-badge">Reschedule Requested · ${esc(String(booking.rescheduleRequestedFor).replace("T", " "))}</span>` : booking.rescheduleStatus && booking.rescheduleStatus !== "none" ? `<span>Reschedule ${esc(booking.rescheduleStatus)}</span>` : ""}</div>${booking.destination ? `<div><small>Travel plan</small><strong>${esc(booking.destination)}</strong><span>${esc(booking.travelDates)}</span></div>` : ""}<div><small>Transaction hash</small><span class="txid">${esc(booking.txid || "Not supplied")}</span></div>${booking.note ? `<div><small>Client note</small><span>${esc(booking.note)}</span></div>` : ""}${booking.proofUrl ? `<div><small>Payment screenshot</small><a class="proof-link" href="${esc(booking.proofUrl)}" target="_blank" rel="noopener noreferrer"><img src="${esc(booking.proofUrl)}" alt="Payment proof for ${esc(booking.bookingRef)}"><span>Open full-size proof </span></a></div>` : ""}</div>${booking.rescheduleStatus === "requested" ? `<div class="admin-actions"><button class="button button-dark" data-reschedule="approve" data-ref="${esc(booking.bookingRef)}">Approve Reschedule</button><button class="button button-outline" data-reschedule="decline" data-ref="${esc(booking.bookingRef)}">Decline Reschedule</button></div>` : ""}<div class="admin-actions"><button class="button button-dark" data-status="successful" data-ref="${esc(booking.bookingRef)}" ${booking.status === "successful" ? "disabled" : ""}>Mark as Successful</button><button class="button button-outline" data-status="needs_review" data-ref="${esc(booking.bookingRef)}">Reject / Needs Review</button></div></article>`).join("") : `<p class="admin-empty">No bookings or payment proofs submitted yet</p>`;
  }

  async function loadBookings() {
    message.textContent = "Loading payment records…";
    try {
      const data = await api("/api/admin/bookings");
      renderBookings(data);
      login.hidden = true;
      dashboard.hidden = false;
      title.innerHTML = `Payment <em>review.</em>`;
      intro.textContent = "Verify each transfer independently on BNB Smart Chain before confirming a booking.";
      message.textContent = "Status updates are manual. Approve only after independent on-chain verification.";
    } catch (error) {
      dashboard.hidden = true;
      login.hidden = false;
      if (error.message.includes("Admin sign-in")) message.textContent = "Enter your administrator passcode to continue.";
      else message.textContent = error.message;
    }
  }

  document.querySelector("#admin-login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    message.textContent = "Checking passcode…";
    try {
      await api("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: passcodeInput.value }) });
      passcodeInput.value = "";
      await loadBookings();
    } catch (error) { message.textContent = error.message; }
    finally { button.disabled = false; }
  });
  document.querySelector("#admin-refresh").addEventListener("click", loadBookings);
  document.querySelector("#admin-logout").addEventListener("click", async () => {
    try { await api("/api/admin/logout", { method: "POST" }); } catch {}
    dashboard.hidden = true;
    login.hidden = false;
    title.innerHTML = `Admin <em>sign in.</em>`;
    intro.textContent = "Sign in to review bookings and payment proofs.";
    message.textContent = "You are signed out.";
  });
  document.querySelector("#admin-bookings").addEventListener("click", async (event) => {
    const rescheduleButton = event.target.closest("button[data-reschedule]");
    if (rescheduleButton) {
      rescheduleButton.disabled = true;
      try {
        await api(`/api/admin/bookings/${encodeURIComponent(rescheduleButton.dataset.ref)}/reschedule`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: rescheduleButton.dataset.reschedule }) });
        await loadBookings();
      } catch (error) { message.textContent = error.message; rescheduleButton.disabled = false; }
      return;
    }
    const button = event.target.closest("button[data-status]");
    if (!button) return;
    if (button.dataset.status === "successful" && !window.confirm("Confirm only after independently verifying the BNB Smart Chain transfer on-chain. Mark this booking successful?")) return;
    button.disabled = true;
    try {
      await api(`/api/admin/bookings/${encodeURIComponent(button.dataset.ref)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: button.dataset.status }) });
      await loadBookings();
    } catch (error) { message.textContent = error.message; button.disabled = false; }
  });
  // Existing sessions reveal the dashboard only after the server validates the cookie.
  loadBookings();
}
