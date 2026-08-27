require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");
const { registerSocketHandlers } = require("./socketHandlers");
const { signup, login, resetPassword, requireAuth } = require("./auth");
const { initDb } = require("./db");

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

// Auth endpoints are brute-forceable (login guesses passwords, reset-password
// takes over an account with just its email) - cap attempts per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later" },
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/api/signup", authLimiter, async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    const result = await signup({ email, password, displayName });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await login({ email, password });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/reset-password", authLimiter, async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const result = await resetPassword({ email, newPassword });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" },
});

registerSocketHandlers(io);

const PORT = process.env.PORT || 4000;

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Trivia pool server running on http://localhost:${PORT}`);
      if (!process.env.ANTHROPIC_API_KEY) {
        console.warn("WARNING: ANTHROPIC_API_KEY not set - question generation will fail. Copy .env.example to .env and add your key.");
      }
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err.message);
    process.exit(1);
  });