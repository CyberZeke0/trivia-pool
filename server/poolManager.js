// poolManager.js
// Holds all active pools in memory. Fine for a single server instance / MVP.
// If you scale to multiple server processes later, move this to Redis.

const pools = new Map(); // code -> Pool

function generateCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (pools.has(code));
  return code;
}

function createPool({ hostSocketId, topic, entryStake, questionCount = 5, timeLimitSec = 20 }) {
  const code = generateCode();
  const pool = {
    code,
    hostSocketId,
    topic,
    entryStake: Number(entryStake) || 0,
    questionCount,
    timeLimitSec,
    status: "open",
    players: new Map(),
    spectators: new Set(),
    questions: [],
    currentQuestionIndex: -1,
    questionStartedAt: null,
    questionTimer: null,
  };
  pools.set(code, pool);
  return pool;
}

function getPool(code) {
  return pools.get(code);
}

function deletePool(code) {
  const pool = pools.get(code);
  if (pool?.questionTimer) clearTimeout(pool.questionTimer);
  pools.delete(code);
}

function addPlayer(pool, socketId, name, stakeAmount) {
  pool.players.set(socketId, {
    socketId,
    name,
    stakeAmount: Number(stakeAmount) || pool.entryStake,
    score: 0,
    answers: new Map(),
  });
}

function removePlayer(pool, socketId) {
  pool.players.delete(socketId);
}

function totalPot(pool) {
  let total = 0;
  for (const p of pool.players.values()) total += p.stakeAmount;
  return total;
}

function publicPlayerList(pool) {
  return Array.from(pool.players.values()).map((p) => ({
    name: p.name,
    score: p.score,
  }));
}

function scoreAnswer({ isCorrect, basePoints = 1000 }) {
  return isCorrect ? basePoints : 0;
}

function settlePool(pool) {
  pool.status = "settled";
  const pot = totalPot(pool);
  let highScore = -1;
  for (const p of pool.players.values()) {
    if (p.score > highScore) highScore = p.score;
  }
  const winners = Array.from(pool.players.values()).filter((p) => p.score === highScore);
  const splitAmount = winners.length > 0 ? pot / winners.length : 0;
  return {
    pot,
    winners: winners.map((w) => ({ socketId: w.socketId, name: w.name, score: w.score, payout: splitAmount })),
  };
}

module.exports = {
  pools,
  createPool,
  getPool,
  deletePool,
  addPlayer,
  removePlayer,
  totalPot,
  publicPlayerList,
  scoreAnswer,
  settlePool,
};