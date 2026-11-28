import QRCode from "qrcode";

const WALLET = "0xF071f5f6D703dF16cE3715A912ef08791b783CDe";
const SERVICE_AMOUNTS = { "Bodywork Massage": 150, "Buccal Massage": 150, "Gentle Touch": 140 };
const ACTIVE_BOOKING_KEY = "bodyhealing.activeBookingRef";
const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const statusLabels = { payment_pending: "Payment details ready — submit proof to save your booking", waiting_confirmation: "Waiting for Confirmation", successful: "Payment Successful — Booking Confirmed", needs_review: "Needs Review — Please contact BODYHEALING" };
const money = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(amount) || 0);
const client = async (url, options = {}) => {
  const response = await fetch(url, { credentials: "same-origin", signal: AbortSignal.timeout(15000), ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data;
};

export function setupCryptoPayment() {
  const bookingForm = document.querySelector("#booking-form");
  if (!bookingForm) return;
  const checkout = document.querySelector("#crypto-checkout");
  const feedback = document.querySelector("#crypto-feedback");
  const proofForm = document.querySelector("#payment-proof-form");
  const photoInput = document.querySelector("#payment-screenshot");
  const preview = document.querySelector("#payment-preview");
  const start = document.querySelector("#crypto-pay-start");
  const localReceipt = document.querySelector("#active-booking-receipt");
  let booking = null;
  let pollTimer = null;
  let activeRef = null;

  const remember = (ref) => {
    if (!ref) return;
    activeRef = ref;
    try { localStorage.setItem(ACTIVE_BOOKING_KEY, ref); } catch { /* Storage may be unavailable; this session still polls. */ }
    document.querySelectorAll('input[name="bookingRef"]').forEach((input) => { input.value = ref; });
  };
  const receiptMarkup = (data) => `<p class="payment-status-badge ${data.status === "successful" ? "is-success" : data.status === "needs_review" ? "is-review" : "is-waiting"}">${escapeText(statusLabels[data.status] || statusLabels.payment_pending)}</p><div class="booking-id-banner"><div><span>Official Booking ID</span><strong>${escapeText(data.bookingRef)}</strong></div><button class="button button-outline copy-booking-id" type="button" data-booking-id="${escapeText(data.bookingRef)}">Copy ID</button></div><dl class="payment-status-details"><div><dt>Service / intensive</dt><dd>${escapeText(data.service)}</dd></div><div><dt>Amount</dt><dd>${money(data.amount)} USD / ${money(data.amount)} USDT</dd></div>${data.destination ? `<div><dt>Destination</dt><dd>${escapeText(data.destination)}</dd></div>` : ""}${data.travelDates ? `<div><dt>Travel dates</dt><dd>${escapeText(data.travelDates)}</dd></div>` : ""}${data.appointmentAt ? `<div><dt>Preferred Date &amp; Time</dt><dd>${escapeText(data.appointmentAt.replace("T", " "))}</dd></div>` : ""}${data.rescheduleStatus === "requested" ? `<div><dt>Reschedule status</dt><dd><span class="client-reschedule-badge">Reschedule Requested</span> · ${escapeText(data.rescheduleRequestedFor?.replace("T", " "))}</dd></div>` : data.rescheduleStatus && data.rescheduleStatus !== "none" ? `<div><dt>Reschedule status</dt><dd>${escapeText(data.rescheduleStatus)}</dd></div>` : ""}<div><dt>Last updated</dt><dd>${escapeText(new Date(data.updatedAt || data.createdAt || Date.now()).toLocaleString())}</dd></div></dl>`;
  const showStatus = (data) => {
    if (data.bookingRef) remember(data.bookingRef);
    const html = data.bookingRef ? receiptMarkup(data) : `<p class="payment-status-badge is-waiting">${escapeText(statusLabels[data.status] || statusLabels.payment_pending)}</p>`;
    const statusBox = document.querySelector("#payment-status");
    statusBox.innerHTML = html;
    statusBox.hidden = false;
    if (localReceipt && data.bookingRef) {
      localReceipt.innerHTML = `<div class="receipt-heading"><p class="eyebrow">YOUR BOOKING</p><h2>Booking <em>dashboard</em></h2></div>${receiptMarkup(data)}${data.status === "successful" ? (data.rescheduleStatus === "requested" ? `<p class="client-reschedule-badge">Reschedule Requested</p><p>Requested time: ${escapeText(data.rescheduleRequestedFor?.replace("T", " "))}</p>` : `<form class="client-reschedule-form"><h3>Request Reschedule</h3><label>New date<input name="date" type="date" required min="${new Date().toISOString().slice(0,10)}"></label><label>New time<input name="time" type="time" required></label><button class="button button-outline" type="submit">Send Reschedule Request</button><p class="reschedule-feedback" role="status" aria-live="polite"></p></form>`) : ""}`;
      localReceipt.hidden = false;
    }
    localReceipt?.querySelector(".client-reschedule-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const requested = `${form.elements.date.value}T${form.elements.time.value}`;
      const feedbackNode = form.querySelector(".reschedule-feedback");
      const button = form.querySelector("button"); button.disabled = true;
      try { const updated = await client(`/api/bookings/${encodeURIComponent(data.bookingRef)}/reschedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentAt: requested }) }); showStatus(updated); }
      catch (error) { feedbackNode.textContent = error.message; button.disabled = false; }
    });
    for (const button of document.querySelectorAll(".copy-booking-id")) {
      button.onclick = async (event) => { try { await navigator.clipboard.writeText(button.dataset.bookingId); button.textContent = "Copied"; } catch { (statusBox || localReceipt).querySelector(".booking-id-banner strong")?.focus?.(); } };
    }
    proofForm.hidden = data.status !== "payment_pending" && data.status !== "needs_review";
    if (data.status === "successful" || data.status === "needs_review") clearInterval(pollTimer);
  };
  const pollStatus = async (ref, quiet = false) => {
    try {
      const data = await client(`/api/bookings/${encodeURIComponent(ref)}`);
      showStatus(data);
      return data;
    } catch (error) {
      if (!quiet) feedback.textContent = `We couldn't refresh your booking status just now. ${error.message}`;
      return null;
    }
  };
  const startPolling = (ref) => {
    clearInterval(pollTimer);
    if (ref) pollTimer = setInterval(() => pollStatus(ref, true), 5000);
  };
  const formContainingResult = (resultBox) => resultBox?.parentElement?.querySelector(".booking-status-lookup");
  const lookup = async (ref, resultBox) => {
    resultBox.textContent = "Checking status…";
    try {
      const email = formContainingResult(resultBox)?.querySelector('input[name="email"]')?.value.trim();
      const result = email ? await client(`/api/bookings/${encodeURIComponent(ref)}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }) : await client(`/api/bookings/${encodeURIComponent(ref)}`);
      remember(result.bookingRef);
      showStatus(result);
      resultBox.textContent = `${statusLabels[result.status] || result.status} · ${result.bookingRef}`;
      if (result.status === "waiting_confirmation") startPolling(result.bookingRef);
      return result;
    } catch (error) { resultBox.textContent = error.message; return null; }
  };

  start?.addEventListener("click", async () => {
    if (!bookingForm.reportValidity()) {
      document.querySelector("#form-feedback").textContent = "Please complete the required booking and travel fields before continuing.";
      return;
    }
    const form = new FormData(bookingForm);
    const selected = bookingForm.querySelector("#service-choice").selectedOptions[0];
    const service = String(form.get("service") || "");
    const amount = Number(String(selected?.dataset.price || "").replace(/[^0-9.]/g, "")) || SERVICE_AMOUNTS[service];
    if (!amount) {
      document.querySelector("#form-feedback").textContent = "Please choose a valid service or intensive package.";
      return;
    }
    booking = { service, amount, name: form.get("name"), email: form.get("email"), phone: form.get("phone"), appointmentAt: `${form.get("appointmentDate")}T${form.get("appointmentTime")}`, destination: form.get("destination"), travelDates: form.get("travelDates"), note: form.get("note"), wallet: WALLET, network: "BNB Smart Chain (BEP20)", status: "payment_pending", saved: false };
    document.querySelector("#wallet-amount").textContent = `${money(amount)} USD / ${money(amount)} USDT`;
    document.querySelector("#wallet-address").textContent = WALLET;
    document.querySelector("#booking-reference").textContent = "Assigned when payment proof is submitted";
    start.disabled = true;
    document.querySelector("#form-feedback").textContent = "Payment details are ready. Your booking will be saved when you submit a TXID or screenshot.";
    feedback.textContent = "Send only the exact USDT amount on BNB Smart Chain (BEP20), then submit a TXID or screenshot below.";
    try {
      await QRCode.toCanvas(document.querySelector("#wallet-qr"), WALLET, { width: 184, margin: 1, color: { dark: "#27342d", light: "#ffffff" } });
      checkout.hidden = false;
      showStatus(booking);
      checkout.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { feedback.textContent = `Payment details could not be displayed. Please try again. ${error.message}`; }
    finally { start.disabled = false; }
  });

  document.querySelector("#copy-wallet")?.addEventListener("click", async (event) => {
    try { await navigator.clipboard.writeText(WALLET); event.currentTarget.textContent = "Copied!"; setTimeout(() => { event.currentTarget.textContent = "Copy Address"; }, 1800); }
    catch { feedback.textContent = "Copy unavailable; select and copy the wallet address manually."; }
  });
  photoInput?.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) { preview.hidden = true; preview.removeAttribute("src"); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) { photoInput.value = ""; preview.hidden = true; feedback.textContent = "Choose a JPG, PNG, or WEBP image up to 5 MB."; return; }
    preview.src = URL.createObjectURL(file); preview.hidden = false;
  });
  proofForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!booking) { feedback.textContent = "Continue to payment details first."; return; }
    const data = new FormData(proofForm);
    const txid = String(data.get("txid") || "").trim();
    if (!txid && !photoInput.files?.length) { feedback.textContent = "Submit either a transaction hash or a payment screenshot."; return; }
    const button = proofForm.querySelector("button[type=submit]");
    button.disabled = true; feedback.textContent = "Saving your booking and submitting payment proof…";
    try {
      if (!booking.saved) {
        const saved = await client("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: booking.service, name: booking.name, email: booking.email, phone: booking.phone, appointmentAt: booking.appointmentAt, destination: booking.destination, travelDates: booking.travelDates, note: booking.note }) });
        booking = { ...booking, ...saved, saved: true };
        document.querySelector("#booking-reference").textContent = booking.bookingRef;
      }
      await client(`/api/bookings/${encodeURIComponent(booking.bookingRef)}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: booking.email }) });
      const result = await client(`/api/bookings/${encodeURIComponent(booking.bookingRef)}/payment`, { method: "POST", body: data });
      remember(result.bookingRef); showStatus(result);
      feedback.textContent = "Proof submitted. Your payment is awaiting manual verification.";
      startPolling(result.bookingRef);
    } catch (error) { feedback.textContent = `We couldn't save your booking or proof. Your payment details are still here; please retry when your connection is available. ${error.message}`; }
    finally { button.disabled = false; }
  });

  for (const form of document.querySelectorAll(".booking-status-lookup")) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const ref = form.querySelector("input[name=bookingRef]").value.trim().toUpperCase();
      lookup(ref, form.parentElement.querySelector(".booking-lookup-result"));
    });
  }
  try {
    const savedRef = localStorage.getItem(ACTIVE_BOOKING_KEY)?.trim().toUpperCase();
    if (savedRef && /^BH-[A-F0-9]{8}$/.test(savedRef)) {
      const savedEmail = document.querySelector("#persistent-booking-email");
      if (savedEmail) savedEmail.required = false;
      lookup(savedRef, document.querySelector("#persistent-booking-status"));
    }
  } catch { /* Status lookup remains available by manually entering the booking ID. */ }
}
