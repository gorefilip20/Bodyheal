import QRCode from "qrcode";

const WALLET = "0xF071f5f6D703dF16cE3715A912ef08791b783CDe";
const SERVICE_AMOUNTS = { "Bodywork Massage": 150, "Buccal Massage": 150, "Gentle Touch": 140 };
const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const statusLabels = { payment_pending: "Payment details ready — submit proof to save your booking", waiting_confirmation: "Waiting for Confirmation", successful: "Payment Successful — Booking Confirmed", needs_review: "Needs Review — Please contact BODYHEALING" };
const money = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
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
  let booking = null;
  let pollTimer = null;

  const showStatus = (data) => {
    const statusBox = document.querySelector("#payment-status");
    statusBox.innerHTML = `<p class="payment-status-badge ${data.status === "successful" ? "is-success" : data.status === "needs_review" ? "is-review" : "is-waiting"}">${escapeText(statusLabels[data.status] || statusLabels.payment_pending)}</p>${data.bookingRef ? `<div class="booking-id-banner"><div><span>Booking ID</span><strong>${escapeText(data.bookingRef)}</strong></div><button class="button button-outline copy-booking-id" type="button" data-booking-id="${escapeText(data.bookingRef)}">Copy ID</button></div>` : ""}<dl class="payment-status-details"><div><dt>Package</dt><dd>${escapeText(data.service)}</dd></div><div><dt>Amount</dt><dd>${money(data.amount)} USD / ${money(data.amount)} USDT</dd></div>${data.destination ? `<div><dt>Destination</dt><dd>${escapeText(data.destination)}</dd></div>` : ""}${data.travelDates ? `<div><dt>Travel dates</dt><dd>${escapeText(data.travelDates)}</dd></div>` : ""}${data.updatedAt || data.createdAt ? `<div><dt>Updated</dt><dd>${escapeText(new Date(data.updatedAt || data.createdAt).toLocaleString())}</dd></div>` : ""}<div><dt>Submitted proof</dt><dd>${escapeText(data.txid ? `TXID ${data.txid.slice(0, 14)}…${data.txid.slice(-8)}` : data.proofSubmitted ? "Payment screenshot received" : "Not submitted yet")}</dd></div></dl>`;
    statusBox.hidden = false;
    statusBox.querySelector(".copy-booking-id")?.addEventListener("click", async (event) => { try { await navigator.clipboard.writeText(data.bookingRef); event.currentTarget.textContent = "Copied"; } catch { feedback.textContent = "Copy unavailable; select the Booking ID to copy it manually."; } });
    proofForm.hidden = data.status !== "payment_pending" && data.status !== "needs_review";
    if (data.status === "successful" || data.status === "needs_review") clearInterval(pollTimer);
  };
  const pollStatus = async (ref) => {
    try { const data = await client(`/api/bookings/${encodeURIComponent(ref)}/status`); showStatus(data); }
    catch (error) { feedback.textContent = `We couldn't refresh your booking status just now. ${error.message}`; }
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
    booking = { service, amount, name: form.get("name"), phone: form.get("phone"), destination: form.get("destination"), travelDates: form.get("travelDates"), note: form.get("note"), wallet: WALLET, network: "BNB Smart Chain (BEP20)", status: "payment_pending", saved: false };
    document.querySelector("#wallet-amount").textContent = `${money(amount)} USD / ${money(amount)} USDT`;
    document.querySelector("#wallet-address").textContent = WALLET;
    document.querySelector("#booking-reference").textContent = "Assigned when payment proof is submitted";
    const button = start;
    button.disabled = true;
    document.querySelector("#form-feedback").textContent = "Payment details are ready. Your booking will be saved when you submit a TXID or screenshot.";
    feedback.textContent = "Send only the exact USDT amount on BNB Smart Chain (BEP20), then submit a TXID or screenshot below.";
    try {
      await QRCode.toCanvas(document.querySelector("#wallet-qr"), WALLET, { width: 184, margin: 1, color: { dark: "#27342d", light: "#ffffff" } });
      checkout.hidden = false;
      showStatus(booking);
      checkout.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      feedback.textContent = `Payment details could not be displayed. Please try again. ${error.message}`;
    } finally { button.disabled = false; }
  });

  document.querySelector("#copy-wallet")?.addEventListener("click", async (event) => {
    try {
      await navigator.clipboard.writeText(WALLET);
      event.currentTarget.textContent = "Copied!";
      setTimeout(() => { event.currentTarget.textContent = "Copy Address"; }, 1800);
    } catch { feedback.textContent = "Copy unavailable; select and copy the wallet address manually."; }
  });
  photoInput?.addEventListener("change", () => {
    const file = photoInput.files?.[0];
    if (!file) { preview.hidden = true; preview.removeAttribute("src"); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      photoInput.value = ""; preview.hidden = true; feedback.textContent = "Choose a JPG, PNG, or WEBP image up to 5 MB."; return;
    }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });
  proofForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!booking) { feedback.textContent = "Continue to payment details first."; return; }
    const data = new FormData(proofForm);
    const txid = String(data.get("txid") || "").trim();
    if (!txid && !photoInput.files?.length) { feedback.textContent = "Submit either a transaction hash or a payment screenshot."; return; }
    const button = proofForm.querySelector("button[type=submit]");
    button.disabled = true;
    feedback.textContent = "Saving your booking and submitting payment proof…";
    try {
      if (!booking.saved) {
        const saved = await client("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: booking.service, name: booking.name, phone: booking.phone, destination: booking.destination, travelDates: booking.travelDates, note: booking.note }) });
        booking = { ...booking, ...saved, saved: true };
        document.querySelector("#booking-reference").textContent = booking.bookingRef;
      }
      const result = await client(`/api/bookings/${encodeURIComponent(booking.bookingRef)}/payment`, { method: "POST", body: data });
      showStatus(result);
      feedback.textContent = "Proof submitted. Your payment is awaiting manual verification.";
      clearInterval(pollTimer);
      pollTimer = setInterval(() => pollStatus(booking.bookingRef), 5000);
    } catch (error) {
      feedback.textContent = `We couldn't save your booking or proof. Your payment details are still here; please retry when your connection is available. ${error.message}`;
    } finally { button.disabled = false; }
  });

  document.querySelector("#booking-lookup-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const ref = document.querySelector("#lookup-reference").value.trim().toUpperCase();
    const box = document.querySelector("#lookup-result");
    box.textContent = "Checking status…";
    try {
      const result = await client(`/api/bookings/${encodeURIComponent(ref)}/status`);
      box.innerHTML = `<strong>${escapeText(statusLabels[result.status] || result.status)}</strong><br>${escapeText(result.bookingRef)} · ${escapeText(result.service)} · ${money(result.amount)} USDT<br>Last updated ${escapeText(new Date(result.updatedAt).toLocaleString())}`;
      if (result.status === "waiting_confirmation") setTimeout(() => document.querySelector("#booking-lookup-form").requestSubmit(), 5000);
    } catch (error) { box.textContent = error.message; }
  });
}
