import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import express from "express";
import multer from "multer";
import mysql from "mysql2/promise";

const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const wallet = "0xF071f5f6D703dF16cE3715A912ef08791b783CDe";
const corsOrigins = new Set((process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean));
const catalog = new Map([
  ["Bodywork Massage", { amount: 150, intensive: false }],
  ["Buccal Massage", { amount: 150, intensive: false }],
  ["Gentle Touch", { amount: 140, intensive: false }],
  ["1 Day Private Intensive", { amount: 5000, intensive: true }],
  ["Half Day Private Intensive", { amount: 3500, intensive: true }],
  ["Mini Intensive", { amount: 1750, intensive: true }],
  ["5 Day On-Site Intensive", { amount: 25000, intensive: true }],
]);
const pool = process.env.DATABASE_URL ? mysql.createPool(process.env.DATABASE_URL + (process.env.DATABASE_URL.includes("?") ? "&" : "?") + "connectionLimit=5&enableKeepAlive=true") : null;
const dataDir = path.resolve(process.env.BODYHEAL_DATA_DIR || path.join(root, "data"));
const bookingsFile = path.join(dataDir, "bookings.json");
const proofsDir = path.join(dataDir, "uploads");
const fallbackPasscodeFile = path.join(dataDir, "admin-passcode.json");
async function resolveAdminPasscode() {
  const primary = process.env.BODYHEAL_ADMIN_PASSCODE?.trim();
  if (primary && primary.length >= 16) return primary;
  const configuredFallback = process.env.BODYHEAL_ADMIN_DEFAULT_PASSCODE?.trim();
  if (configuredFallback && configuredFallback.length >= 16) return configuredFallback;
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  try {
    const saved = JSON.parse(await fs.readFile(fallbackPasscodeFile, "utf8"));
    if (typeof saved.passcode === "string" && saved.passcode.length >= 16) return saved.passcode;
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const generated = crypto.randomBytes(32).toString("base64url");
  try {
    await fs.writeFile(fallbackPasscodeFile, `${JSON.stringify({ passcode: generated })}\n`, { flag: "wx", mode: 0o600 });
    console.warn("BODYHEAL_ADMIN_PASSCODE is unset; a secure fallback passcode was created. Retrieve it from this first-start log, sign in, and set BODYHEAL_ADMIN_PASSCODE in Hostinger. Treat this value as a secret:", generated);
    return generated;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const saved = JSON.parse(await fs.readFile(fallbackPasscodeFile, "utf8"));
    if (typeof saved.passcode !== "string" || saved.passcode.length < 16) throw new Error("Saved admin fallback passcode is invalid.");
    return saved.passcode;
  }
}
let jsonQueue = Promise.resolve();
async function readBookings() {
  try { const value = JSON.parse(await fs.readFile(bookingsFile, "utf8")); return Array.isArray(value) ? value : []; }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
}
function updateBookings(mutator) {
  const task = jsonQueue.then(async () => {
    await fs.mkdir(dataDir, { recursive: true });
    const rows = await readBookings();
    const result = await mutator(rows);
    const temp = `${bookingsFile}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(rows, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temp, bookingsFile);
    return result;
  });
  jsonQueue = task.catch(() => {});
  return task;
}
function localStatusData(row) {
  return { bookingRef: row.booking_ref, status: row.status, service: row.service_name, amount: Number(row.amount_usd), destination: row.destination, travelDates: row.travel_dates, appointmentAt: row.appointment_at, rescheduleRequestedFor: row.reschedule_requested_for, rescheduleStatus: row.reschedule_status || "none", currency: "USDT", createdAt: row.created_at, updatedAt: row.updated_at, txid: row.txid, proofSubmitted: Boolean(row.proof_name) };
}
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) });
const primaryAdminPasscode = process.env.BODYHEAL_ADMIN_PASSCODE?.trim();
const secret = await resolveAdminPasscode();
const adminPasscodeSource = primaryAdminPasscode && primaryAdminPasscode.length >= 16 ? "environment" : process.env.BODYHEAL_ADMIN_DEFAULT_PASSCODE?.trim() ? "configured-fallback" : "persisted-generated-fallback";
const sessionKey = crypto.scryptSync(secret, "bodyhealing-admin-session-v1", 32);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (origin) {
    const forwardedHost = req.get("x-forwarded-host")?.split(",")[0].trim();
    const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0].trim();
    const sameOrigin = `${forwardedProto || req.protocol}://${forwardedHost || req.get("host")}`;
    if (origin !== sameOrigin && !corsOrigins.has(origin)) return res.status(403).json({ error: "Origin is not allowed." });
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  if (req.path.startsWith("/api/admin")) res.setHeader("X-Frame-Options", "DENY");
  next();
});

const schema = `CREATE TABLE IF NOT EXISTS bodyheal_payments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  booking_ref VARCHAR(16) NOT NULL UNIQUE,
  status ENUM('payment_pending','waiting_confirmation','successful','needs_review') NOT NULL DEFAULT 'payment_pending',
  service_name VARCHAR(120) NOT NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  is_intensive BOOLEAN NOT NULL DEFAULT FALSE,
  destination VARCHAR(180) NULL,
  travel_dates VARCHAR(120) NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(254) NULL,
  appointment_at DATETIME NULL,
  reschedule_requested_for DATETIME NULL,
  reschedule_status VARCHAR(20) NOT NULL DEFAULT 'none',
  phone VARCHAR(40) NOT NULL,
  note VARCHAR(1000) NULL,
  txid VARCHAR(80) NULL UNIQUE,
  proof_key VARCHAR(220) NULL,
  proof_name VARCHAR(160) NULL,
  proof_mime VARCHAR(40) NULL,
  proof_data LONGBLOB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  INDEX status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
let schemaReady = false;
let schemaPromise = null;
async function ensureSchema() {
  if (!pool) throw Object.assign(new Error("DATABASE_URL is not configured. Add the MySQL connection string to the Hostinger Node.js app environment and restart the app."), { status: 503 });
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(schema);
      const [columns] = await pool.query("SHOW COLUMNS FROM bodyheal_payments");
      const existing = new Set(columns.map((column) => column.Field));
      if (!existing.has("proof_mime")) await pool.query("ALTER TABLE bodyheal_payments ADD COLUMN proof_mime VARCHAR(40) NULL");
      if (!existing.has("proof_data")) await pool.query("ALTER TABLE bodyheal_payments ADD COLUMN proof_data LONGBLOB NULL");
      if (!existing.has("customer_email")) await pool.query("ALTER TABLE bodyheal_payments ADD COLUMN customer_email VARCHAR(254) NULL");
      if (!existing.has("appointment_at")) await pool.query("ALTER TABLE bodyheal_payments ADD COLUMN appointment_at DATETIME NULL");
      if (!existing.has("reschedule_requested_for")) await pool.query("ALTER TABLE bodyheal_payments ADD COLUMN reschedule_requested_for DATETIME NULL");
      if (!existing.has("reschedule_status")) await pool.query("ALTER TABLE bodyheal_payments ADD COLUMN reschedule_status VARCHAR(20) NOT NULL DEFAULT 'none'");
      schemaReady = true;
    })().catch((error) => { schemaPromise = null; throw error; });
  }
  await schemaPromise;
}
function cleanText(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
function validLocalDateTime(value) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime()); }
function sqlDateTime(value) { return value ? value.replace("T", " ") + ":00" : null; }
function safeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function notifyEmail(to, subject, html) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "BODYHEALING <concierge@bodyheal.shop>";
  if (!key || !to) return;
  void fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html }) })
    .then(async (response) => { if (!response.ok) console.warn("Optional Resend notification failed:", response.status, (await response.text()).slice(0, 300)); })
    .catch((error) => console.warn("Optional Resend notification unavailable:", error.message));
}
function sendBookingNotifications(booking) {
  const details = `<p>Booking ID: <strong>${safeHtml(booking.bookingRef)}</strong></p><p>${safeHtml(booking.service)} · $${Number(booking.amount).toLocaleString()} USD</p><p>Preferred session: ${safeHtml(booking.appointmentAt)}</p>${booking.destination ? `<p>Destination: ${safeHtml(booking.destination)} · Travel dates: ${safeHtml(booking.travelDates)}</p>` : ""}`;
  notifyEmail(booking.email, `BODYHEALING booking received — ${booking.bookingRef}`, `<h2>We received your booking request</h2>${details}<p>Payment is pending verification. You can view updates with your Booking ID and email at bodyheal.shop.</p>`);
  notifyEmail(process.env.BODYHEAL_ADMIN_ALERT_EMAIL?.trim(), `New BODYHEALING booking — ${booking.bookingRef}`, `<h2>New booking</h2>${details}<p>Client: ${safeHtml(booking.name)} · ${safeHtml(booking.email)} · ${safeHtml(booking.phone)}</p>`);
}
function customerToken(ref) {
  const payload = Buffer.from(JSON.stringify({ ref, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionKey).update(`customer:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}
function validCustomer(req, ref) {
  const value = req.cookies?.bh_customer;
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = crypto.createHmac("sha256", sessionKey).update(`customer:${payload}`).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;
  try { const data = JSON.parse(Buffer.from(payload, "base64url").toString()); return data.ref === ref && data.exp > Date.now(); } catch { return false; }
}
function makeRef() { return `BH-${crypto.randomBytes(4).toString("hex").toUpperCase()}`; }
function sessionToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 60 * 60 * 1000, nonce: crypto.randomBytes(12).toString("hex") })).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionKey).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function validSession(value) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = crypto.createHmac("sha256", sessionKey).update(payload).digest();
  let given;
  try { given = Buffer.from(signature, "base64url"); } catch { return false; }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now(); } catch { return false; }
}
function requireAdmin(req, res, next) {
  if (!validSession(req.cookies?.bh_admin)) return res.status(401).json({ error: "Admin sign-in required." });
  next();
}
// Minimal cookie parsing; only the signed admin cookie is accepted.
app.use((req, _res, next) => {
  req.cookies = Object.fromEntries((req.headers.cookie || "").split(";").map((part) => part.trim().split(/=(.*)/s, 2)).filter(([key, value]) => key && value).map(([key, value]) => [key, decodeURIComponent(value)]));
  next();
});

