import QRCode from "qrcode";

const escapeText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const statusLabels = { payment_pending: "Payment not submitted", waiting_confirmation: "Waiting for Confirmation", successful: "Payment Successful — Booking Confirmed", needs_review: "Needs Review — Please contact BODYHEALING" };
const money = (amount) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount);
const client = async (url, options = {}) => {
  const response = await fetch(url, { credentials: "same-origin", ...options });
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
    document.querySelector("#payment-status").innerHTML = `<p class="payment-status-badge ${data.status === "successful" ? "is-success" : data.status === "needs_review" ? "is-review" : "is-waiting"}">${escapeText(statusLabels[data.status] || statusLabels.payment_pending)}</p><dl class="payment-status-details"><div><dt>Booking reference</dt><dd>${escapeText(data.bookingRef)}</dd></div><div><dt>Package</dt><dd>${escapeText(data.service)}</dd></div><div><dt>Amount</dt><dd>${money(data.amount)} USD / ${money(data.amount)} USDT</dd></div><div><dt>Updated</dt><dd>${escapeText(new Date(data.updatedAt || data.createdAt).toLocaleString())}</dd></div><div><dt>Submitted proof</dt><dd>${escapeText(data.txid ? `TXID ${data.txid.slice(0, 14)}…${data.txid.slice(-8)}` : data.proofSubmitted ? "Payment screenshot received" : "No proof submitted")}</dd></div></dl>`;
    document.querySelector("#payment-status").hidden = false;
    document.querySelector("#payment-proof-form").hidden = data.status !== "payment_pending" && data.status !== "needs_review";
    if (data.status === "successful" || data.status === "needs_review") clearInterval(pollTimer);
  };
  const pollStatus = async (ref) => {
    try { const data = await client(`/api/bookings/${encodeURIComponent(ref)}/status`); showStatus(data); }
    catch (error) { feedback.textContent = error.message; }
  };

  start?.addEventListener("click", async () => {
    if (!bookingForm.reportValidity()) return;
    const button = start;
    button.disabled = true;
    feedback.textContent = "Preparing your secure payment details…";
    try {
      const values = new FormData(bookingForm);
      booking = await client("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service: values.get("service"), name: values.get("name"), phone: values.get("phone"), destination: values.get("destination"), travelDates: values.get("travelDates"), note: values.get("note") }) });
      document.querySelector("#wallet-amount").textContent = `${money(booking.amount)} USD / ${money(booking.amount)} USDT`;
      document.querySelector("#wallet-address").textContent = booking.wallet;
      document.querySelector("#booking-reference").textContent = booking.bookingRef;
      await QRCode.toCanvas(document.querySelector("#wallet-qr"), booking.wallet, { width: 184, margin: 1, color: { dark: "#27342d", light: "#ffffff" } });
      checkout.hidden = false;
      feedback.textContent = "Booking created. Send only the exact USDT amount on BNB Smart Chain (BEP20), then submit your TXID or screenshot below.";
      showStatus(booking);
      checkout.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });

  document.querySelector("#copy-wallet")?.addEventListener("click", async (event) => {
    try {
      await navigator.clipboard.writeText(document.querySelector("#wallet-address").textContent);
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
    if (!booking) { feedback.textContent = "Create a booking first."; return; }
    const data = new FormData(proofForm);
    const txid = String(data.get("txid") || "").trim();
    if (!txid && !photoInput.files?.length) { feedback.textContent = "Submit either a transaction hash or a payment screenshot."; return; }
    const button = proofForm.querySelector("button[type=submit]");
    button.disabled = true;
    feedback.textContent = "Submitting payment proof securely…";
    try {
      const result = await client(`/api/bookings/${encodeURIComponent(booking.bookingRef)}/payment`, { method: "POST", body: data });
      showStatus(result);
      feedback.textContent = "Proof submitted. Your payment is awaiting manual verification.";
      pollTimer = setInterval(() => pollStatus(booking.bookingRef), 5000);
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
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
