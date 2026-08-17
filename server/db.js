// db.js
// Postgres connection (Neon or any standard Postgres host) + one-time
// table setup. Falls back gracefully with a clear error if DATABASE_URL
// isn't set, so the rest of the app can still tell you what's wrong.

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn(
    "WARNING: DATABASE_URL not set - user accounts will fail. Add it to server/.env"
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Neon and most hosted Postgres
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log("Database ready (users table checked/created).");
}

module.exports = { pool, initDb };