// db.js
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.warn(
    "WARNING: DATABASE_URL not set - user accounts will fail. Add it to server/.env"
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_results (
      id SERIAL PRIMARY KEY,
      player_name TEXT NOT NULL,
      player_email TEXT,
      topic TEXT NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      won BOOLEAN DEFAULT FALSE,
      payout INTEGER DEFAULT 0,
      pot INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  console.log("Database ready (users table checked/created).");
}

async function saveGameResults(results) {
  const { topic, pot, finalLeaderboard, winners } = results;
  const winnerNames = winners.map((w) => w.name);

  for (const player of finalLeaderboard) {
    const won = winnerNames.includes(player.name);
    const winner = winners.find((w) => w.name === player.name);
    const payout = winner ? parseInt(winner.payout) || 0 : 0;

    await pool.query(
      `INSERT INTO game_results 
        (player_name, topic, score, total_questions, won, payout, pot)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [player.name, topic, player.score, finalLeaderboard.length, won, payout, pot]
    );
  }
}

async function getPlayerStats(playerName) {
  const result = await pool.query(
    `SELECT 
      COUNT(*) as total_games,
      SUM(CASE WHEN won THEN 1 ELSE 0 END) as total_wins,
      SUM(payout) as total_earnings,
      MAX(score) as best_score,
      AVG(score)::INTEGER as avg_score
     FROM game_results 
     WHERE player_name = $1`,
    [playerName]
  );
  return result.rows[0];
}

async function getPlayerHistory(playerName) {
  const result = await pool.query(
    `SELECT topic, score, total_questions, won, payout, pot, created_at
     FROM game_results 
     WHERE player_name = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [playerName]
  );
  return result.rows;
}

module.exports = { pool, initDb, saveGameResults, getPlayerStats, getPlayerHistory };