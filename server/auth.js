// auth.js
// User accounts now persist in Postgres (see db.js) instead of server
// memory - accounts survive restarts, unlike pools which are still
// intentionally in-memory since a game session doesn't need to persist.

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("./db");

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. Add it to server/.env before starting the server."
  );
}
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = "7d";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function signup({ email, password, displayName }) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isValidEmail(normalizedEmail)) {
    throw new Error("Enter a valid email address");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const existing = await pool.query("SELECT 1 FROM users WHERE email = $1", [
    normalizedEmail,
  ]);
  if (existing.rows.length > 0) {
    throw new Error("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const finalDisplayName = displayName?.trim() || normalizedEmail.split("@")[0];

  await pool.query(
    "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3)",
    [normalizedEmail, passwordHash, finalDisplayName]
  );

  return issueToken({ email: normalizedEmail, displayName: finalDisplayName });
}

async function login({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    "SELECT email, password_hash, display_name FROM users WHERE email = $1",
    [normalizedEmail]
  );
  const user = result.rows[0];

  if (!user) {
    throw new Error("Invalid email or password");
  }
  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    throw new Error("Invalid email or password");
  }

  return issueToken({ email: user.email, displayName: user.display_name });
}

// Simple reset: no email verification since there's no email infrastructure
// yet. Anyone who knows the account's email can set a new password. Fine
// for a prototype with low-stakes accounts - not for production.
async function resetPassword({ email, newPassword }) {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query(
    "SELECT email, display_name FROM users WHERE email = $1",
    [normalizedEmail]
  );
  const user = result.rows[0];

  if (!user) {
    throw new Error("No account found with this email");
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.query("UPDATE users SET password_hash = $1 WHERE email = $2", [
    passwordHash,
    normalizedEmail,
  ]);

  return issueToken({ email: user.email, displayName: user.display_name });
}

function issueToken(user) {
  const token = jwt.sign(
    { email: user.email, displayName: user.displayName },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
  return { token, user: { email: user.email, displayName: user.displayName } };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const payload = token ? verifyToken(token) : null;

  if (!payload) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  req.user = payload;
  next();
}

module.exports = { signup, login, resetPassword, verifyToken, requireAuth };