async function saveProof(file) {
  if (!file) return null;
  const sig = file.buffer.subarray(0, 12);
  const valid = (file.mimetype === "image/jpeg" && sig[0] === 0xff && sig[1] === 0xd8) ||
    (file.mimetype === "image/png" && sig.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
    (file.mimetype === "image/webp" && sig.toString("ascii", 0, 4) === "RIFF" && sig.toString("ascii", 8, 12) === "WEBP");
  if (!valid) throw Object.assign(new Error("Upload a valid JPG, PNG, or WEBP image."), { status: 400 });
  const ext = file.mimetype === "image/jpeg" ? "jpg" : file.mimetype.split("/")[1];
  return { name: cleanText(file.originalname, 160) || `payment-proof.${ext}`, mime: file.mimetype, data: file.buffer };
}

app.get("/api/health", (_req, res) => res.status(200).json({ status: "ok" }));
app.get("/api/admin/setup-status", (_req, res) => res.json({ databaseConfigured: Boolean(pool), localStorageFallback: !pool, passcodeConfigured: Boolean(secret && secret.length >= 16), passcodeSource: adminPasscodeSource }));
app.get("/api/payment-config", (_req, res) => res.json({ wallet, network: "BNB Smart Chain (BEP20)", currency: "USDT" }));
app.post("/api/bookings", async (req, res, next) => {
  try {
    const service = cleanText(req.body.service, 120);
    const item = catalog.get(service);
    const name = cleanText(req.body.name, 120);
    const phone = cleanText(req.body.phone, 40);
    const email = cleanText(req.body.email, 254).toLowerCase();
    const appointmentAt = cleanText(req.body.appointmentAt, 16);
    const destination = cleanText(req.body.destination, 180);
    const dates = cleanText(req.body.travelDates, 120);
    if (!item || !name || !phone || !validEmail(email) || !validLocalDateTime(appointmentAt) || (item.intensive && (!destination || !dates))) return res.status(400).json({ error: "Complete the required email, appointment, and travel details." });
    const amount = item.amount;
    if (!pool) {
      let created;
      await updateBookings((rows) => {
        let ref;
        do { ref = makeRef(); } while (rows.some((row) => row.booking_ref === ref));
        const now = new Date().toISOString();
        created = { id: crypto.randomUUID(), booking_ref: ref, status: "payment_pending", service_name: service, amount_usd: amount, is_intensive: item.intensive, destination: item.intensive ? destination : null, travel_dates: item.intensive ? dates : null, customer_name: name, customer_email: email, appointment_at: appointmentAt, reschedule_requested_for: null, reschedule_status: "none", phone, note: cleanText(req.body.note, 1000) || null, txid: null, proof_key: null, proof_name: null, proof_mime: null, proof_file: null, created_at: now, updated_at: now, reviewed_at: null };
        rows.push(created);
      });
      const response = { bookingRef: created.booking_ref, service, amount: Number(amount), currency: "USDT", network: "BNB Smart Chain (BEP20)", wallet, status: "payment_pending", appointmentAt };
      sendBookingNotifications({ ...response, email, name, phone, destination, travelDates: dates });
      return res.status(201).json(response);
    }
    await ensureSchema();
    let ref;
    for (let attempts = 0; attempts < 5; attempts++) {
      ref = makeRef();
      try {
        await pool.execute(`INSERT INTO bodyheal_payments (id, booking_ref, service_name, amount_usd, is_intensive, destination, travel_dates, customer_name, customer_email, appointment_at, phone, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [crypto.randomUUID(), ref, service, amount, item.intensive, item.intensive ? destination : null, item.intensive ? dates : null, name, email, sqlDateTime(appointmentAt), phone, cleanText(req.body.note, 1000) || null]);
        break;
      } catch (error) { if (error.code !== "ER_DUP_ENTRY" || attempts === 4) throw error; ref = null; }
    }
    if (!ref) throw new Error("Unable to create booking reference.");
    const response = { bookingRef: ref, service, amount: Number(amount), currency: "USDT", network: "BNB Smart Chain (BEP20)", wallet, status: "payment_pending", appointmentAt };
    sendBookingNotifications({ ...response, email, name, phone, destination, travelDates: dates });
    res.status(201).json(response);
  } catch (error) { next(error); }
});
app.post("/api/bookings/:ref/payment", upload.single("proof"), async (req, res, next) => {
  try {
    const ref = cleanText(req.params.ref, 16).toUpperCase();
    const txid = cleanText(req.body.txid, 80);
    if (txid && !/^0x[a-fA-F0-9]{64}$/.test(txid)) return res.status(400).json({ error: "Enter a valid BNB Smart Chain transaction hash (0x followed by 64 hexadecimal characters)." });
    if (!txid && !req.file) return res.status(400).json({ error: "Submit a transaction hash or payment screenshot." });
    if (!pool) {
      const proof = await saveProof(req.file);
      let found = false;
      await updateBookings(async (rows) => {
        const row = rows.find((entry) => entry.booking_ref === ref);
        if (!row) return;
        found = true;
        if (proof) {
          await fs.mkdir(proofsDir, { recursive: true, mode: 0o700 });
          const ext = proof.mime === "image/jpeg" ? "jpg" : proof.mime.split("/")[1];
          const filename = `${crypto.randomUUID()}.${ext}`;
          await fs.writeFile(path.join(proofsDir, filename), proof.data, { flag: "wx", mode: 0o600 });
          row.proof_file = filename; row.proof_name = proof.name; row.proof_mime = proof.mime;
        }
        if (txid) row.txid = txid;
        row.status = "waiting_confirmation"; row.updated_at = new Date().toISOString();
      });
      if (!found) return res.status(404).json({ error: "Booking reference not found." });
      const current = await statusData(ref);
      notifyEmail(process.env.BODYHEAL_ADMIN_ALERT_EMAIL?.trim(), `Payment proof submitted — ${ref}`, `<p>Payment proof received for ${safeHtml(ref)}.</p>`);
      return res.json(current);
    }
    await ensureSchema();
    const [rows] = await pool.execute("SELECT id, status FROM bodyheal_payments WHERE booking_ref = ?", [ref]);
    if (!rows.length) return res.status(404).json({ error: "Booking reference not found." });
    const proof = await saveProof(req.file);
    await pool.execute("UPDATE bodyheal_payments SET txid = ?, proof_key = NULL, proof_name = COALESCE(?, proof_name), proof_mime = COALESCE(?, proof_mime), proof_data = COALESCE(?, proof_data), status = 'waiting_confirmation' WHERE booking_ref = ? AND status IN ('payment_pending','needs_review')", [txid || null, proof?.name || null, proof?.mime || null, proof?.data || null, ref]);
    const current = await statusData(ref);
    notifyEmail(process.env.BODYHEAL_ADMIN_ALERT_EMAIL?.trim(), `Payment proof submitted — ${ref}`, `<p>Payment proof submitted for ${safeHtml(ref)}: ${safeHtml(current?.service)} · $${Number(current?.amount || 0).toLocaleString()} USDT.</p>`);
    res.json(current);
  } catch (error) { next(error); }
});
async function statusData(ref) {
  if (!pool) { const row = (await readBookings()).find((entry) => entry.booking_ref === ref); return row ? localStatusData(row) : null; }
  const [rows] = await pool.execute("SELECT booking_ref, status, service_name, amount_usd, destination, travel_dates, appointment_at, reschedule_requested_for, reschedule_status, txid, proof_name, created_at, updated_at FROM bodyheal_payments WHERE booking_ref = ?", [ref]);
  if (!rows.length) return null;
  const row = rows[0];
  return { bookingRef: row.booking_ref, status: row.status, service: row.service_name, amount: Number(row.amount_usd), destination: row.destination, travelDates: row.travel_dates, appointmentAt: row.appointment_at, rescheduleRequestedFor: row.reschedule_requested_for, rescheduleStatus: row.reschedule_status || "none", currency: "USDT", createdAt: row.created_at, updatedAt: row.updated_at, txid: row.txid, proofSubmitted: Boolean(row.proof_name) };
}
app.post("/api/bookings/:ref/access", async (req, res, next) => {
  try {
    const ref = cleanText(req.params.ref, 16).toUpperCase();
    const email = cleanText(req.body.email, 254).toLowerCase();
    let savedEmail;
    if (!pool) savedEmail = (await readBookings()).find((row) => row.booking_ref === ref)?.customer_email;
    else { await ensureSchema(); const [rows] = await pool.execute("SELECT customer_email FROM bodyheal_payments WHERE booking_ref = ?", [ref]); savedEmail = rows[0]?.customer_email; }
    if (!savedEmail || !validEmail(email) || savedEmail.toLowerCase() !== email) return res.status(401).json({ error: "Booking ID and email did not match." });
    res.cookie("bh_customer", customerToken(ref), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000, path: "/" });
    const data = await statusData(ref);
    return data ? res.json(data) : res.status(404).json({ error: "Booking reference not found." });
  } catch (error) { next(error); }
});
async function customerStatus(req, res, next) {
  try {
    const ref = cleanText(req.params.ref, 16).toUpperCase();
    if (!validCustomer(req, ref)) return res.status(401).json({ error: "Enter your Booking ID and email to access this booking." });
    if (pool) await ensureSchema();
    const data = await statusData(ref);
    return data ? res.json(data) : res.status(404).json({ error: "Booking reference not found." });
  } catch (error) { next(error); }
}
app.get("/api/bookings/:ref", customerStatus);
app.get("/api/bookings/:ref/status", customerStatus);
app.post("/api/bookings/:ref/reschedule", async (req, res, next) => {
  try {
    const ref = cleanText(req.params.ref, 16).toUpperCase();
    if (!validCustomer(req, ref)) return res.status(401).json({ error: "Sign in to your booking before requesting a reschedule." });
    const requested = cleanText(req.body.appointmentAt, 16);
    if (!validLocalDateTime(requested) || new Date(requested) <= new Date()) return res.status(400).json({ error: "Choose a future date and time." });
    if (!pool) {
      let changed = false;
      await updateBookings((rows) => { const row = rows.find((item) => item.booking_ref === ref); if (row && row.status === "successful" && row.reschedule_status !== "requested") { row.reschedule_requested_for = requested; row.reschedule_status = "requested"; row.updated_at = new Date().toISOString(); changed = true; } });
      if (!changed) return res.status(409).json({ error: "Reschedule request is unavailable for this booking." });
    } else {
      await ensureSchema();
      const [result] = await pool.execute("UPDATE bodyheal_payments SET reschedule_requested_for = ?, reschedule_status = 'requested' WHERE booking_ref = ? AND status = 'successful' AND reschedule_status <> 'requested'", [sqlDateTime(requested), ref]);
      if (!result.affectedRows) return res.status(409).json({ error: "Reschedule request is unavailable for this booking." });
    }
    const data = await statusData(ref);
    const adminEmail = process.env.BODYHEAL_ADMIN_ALERT_EMAIL?.trim();
    notifyEmail(adminEmail, `Reschedule requested — ${ref}`, `<p>Client requested a new date and time for booking ${safeHtml(ref)}: ${safeHtml(requested)}</p>`);
    return res.json(data);
  } catch (error) { next(error); }
});
app.patch("/api/admin/bookings/:ref/reschedule", requireAdmin, async (req, res, next) => {
  try {
    const ref = cleanText(req.params.ref, 16).toUpperCase();
    const decision = req.body.decision;
    if (!["approve", "decline"].includes(decision)) return res.status(400).json({ error: "Choose approve or decline." });
    let email;
    if (!pool) {
      let changed = false;
      await updateBookings((rows) => { const row = rows.find((item) => item.booking_ref === ref); if (!row || row.reschedule_status !== "requested") return; if (decision === "approve") row.appointment_at = row.reschedule_requested_for; row.reschedule_requested_for = null; row.reschedule_status = decision === "approve" ? "approved" : "declined"; row.updated_at = row.reviewed_at = new Date().toISOString(); email = row.customer_email; changed = true; });
      if (!changed) return res.status(404).json({ error: "No pending reschedule request found." });
    } else {
      await ensureSchema();
      const [rows] = await pool.execute("SELECT customer_email, reschedule_requested_for FROM bodyheal_payments WHERE booking_ref = ? AND reschedule_status = 'requested'", [ref]);
      if (!rows.length) return res.status(404).json({ error: "No pending reschedule request found." });
      email = rows[0].customer_email;
      if (decision === "approve") await pool.execute("UPDATE bodyheal_payments SET appointment_at = reschedule_requested_for, reschedule_requested_for = NULL, reschedule_status = 'approved', reviewed_at = NOW() WHERE booking_ref = ?", [ref]);
      else await pool.execute("UPDATE bodyheal_payments SET reschedule_requested_for = NULL, reschedule_status = 'declined', reviewed_at = NOW() WHERE booking_ref = ?", [ref]);
    }
    if (email) notifyEmail(email, `Reschedule ${decision === "approve" ? "approved" : "declined"} — ${ref}`, `<p>Your reschedule request for booking ${safeHtml(ref)} has been ${decision === "approve" ? "approved" : "declined"}.</p>`);
    return res.json({ ok: true });
  } catch (error) { next(error); }
});
let loginAttempts = new Map();
app.post("/api/admin/login", (req, res) => {
  const ip = req.ip;
  const attempt = loginAttempts.get(ip) || { count: 0, until: 0 };
  if (attempt.until > Date.now()) return res.status(429).json({ error: "Too many attempts. Wait 15 minutes and try again." });
  const input = typeof req.body.passcode === "string" ? req.body.passcode : "";
  const a = Buffer.from(input); const b = Buffer.from(secret || "not-configured");
  const matches = Boolean(secret) && a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!matches) {
    attempt.count++; if (attempt.count >= 5) { attempt.count = 0; attempt.until = Date.now() + 15 * 60 * 1000; }
    loginAttempts.set(ip, attempt);
    return res.status(401).json({ error: "Passcode not recognized." });
  }
  loginAttempts.delete(ip);
  res.cookie("bh_admin", sessionToken(), { httpOnly: true, secure: true, sameSite: "none", maxAge: 12 * 60 * 60 * 1000, path: "/" });
  return res.json({ ok: true });
});
app.post("/api/admin/logout", (_req, res) => { res.clearCookie("bh_admin", { httpOnly: true, secure: true, sameSite: "none", path: "/" }); res.json({ ok: true }); });
app.get("/api/admin/bookings", requireAdmin, async (_req, res, next) => {
  try {
    let rows;
    if (!pool) rows = (await readBookings()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 200);
    else { await ensureSchema(); [rows] = await pool.query("SELECT booking_ref, status, service_name, amount_usd, destination, travel_dates, appointment_at, reschedule_requested_for, reschedule_status, customer_email, customer_name, phone, note, txid, proof_name, proof_data IS NOT NULL AS proof_submitted, created_at, updated_at FROM bodyheal_payments ORDER BY created_at DESC LIMIT 200"); }
    const bookings = rows.map((row) => ({ bookingRef: row.booking_ref, status: row.status, service: row.service_name, amount: Number(row.amount_usd), destination: row.destination, travelDates: row.travel_dates, appointmentAt: row.appointment_at, rescheduleRequestedFor: row.reschedule_requested_for, rescheduleStatus: row.reschedule_status || "none", email: row.customer_email, name: row.customer_name, phone: row.phone, note: row.note, txid: row.txid, proofName: row.proof_name, proofUrl: (pool ? row.proof_submitted : Boolean(row.proof_file)) ? `/api/admin/bookings/${encodeURIComponent(row.booking_ref)}/proof` : null, createdAt: row.created_at }));
    res.json({ bookings });
  } catch (error) { next(error); }
});
app.get("/api/admin/bookings/:ref/proof", requireAdmin, async (req, res, next) => {
  try {
    let mime, data;
    if (!pool) {
      const row = (await readBookings()).find((entry) => entry.booking_ref === cleanText(req.params.ref, 16).toUpperCase());
      if (!row?.proof_file) return res.status(404).json({ error: "Payment screenshot not found." });
      data = await fs.readFile(path.join(proofsDir, path.basename(row.proof_file))); mime = row.proof_mime;
    } else {
      await ensureSchema();
      const [rows] = await pool.execute("SELECT proof_mime, proof_data FROM bodyheal_payments WHERE booking_ref = ?", [cleanText(req.params.ref, 16).toUpperCase()]);
      if (!rows.length || !rows[0].proof_data) return res.status(404).json({ error: "Payment screenshot not found." });
      mime = rows[0].proof_mime; data = rows[0].proof_data;
    }
    res.setHeader("Content-Type", mime || "application/octet-stream");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(data);
  } catch (error) { next(error); }
});
app.patch("/api/admin/bookings/:ref/status", requireAdmin, async (req, res, next) => {
  try {
    const status = req.body.status;
    if (!["successful", "needs_review"].includes(status)) return res.status(400).json({ error: "Unsupported status." });
    let email;
    const ref = cleanText(req.params.ref, 16).toUpperCase();
    if (!pool) {
      let updated = false;
      await updateBookings((rows) => { const row = rows.find((entry) => entry.booking_ref === ref); if (row && row.status !== "successful") { row.status = status; row.reviewed_at = row.updated_at = new Date().toISOString(); email = row.customer_email; updated = true; } });
      if (!updated) return res.status(404).json({ error: "Booking not found or already confirmed." });
    } else {
      await ensureSchema();
      const [existing] = await pool.execute("SELECT customer_email FROM bodyheal_payments WHERE booking_ref = ?", [ref]);
      email = existing[0]?.customer_email;
      const [result] = await pool.execute("UPDATE bodyheal_payments SET status = ?, reviewed_at = NOW() WHERE booking_ref = ? AND status <> 'successful'", [status, ref]);
      if (!result.affectedRows) return res.status(404).json({ error: "Booking not found or already confirmed." });
    }
    if (status === "successful" && email) notifyEmail(email, `Payment confirmed — ${ref}`, `<p>Your payment is confirmed and your BODYHEALING booking is successful.</p>`);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

// Do not let unknown API requests fall through to the SPA document.
app.use("/api", (_req, res) => res.status(404).json({ error: "API endpoint not found." }));

if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, "dist"), { index: false }));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
}
app.use((error, _req, res, _next) => {
  console.error("BODYHEAL API error:", error.message);
  const status = error.status || (error instanceof multer.MulterError ? 400 : 500);
  res.status(status).json({ error: status < 500 ? error.message : "Something went wrong. Please try again." });
});

app.listen(port, "0.0.0.0", () => console.log(`BODYHEALING server listening on ${port}`));
