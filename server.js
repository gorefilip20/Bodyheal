import crypto from "node:crypto";
import path from "node:path";
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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) });
const secret = process.env.BODYHEAL_ADMIN_PASSCODE;
if (!secret || secret.length < 16) console.error("BODYHEAL_ADMIN_PASSCODE must be configured with at least 16 characters.");
const sessionKey = secret ? crypto.scryptSync(secret, "bodyhealing-admin-session-v1", 32) : crypto.randomBytes(32);

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
  if (!pool) throw Object.assign(new Error("Payment service is not configured."), { status: 503 });
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(schema);
      const [columns] = await pool.query("SHOW COLUMNS FROM bodyheal_payments");
      const existing = new Set(columns.map((column) => column.Field));
      if (!existing.has("proof_mime")) await pool.query("ALTER TABLE bodyheal_payments ADD COLUMN proof_mime VARCHAR(40) NULL");
      if (!existing.has("proof_data")) await pool.query("ALTER TABLE bodyheal_payments ADD COLUMN proof_data LONGBLOB NULL");
      schemaReady = true;
    })().catch((error) => { schemaPromise = null; throw error; });
  }
  await schemaPromise;
}
function cleanText(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
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
app.get("/api/payment-config", (_req, res) => res.json({ wallet, network: "BNB Smart Chain (BEP20)", currency: "USDT" }));
app.post("/api/bookings", async (req, res, next) => {
  try {
    await ensureSchema();
    const service = cleanText(req.body.service, 120);
    const item = catalog.get(service);
    const name = cleanText(req.body.name, 120);
    const phone = cleanText(req.body.phone, 40);
    const destination = cleanText(req.body.destination, 180);
    const dates = cleanText(req.body.travelDates, 120);
    if (!item || !name || !phone || (item.intensive && (!destination || !dates))) return res.status(400).json({ error: "Complete the required booking and travel details." });
    const amount = item.amount;
    let ref;
    for (let attempts = 0; attempts < 5; attempts++) {
      ref = makeRef();
      try {
        await pool.execute(`INSERT INTO bodyheal_payments (id, booking_ref, service_name, amount_usd, is_intensive, destination, travel_dates, customer_name, phone, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [crypto.randomUUID(), ref, service, amount, item.intensive, item.intensive ? destination : null, item.intensive ? dates : null, name, phone, cleanText(req.body.note, 1000) || null]);
        break;
      } catch (error) { if (error.code !== "ER_DUP_ENTRY" || attempts === 4) throw error; ref = null; }
    }
    if (!ref) throw new Error("Unable to create booking reference.");
    res.status(201).json({ bookingRef: ref, service, amount: Number(amount), currency: "USDT", network: "BNB Smart Chain (BEP20)", wallet, status: "payment_pending" });
  } catch (error) { next(error); }
});
app.post("/api/bookings/:ref/payment", upload.single("proof"), async (req, res, next) => {
  try {
    await ensureSchema();
    const ref = cleanText(req.params.ref, 16).toUpperCase();
    const txid = cleanText(req.body.txid, 80);
    if (txid && !/^0x[a-fA-F0-9]{64}$/.test(txid)) return res.status(400).json({ error: "Enter a valid BNB Smart Chain transaction hash (0x followed by 64 hexadecimal characters)." });
    if (!txid && !req.file) return res.status(400).json({ error: "Submit a transaction hash or payment screenshot." });
    const [rows] = await pool.execute("SELECT id, status FROM bodyheal_payments WHERE booking_ref = ?", [ref]);
    if (!rows.length) return res.status(404).json({ error: "Booking reference not found." });
    const proof = await saveProof(req.file);
    await pool.execute("UPDATE bodyheal_payments SET txid = ?, proof_key = NULL, proof_name = COALESCE(?, proof_name), proof_mime = COALESCE(?, proof_mime), proof_data = COALESCE(?, proof_data), status = 'waiting_confirmation' WHERE booking_ref = ? AND status IN ('payment_pending','needs_review')", [txid || null, proof?.name || null, proof?.mime || null, proof?.data || null, ref]);
    res.json(await statusData(ref));
  } catch (error) { next(error); }
});
async function statusData(ref) {
  const [rows] = await pool.execute("SELECT booking_ref, status, service_name, amount_usd, destination, travel_dates, txid, proof_name, created_at, updated_at FROM bodyheal_payments WHERE booking_ref = ?", [ref]);
  if (!rows.length) return null;
  const row = rows[0];
  return { bookingRef: row.booking_ref, status: row.status, service: row.service_name, amount: Number(row.amount_usd), destination: row.destination, travelDates: row.travel_dates, currency: "USDT", createdAt: row.created_at, updatedAt: row.updated_at, txid: row.txid, proofSubmitted: Boolean(row.proof_name) };
}
app.get("/api/bookings/:ref/status", async (req, res, next) => {
  try { await ensureSchema(); const data = await statusData(cleanText(req.params.ref, 16).toUpperCase()); return data ? res.json(data) : res.status(404).json({ error: "Booking reference not found." }); }
  catch (error) { next(error); }
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
    await ensureSchema();
    const [rows] = await pool.query("SELECT booking_ref, status, service_name, amount_usd, destination, travel_dates, customer_name, phone, note, txid, proof_name, proof_data IS NOT NULL AS proof_submitted, created_at, updated_at FROM bodyheal_payments ORDER BY created_at DESC LIMIT 200");
    const bookings = rows.map((row) => ({ bookingRef: row.booking_ref, status: row.status, service: row.service_name, amount: Number(row.amount_usd), destination: row.destination, travelDates: row.travel_dates, name: row.customer_name, phone: row.phone, note: row.note, txid: row.txid, proofName: row.proof_name, proofUrl: row.proof_submitted ? `/api/admin/bookings/${encodeURIComponent(row.booking_ref)}/proof` : null, createdAt: row.created_at }));
    res.json({ bookings });
  } catch (error) { next(error); }
});
app.get("/api/admin/bookings/:ref/proof", requireAdmin, async (req, res, next) => {
  try {
    await ensureSchema();
    const [rows] = await pool.execute("SELECT proof_mime, proof_data FROM bodyheal_payments WHERE booking_ref = ?", [cleanText(req.params.ref, 16).toUpperCase()]);
    if (!rows.length || !rows[0].proof_data) return res.status(404).json({ error: "Payment screenshot not found." });
    res.setHeader("Content-Type", rows[0].proof_mime || "application/octet-stream");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(rows[0].proof_data);
  } catch (error) { next(error); }
});
app.patch("/api/admin/bookings/:ref/status", requireAdmin, async (req, res, next) => {
  try {
    await ensureSchema();
    const status = req.body.status;
    if (!["successful", "needs_review"].includes(status)) return res.status(400).json({ error: "Unsupported status." });
    const [result] = await pool.execute("UPDATE bodyheal_payments SET status = ?, reviewed_at = NOW() WHERE booking_ref = ? AND status <> 'successful'", [status, cleanText(req.params.ref, 16).toUpperCase()]);
    if (!result.affectedRows) return res.status(404).json({ error: "Booking not found or already confirmed." });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

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
