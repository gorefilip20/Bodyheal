import { setupCryptoPayment } from "./payments.js";
import { setupAdmin } from "./admin.js";

if (window.location.pathname === "/admin") {
  document.querySelector("#app").innerHTML = `<div id="admin-app"></div>`;
  setupAdmin();
} else {
const services = [
  {
    name: "Bodywork Massage",
    price: "$150+",
    duration: "60+ min",
    image: "/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-1.webp",
    alt: "A therapist providing a relaxing back massage",
    description:
      "For men and women seeking focused relief or a slower, restorative session. Work may include deep tissue, trigger point, myofascial, Swedish techniques, or reflexology—selected together to support mobility, athletic recovery, and everyday ease.",
  },
  {
    name: "Buccal Massage",
    price: "$150",
    duration: "55 min",
    image: "/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-3.webp",
    alt: "A gentle facial massage focused on the jaw and cheeks",
    description:
      "A precise facial massage for anyone holding tension through the jaw and cheeks. With consent and gloved hands, the therapist works externally and inside the mouth to soften tight facial muscles. A quiet, considered treatment for comfort and facial relaxation.",
  },
  {
    name: "Gentle Touch",
    subtitle: "Oncology Massage",
    price: "$140",
    duration: "60 min",
    image: "/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-2.webp",
    alt: "Gentle massage for a client resting comfortably",
    description:
      "A gentle, adapted massage for people during or after cancer treatment. Each visit considers your energy, medical history, treatment effects, and boundaries. Available to clients of all genders, with comfort and communication guiding every choice.",
  },
];

const hours = [
  ["Monday", "10 am – 6:30 pm"],
  ["Tuesday", "10 am – 6:30 pm"],
  ["Wednesday", "9:30 am – 6 pm"],
  ["Thursday", "9:30 am – 6 pm"],
  ["Friday", "10 am – 6:30 pm"],
  ["Saturday", "9:30 am – 6 pm"],
  ["Sunday", "10 am – 6:30 pm"],
];

const intensives = [
  { name: "1 Day Private Intensive", price: "$5,000", image: "/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-1.webp", alt: "Private therapeutic bodywork in a calm treatment setting", imageClass: "intensive-photo-one" },
  { name: "Half Day Private Intensive", price: "$3,500", image: "/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-3.webp", alt: "A focused restorative facial massage session", imageClass: "intensive-photo-two" },
  { name: "Mini Intensive", price: "$1,750", image: "/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-4.webp", alt: "A quiet hands-on massage session", imageClass: "intensive-photo-three" },
  { name: "5 Day On-Site Intensive", price: "$25,000", image: "/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-2.webp", alt: "A personalized one-to-one massage experience", imageClass: "intensive-photo-four" },
];

const brand = `
  <svg class="brand-mark" viewBox="0 0 38 38" aria-hidden="true" focusable="false">
    <path d="M19 3c-2.2 8.2-6.1 12.2-12.8 13.4 6.7 1.2 10.6 5.2 12.8 13.4 2.2-8.2 6.1-12.2 12.8-13.4C25.1 15.2 21.2 11.2 19 3Z" fill="currentColor"/>
    <path d="M19 21c-1.1 4.7-3.4 7.8-7.2 9.3 3.8.7 6.1 2.5 7.2 5.7 1.1-3.2 3.4-5 7.2-5.7-3.8-1.5-6.1-4.6-7.2-9.3Z" fill="currentColor" opacity=".48"/>
  </svg>`;

const serviceCards = services
  .map(
    (service, index) => `
      <article class="service-card" data-reveal>
        <div class="service-photo-wrap">
          <img class="service-photo" src="${service.image}" alt="${service.alt}" loading="lazy" />
          <span class="service-number">0${index + 1}</span>
        </div>
        <div class="service-card-content">
          <p class="eyebrow service-category">${service.subtitle || "Personalized bodywork"}</p>
          <h3>${service.name}</h3>
          ${service.subtitle ? `<p class="service-subtitle">${service.subtitle}</p>` : ""}
          <p class="service-description">${service.description}</p>
          ${index === 2 ? `<div class="benefits"><span>Reduced stress</span><span>Restful sleep</span><span>Gentle support</span></div>` : ""}
          <div class="service-bottom">
            <div class="service-meta"><span class="service-price">${service.price}</span><span class="meta-divider" aria-hidden="true"></span><span>${service.duration}</span></div>
            <button class="text-link book-trigger" type="button" data-service="${service.name}">Book this service <span aria-hidden="true"></span></button>
          </div>
        </div>
      </article>`
  )
  .join("");

const intensiveCards = intensives
  .map((intensive, index) => `
    <article class="intensive-card" data-reveal>
      <div class="intensive-photo-wrap">
        <img class="intensive-photo ${intensive.imageClass}" src="${intensive.image}" alt="${intensive.alt}" loading="lazy" />
        <span class="intensive-number">0${index + 1}</span>
      </div>
      <div class="intensive-card-content">
        <p class="eyebrow intensive-category">PRIVATE BODYWORK</p>
        <h3>${intensive.name}</h3>
        <p class="intensive-card-copy">Private bodywork for all clients, arranged around your needs and location.</p>
        <p class="intensive-price">${intensive.price}</p>
        <button class="button button-dark reserve-intensive book-trigger" type="button" data-intensive="${intensive.name}" data-price="${intensive.price}">Reserve Your Intensive</button>
      </div>
    </article>`)
  .join("");

const app = document.querySelector("#app");
app.innerHTML = `
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="announcement" role="region" aria-label="Booking information">

    <p>PRIVATE SESSIONS FROM $150 · WORLDWIDE TRAVEL INTENSIVES AVAILABLE</p>
    <a href="#services" class="announcement-link">Explore treatments <span aria-hidden="true"></span></a>
  </div>
  <header class="site-header">
    <a class="brand" href="#home" aria-label="BODYHEALING home">${brand}<span>BODY<span class="brand-thin">HEALING</span></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation" aria-label="Open navigation"><span></span><span></span></button>
    <nav class="primary-navigation" id="primary-navigation" aria-label="Main navigation">
      <a href="#services">Services</a>
      <a href="#intensives">Intensives</a>
      <a href="#about">About</a>
      <a href="#team">Team</a>
      <a href="#contact">Contact</a>
      <a href="#booking-status" class="booking-status-nav">Check Booking Status</a>
      <button class="button button-dark nav-book book-trigger" type="button">Book Now <span aria-hidden="true"></span></button>
    </nav>
  </header>

  <main id="main">
    <section class="hero" id="home" aria-labelledby="hero-title">
      <div class="hero-photo" role="img" aria-label="A quiet, restorative massage treatment"></div>
      <div class="hero-shade"></div>
      <div class="hero-inner">
        <p class="eyebrow hero-kicker"><span class="hero-kicker-line"></span>PRIVATE STUDIO & WORLDWIDE TRAVEL</p>
        <h1 id="hero-title">Come back<br /><em>to yourself.</em></h1>
        <p class="hero-copy">Private bodywork for women and men, from focused recovery to unhurried restoration.</p>
        <div class="hero-actions"><button class="button button-light book-trigger" type="button">Find your treatment <span aria-hidden="true"></span></button><a class="hero-secondary" href="#services">Discover our services <span aria-hidden="true"></span></a></div>
      </div>
      <div class="hero-stamp" aria-hidden="true"><span>BODYWORK</span><span>·</span><span>WELLNESS</span><span>·</span><span>SCOTTSDALE</span></div>
      <a class="hero-scroll" href="#about"><span></span><i></i></a>
    </section>

    <section class="intro section-pad" id="about">
      <div class="intro-side" data-reveal><p class="eyebrow"><span class="eyebrow-dot"></span>BODYWORK, WITH INTENTION</p><div class="intro-image-frame"><img src="/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-4.webp" alt="A calm massage session in a light-filled treatment room" loading="lazy" /><span class="image-note">A softer place to land.</span></div></div>
      <div class="intro-copy" data-reveal><p class="section-index">01 <span>—</span> A little about us</p><h2>Make room for<br /><em>feeling better.</em></h2><p>Every body arrives with a different story. We take the time to listen, then tailor each session with care—whether you’re looking for relief, a moment to exhale, or a gentler kind of support.</p><p>Our work is grounded in attentive touch, a safe and welcoming space, and respect for what feels right for you.</p><a class="text-link" href="#team">Meet your care team <span aria-hidden="true"></span></a></div>
      <div class="intro-asterisk" aria-hidden="true">✳</div>
    </section>

    <section class="services-section section-pad" id="services">
      <div class="section-heading" data-reveal><div><p class="eyebrow"><span class="eyebrow-dot"></span>CARE FOR EVERY SEASON</p><h2>Find your kind<br />of <em>rest.</em></h2></div><p class="section-heading-note">A few ways to feel more at home in your body. Each session is personalized to you.</p></div>
      <div class="service-grid">${serviceCards}</div>
      <div class="services-end" data-reveal><span>YOUR TIME. YOUR BODY. YOUR PACE.</span><button class="button button-outline book-trigger" type="button">Let’s find your fit <span aria-hidden="true"></span></button></div>
    </section>

    <section class="intensives-section" id="intensives" aria-labelledby="intensives-title">
      <div class="intensives-heading" data-reveal>
        <div class="intensives-heading-copy">
          <p class="eyebrow"><span class="eyebrow-dot"></span>PRIVATE &amp; GLOBAL TRAVEL</p>
          <h2 id="intensives-title">Private &amp; Global<br /><em>Travel Intensives</em></h2>
          <p class="intensives-intro">Dedicated, extended bodywork experiences designed around you—available in Scottsdale or wherever you need us.</p>
        </div>
        <div class="worldwide-badge"><span class="worldwide-icon" aria-hidden="true">◎</span><div><strong>Worldwide Travel Available</strong><p>I travel internationally to any country to deliver private and on-site massage intensives.</p></div></div>
      </div>
      <p class="travel-note" data-reveal>International travel logistics and on-site accommodations are coordinated upon reservation.</p>
      <div class="intensive-grid">${intensiveCards}</div>
    </section>

    <section class="gallery-section section-pad" id="selected-work" aria-labelledby="gallery-title"><div class="section-heading"><div><p class="eyebrow">SESSION PHOTOGRAPHS</p><h2 id="gallery-title">Selected work &amp;<br /><em>session gallery</em></h2></div><p class="section-heading-note">A glimpse of the care, settings, and hands-on work we offer.</p></div><div class="gallery-grid"><figure><img src="/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-1.webp" alt="Male client receiving focused shoulder and back recovery work" loading="lazy"><figcaption><strong>Deep tissue recovery</strong><span>Focused structural work for active bodies.</span></figcaption></figure><figure><img src="/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-2.webp" alt="Female client receiving restorative back bodywork" loading="lazy"><figcaption><strong>Restorative bodywork</strong><span>Unhurried care shaped to the person.</span></figcaption></figure><figure><img src="/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-3.webp" alt="Buccal facial massage performed by a therapist" loading="lazy"><figcaption><strong>Buccal facial sculpting</strong><span>Careful work for jaw and facial tension.</span></figcaption></figure><figure><img src="/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-4.webp" alt="A private massage intensive arranged in a travel residence" loading="lazy"><figcaption><strong>Private on-site care</strong><span>A considered treatment space, wherever you are.</span></figcaption></figure></div></section>

    <section class="gentle-feature" aria-labelledby="gentle-title">
      <div class="gentle-image"><img src="/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-2.webp" alt="A client resting as a practitioner gives a gentle face and head massage" loading="lazy" /></div>
      <div class="gentle-content" data-reveal><p class="eyebrow"><span class="eyebrow-dot"></span>CARE THAT LISTENS</p><h2 id="gentle-title">A gentle touch.<br /><em>A little more ease.</em></h2><p>For anyone navigating cancer treatment or recovery, the smallest moments of comfort can mean a lot. Oncology massage is adapted with sensitivity to your needs, energy, and boundaries.</p><p>Sessions begin with a thoughtful intake. Touch is gentle and intentional, with your comfort at the center of every moment.</p><button class="button button-light book-trigger" type="button" data-service="Gentle Touch">Learn about Gentle Touch <span aria-hidden="true"></span></button></div>
    </section>

    <section class="team-section section-pad" id="team">
      <div class="team-image" data-reveal><img src="/manus-storage/async-images/nohmN4gnCw7C1nKojRlepq/image-1.webp" alt="Hands providing attentive therapeutic massage" loading="lazy" /><span class="team-image-label">A calm, considered approach</span></div>
      <div class="team-copy" data-reveal><p class="section-index">02 <span>—</span> Meet your team</p><p class="eyebrow"><span class="eyebrow-dot"></span>THOUGHTFUL HANDS, ALWAYS</p><h2>Care that<br /><em>sees the whole you.</em></h2><p>Your therapist brings a thoughtful, individualized approach to every appointment. With specialized certification in oncology massage, they take time to understand your comfort, your history, and what support looks like for you.</p><p>There is no one-size-fits-all session here—only steady, compassionate care at your pace.</p><a class="text-link" href="tel:+16023665298">Let’s talk about what you need <span aria-hidden="true"></span></a></div>
    </section>

    <section class="contact-section" id="contact">
      <div class="contact-top" data-reveal><p class="eyebrow"><span class="eyebrow-dot"></span>YOUR SPACE TO RESTORE</p><h2>We’ll meet you<br /><em>where you are.</em></h2><button class="button button-dark book-trigger" type="button">Book a session <span aria-hidden="true"></span></button></div>
      <div class="contact-lower">
        <div class="contact-location" data-reveal><p class="eyebrow">COME FIND US</p><a class="location-address" href="https://www.google.com/maps/search/?api=1&amp;query=9393%20N%2090th%20St%20%23108B%2C%20Scottsdale%2C%20AZ%2C%2085258" target="_blank" rel="noopener noreferrer">9393 N 90th St #108B<br />Scottsdale, AZ 85258 <span aria-hidden="true"></span></a><a class="contact-phone" href="tel:+16023665298">(602) 366-5298</a><a class="map-link" href="https://www.google.com/maps/search/?api=1&amp;query=9393%20N%2090th%20St%20%23108B%2C%20Scottsdale%2C%20AZ%2C%2085258" target="_blank" rel="noopener noreferrer">Get directions <span aria-hidden="true"></span></a><a class="instagram-link" href="https://www.instagram.com/bodywork_massage_az" target="_blank" rel="noopener noreferrer">Instagram <span aria-hidden="true"></span></a></div>
        <div class="hours-panel" data-reveal><p class="eyebrow">HOURS AND LOCATION</p><div class="hours-list">${hours.map(([day, value]) => `<div class="hours-row"><span>${day}</span><span>${value}</span></div>`).join("")}</div></div>
      </div>
    </section>
    <section class="booking-status-section section-pad" id="booking-status" aria-labelledby="booking-status-title">
      <div class="booking-status-grid">
        <article class="active-booking-receipt" id="active-booking-receipt" hidden></article>
        <div class="booking-status-lookup-panel"><p class="eyebrow">BOOKING SUPPORT</p><h2 id="booking-status-title">Check booking <em>status</em></h2><p>Enter your BODYHEALING Booking ID to see the latest payment review and appointment details.</p><form class="booking-status-lookup"><label for="persistent-booking-id">Booking ID</label><input id="persistent-booking-id" name="bookingRef" required placeholder="BH-A1B2C3D4" autocomplete="off"><button class="button button-dark" type="submit">Check Booking Status</button></form><p id="persistent-booking-status" class="booking-lookup-result" aria-live="polite"></p></div>
      </div>
    </section>
  </main>

  <footer class="site-footer"><a class="footer-brand" href="#home">${brand}<span>BODYHEALING</span></a><p>Thoughtful care, right where you are.</p><nav class="footer-navigation" aria-label="Footer navigation"><a href="#services">Services</a><a href="#intensives">Intensives</a><a href="#about">About</a><a href="#team">Team</a><a href="#contact">Contact</a><a href="#booking-status">Check Booking Status</a></nav><div class="footer-bottom"><span>© <span id="year"></span> BODYHEALING · SCOTTSDALE, AZ</span><a href="/admin" class="footer-admin-link">Admin</a><a href="#home">Back to top ↑</a></div></footer>

  <dialog class="booking-dialog" id="booking-dialog" aria-labelledby="dialog-title">
    <button class="dialog-close" type="button" aria-label="Close booking form">×</button>
    <div class="dialog-inner">
      <p class="eyebrow"><span class="eyebrow-dot"></span>LET’S MAKE SOME SPACE FOR YOU</p>
      <h2 id="dialog-title">Start with<br /><em>a conversation.</em></h2>
      <p class="dialog-intro">Tell us a little about what you’re looking for. We’ll help you find a session that feels right.</p>
      <form id="booking-form">
        <label for="service-choice">Service of interest</label>
        <select id="service-choice" name="service" required><option value="">Choose a service</option><optgroup label="Massage &amp; bodywork">${services.map((service) => `<option value="${service.name}" data-kind="service">${service.name}${service.subtitle ? ` (${service.subtitle})` : ""} — ${service.price}, ${service.duration}</option>`).join("")}</optgroup><optgroup label="Private &amp; global travel intensives">${intensives.map((intensive) => `<option value="${intensive.name}" data-kind="intensive" data-price="${intensive.price}">${intensive.name} — ${intensive.price}</option>`).join("")}</optgroup><option value="Not sure yet" data-kind="service">I’m not sure yet</option></select>
        <div class="intensive-travel-fields" id="intensive-travel-fields" hidden>
          <p class="travel-fields-heading">A little about your intensive</p>
          <label for="destination">Destination City &amp; Country</label>
          <input id="destination" name="destination" type="text" autocomplete="off" placeholder="City, Country" disabled />
          <fieldset class="travel-date-range" disabled>
            <legend>Preferred Travel Dates</legend>
            <div class="travel-date-inputs"><label for="travel-start">From<input id="travel-start" type="date" disabled /></label><label for="travel-end">Through<input id="travel-end" type="date" disabled /></label></div>
          </fieldset>
          <input id="travel-dates" name="travelDates" type="hidden" disabled />
          <p class="travel-date-hint" id="travel-date-hint" aria-live="polite">Choose a start date and end date.</p>
        </div>
        <div class="form-row"><div><label for="guest-name">Your name</label><input id="guest-name" name="name" autocomplete="name" required placeholder="First and last name" /></div><div><label for="guest-phone">Phone number</label><input id="guest-phone" name="phone" type="tel" autocomplete="tel" required placeholder="(555) 000-0000" /></div></div>
        <label for="guest-note">Anything you’d like us to know? <span class="optional-label">Optional</span></label><textarea id="guest-note" name="note" rows="3" placeholder="A day or time that works, or anything you’d like to ask…"></textarea>
        <button class="button button-dark form-submit" id="crypto-pay-start" type="button">Continue to USDT payment <span aria-hidden="true"></span></button>
        <button class="button button-outline form-submit" id="email-inquiry" type="button">Send Email Inquiry <span aria-hidden="true"></span></button>
        <p class="form-disclaimer">Opens a prefilled inquiry to BODYHEALING in your email app.</p>
        <p class="form-feedback" id="form-feedback" aria-live="polite" role="status"></p>
      </form>
      <section class="crypto-panel" id="crypto-checkout" hidden aria-labelledby="crypto-title">
        <p class="eyebrow"><span class="eyebrow-dot"></span>SECURE PAYMENT DETAILS</p>
        <h3 id="crypto-title">Pay with USDT<br /><em>on BNB Smart Chain.</em></h3>
        <p class="crypto-ref">Booking reference <strong id="booking-reference"></strong></p>
        <p class="crypto-amount-label">Exact amount due</p><p class="crypto-amount" id="wallet-amount"></p>
        <div class="wallet-qr-wrap"><canvas id="wallet-qr" aria-label="QR code for BODYHEALING receiving wallet"></canvas><p>Scan to copy the receiving wallet address. Confirm the correct network in your wallet app.</p></div>
        <label class="wallet-address-label" for="wallet-address">Receiving wallet address</label><div class="wallet-copy-row"><code id="wallet-address"></code><button class="button button-outline" id="copy-wallet" type="button">Copy Address</button></div>
        <p class="network-warning"><strong>Network warning</strong> Only send USDT via BNB Smart Chain (BEP20) to this address. Sending other assets may result in permanent loss.</p>
        <form id="payment-proof-form" enctype="multipart/form-data">
          <label for="payment-txid">Transaction Hash / TXID <span class="optional-label">Optional if you upload a screenshot</span></label><input id="payment-txid" name="txid" type="text" autocomplete="off" maxlength="80" placeholder="0x… (BNB Smart Chain transaction hash)" />
          <label for="payment-screenshot">Payment screenshot <span class="optional-label">Optional if you provide a TXID · JPG / PNG / WEBP · max 5 MB</span></label><input id="payment-screenshot" name="proof" type="file" accept="image/jpeg,image/png,image/webp" /><img id="payment-preview" class="payment-preview" alt="Preview of payment screenshot" hidden />
          <button class="button button-dark form-submit" type="submit">Submit Payment for Verification <span aria-hidden="true"></span></button>
        </form>
        <div id="payment-status" class="payment-status" hidden aria-live="polite"></div>
        <p id="crypto-feedback" class="form-feedback" aria-live="polite" role="status"></p>
        <div class="status-lookup"><h4>Check status by booking ID</h4><form id="booking-lookup-form" class="booking-status-lookup"><label for="lookup-reference">Booking reference</label><input id="lookup-reference" name="bookingRef" required placeholder="BH-A1B2C3D4" /><button class="button button-outline" type="submit">Check Status</button></form><p id="lookup-result" class="booking-lookup-result" aria-live="polite"></p></div>
      </section>
      <a class="dialog-call" href="tel:+16023665298">Prefer to call? (602) 366-5298</a>
    </div>
  </dialog>
`;

document.querySelector("#year").textContent = new Date().getFullYear();

const dialog = document.querySelector("#booking-dialog");
const serviceChoice = document.querySelector("#service-choice");
const travelFields = document.querySelector("#intensive-travel-fields");
const destinationField = document.querySelector("#destination");
const travelDatesField = document.querySelector("#travel-dates");
const travelDateRange = document.querySelector(".travel-date-range");
const travelStartField = document.querySelector("#travel-start");
const travelEndField = document.querySelector("#travel-end");
const todayLocal = new Date(); todayLocal.setMinutes(todayLocal.getMinutes() - todayLocal.getTimezoneOffset());
const todayISO = todayLocal.toISOString().slice(0, 10);
travelStartField.min = todayISO; travelEndField.min = todayISO;
const syncTravelDates = () => {
  travelEndField.min = travelStartField.value && travelStartField.value > todayISO ? travelStartField.value : todayISO;
  if (travelEndField.value && travelEndField.value < travelEndField.min) travelEndField.value = "";
  if (travelStartField.value && travelEndField.value) {
    const format = (value) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    travelDatesField.value = travelStartField.value === travelEndField.value ? format(travelStartField.value) : `${format(travelStartField.value)} – ${format(travelEndField.value)}`;
    document.querySelector("#travel-date-hint").textContent = travelDatesField.value;
  } else { travelDatesField.value = ""; document.querySelector("#travel-date-hint").textContent = "Choose a start date and end date."; }
};
travelStartField.addEventListener("change", syncTravelDates); travelEndField.addEventListener("change", syncTravelDates);
const syncIntensiveFields = () => {
  const isIntensive = serviceChoice.selectedOptions[0]?.dataset.kind === "intensive";
  travelFields.hidden = !isIntensive;
  destinationField.disabled = !isIntensive;
  travelDatesField.disabled = !isIntensive;
  travelDateRange.disabled = !isIntensive;
  travelStartField.disabled = !isIntensive; travelEndField.disabled = !isIntensive;
  travelStartField.required = isIntensive; travelEndField.required = isIntensive;
  travelDatesField.required = false;
  if (!isIntensive) { travelStartField.value = ""; travelEndField.value = ""; syncTravelDates(); }
};
serviceChoice.addEventListener("change", syncIntensiveFields);
const openers = document.querySelectorAll(".book-trigger");
for (const opener of openers) {
  opener.addEventListener("click", () => {
    const desired = opener.dataset.intensive || opener.dataset.service;
    if (desired) serviceChoice.value = desired;
    syncIntensiveFields();
    document.querySelector("#form-feedback").textContent = "";
    dialog.showModal();
  });
}

document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
dialog.addEventListener("close", () => {
  document.querySelector("#form-feedback").textContent = "";
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && dialog.open) dialog.close();
});

document.querySelector("#email-inquiry").addEventListener("click", () => {
  const formElement = document.querySelector("#booking-form");
  const feedback = document.querySelector("#form-feedback");
  if (!formElement.reportValidity()) {
    feedback.textContent = "Please complete the required booking and travel fields before sending your inquiry.";
    return;
  }
  const contactEmail = import.meta.env.VITE_BODYHEAL_CONTACT_EMAIL?.trim();
  if (!contactEmail) {
    feedback.textContent = "Email inquiries are not configured yet. Please call BODYHEALING at (602) 366-5298.";
    return;
  }
  const form = new FormData(formElement);
  const selectedOption = document.querySelector("#service-choice").selectedOptions[0];
  const selectedPrice = selectedOption?.dataset.price || ({ "Bodywork Massage": "$150+", "Buccal Massage": "$150", "Gentle Touch": "$140" }[form.get("service")] || "");
  const message = [
    `Hello BODYHEALING, I’d like to ask about an appointment.`,
    selectedOption?.dataset.kind === "intensive" ? `Intensive package: ${form.get("service")}` : `Service: ${form.get("service")}`,
    selectedPrice ? `Price: ${selectedPrice}` : "",
    form.get("destination") ? `Destination City & Country: ${form.get("destination")}` : "",
    form.get("travelDates") ? `Preferred Travel Dates: ${form.get("travelDates")}` : "",
    `Name: ${form.get("name")}`,
    `Phone: ${form.get("phone")}`,
    form.get("note") ? `Note: ${form.get("note")}` : "",
  ].filter(Boolean).join("\n");
  const subject = `BODYHEALING inquiry — ${form.get("service")}`;
  window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  feedback.textContent = "Your prefilled email inquiry is ready in your email app.";
});

const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".primary-navigation");
const closeMenu = () => {
  nav.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
};
menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  nav.classList.toggle("is-open", !isOpen);
});
nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
nav.querySelector(".book-trigger").addEventListener("click", closeMenu);
document.querySelectorAll(".footer-navigation a").forEach((link) => link.addEventListener("click", closeMenu));

document.querySelectorAll("[data-reveal]").forEach((element) => {
  if (!("IntersectionObserver" in window)) {
    element.classList.add("is-visible");
    return;
  }
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      element.classList.add("is-visible");
      observer.disconnect();
    }
  }, { threshold: 0.14 });
  observer.observe(element);
});

setupCryptoPayment();
}
