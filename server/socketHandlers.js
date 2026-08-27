// socketHandlers.js
// All real-time game logic lives here. The server is authoritative:
// clients never see correct answers before reveal, and timing is
// always measured server-side, never trusted from the client.

const {
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
  SETTLED_POOL_TTL_MS,
} = require("./poolManager");
const { generateQuestions } = require("./aiQuestions");

const MIN_ENTRY_STAKE = 1;
const MAX_ENTRY_STAKE = 100000;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 25;
const MIN_TIME_LIMIT_SEC = 5;
const MAX_TIME_LIMIT_SEC = 120;
const MAX_TOPIC_LENGTH = 200;

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("host:create_pool", ({ topic, entryStake, questionCount, timeLimitSec }, ack) => {
      const trimmedTopic = typeof topic === "string" ? topic.trim().slice(0, MAX_TOPIC_LENGTH) : "";
      if (!trimmedTopic) return ack?.({ ok: false, error: "Topic is required" });

      const pool = createPool({
        hostSocketId: socket.id,
        topic: trimmedTopic,
        entryStake: clamp(entryStake, MIN_ENTRY_STAKE, MAX_ENTRY_STAKE, MIN_ENTRY_STAKE),
        questionCount: clamp(questionCount, MIN_QUESTION_COUNT, MAX_QUESTION_COUNT, 5),
        timeLimitSec: clamp(timeLimitSec, MIN_TIME_LIMIT_SEC, MAX_TIME_LIMIT_SEC, 20),
      });
      socket.join(pool.code);
      ack?.({ ok: true, code: pool.code });
    });

    socket.on("player:join", ({ code, name }, ack) => {
      const pool = getPool(code);
      if (!pool) return ack?.({ ok: false, error: "Pool not found" });
      if (pool.status !== "open") return ack?.({ ok: false, error: "Pool already started" });

      const trimmedName = typeof name === "string" ? name.trim().slice(0, 40) : "";
      if (!trimmedName) return ack?.({ ok: false, error: "Name is required" });
      const nameTaken = Array.from(pool.players.values()).some(
        (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (nameTaken) return ack?.({ ok: false, error: "That name is already taken in this pool" });

      const player = addPlayer(pool, socket.id, trimmedName);
      socket.join(pool.code);

      io.to(pool.code).emit("pool:player_joined", {
        players: publicPlayerList(pool),
        pot: totalPot(pool),
      });
      ack?.({ ok: true, playerId: player.id });
    });

    socket.on("host:start_game", async ({ code }, ack) => {
      const pool = getPool(code);
      if (!pool) return ack?.({ ok: false, error: "Pool not found" });
      if (pool.hostSocketId !== socket.id) return ack?.({ ok: false, error: "Not the host" });
      if (pool.status !== "open") return ack?.({ ok: false, error: "Game already started" });
      if (pool.players.size < 2) return ack?.({ ok: false, error: "Need at least 2 players" });

      // Mark the pool as busy immediately so a second start_game call (double
      // click, retry) can't slip in while question generation is in flight.
      pool.status = "starting";

      try {
        io.to(pool.code).emit("pool:generating_questions");
        pool.questions = await generateQuestions(pool.topic, pool.questionCount);
        pool.status = "in_progress";
        pool.currentQuestionIndex = -1;
        ack?.({ ok: true });
        advanceToNextQuestion(io, pool);
      } catch (err) {
        console.error("Failed to generate questions:", err.message);
        pool.status = "open";
        ack?.({ ok: false, error: "Could not generate questions, try again" });
      }
    });

    socket.on("player:submit_answer", ({ code, choiceIndex }) => {
      const pool = getPool(code);
      if (!pool || pool.status !== "in_progress") return;

      const player = pool.players.get(socket.id);
      if (!player) return;

      const qIndex = pool.currentQuestionIndex;
      if (player.answers.has(qIndex)) return;

      const answeredAt = Date.now();
      player.answers.set(qIndex, { choiceIndex, answeredAt });

      const answeredCount = Array.from(pool.players.values()).filter((p) =>
        p.answers.has(qIndex)
      ).length;

      io.to(pool.code).emit("pool:answer_progress", {
        answeredCount,
        totalPlayers: pool.players.size,
      });

      if (answeredCount === pool.players.size) {
        clearTimeout(pool.questionTimer);
        closeQuestion(io, pool);
      }
    });

    socket.on("disconnect", () => {
      for (const [code, pool] of pools.entries()) {
        if (pool.players.has(socket.id)) {
          removePlayer(pool, socket.id);
          io.to(code).emit("pool:player_joined", {
            players: publicPlayerList(pool),
            pot: totalPot(pool),
          });
        }
        if (pool.hostSocketId === socket.id && (pool.status === "open" || pool.status === "starting")) {
          io.to(code).emit("pool:host_left");
          deletePool(code);
        }
      }
    });
  });
}

function advanceToNextQuestion(io, pool) {
  pool.currentQuestionIndex++;

  if (pool.currentQuestionIndex >= pool.questions.length) {
    return endGame(io, pool);
  }

  const question = pool.questions[pool.currentQuestionIndex];
  pool.questionStartedAt = Date.now();

  io.to(pool.code).emit("pool:question_started", {
    index: pool.currentQuestionIndex,
    total: pool.questions.length,
    question: question.question,
    choices: question.choices,
    timeLimitSec: pool.timeLimitSec,
  });

  pool.questionTimer = setTimeout(() => {
    closeQuestion(io, pool);
  }, pool.timeLimitSec * 1000);
}

function closeQuestion(io, pool) {
  const qIndex = pool.currentQuestionIndex;
  const question = pool.questions[qIndex];

  for (const player of pool.players.values()) {
    const answer = player.answers.get(qIndex);
    if (!answer) continue;
    const isCorrect = answer.choiceIndex === question.correctIndex;
    const points = scoreAnswer({ isCorrect });
    player.score += points;
  }

  io.to(pool.code).emit("pool:reveal", {
    index: qIndex,
    correctIndex: question.correctIndex,
    leaderboard: publicPlayerList(pool).sort((a, b) => b.score - a.score),
  });

  setTimeout(() => advanceToNextQuestion(io, pool), 4000);
}

function endGame(io, pool) {
  pool.status = "settled";
  const result = settlePool(pool);
  io.to(pool.code).emit("pool:game_ended", {
    pot: result.pot,
    winners: result.winners,
    finalLeaderboard: publicPlayerList(pool).sort((a, b) => b.score - a.score),
  });

  // Settled pools otherwise sit in memory forever - sweep this one after
  // clients have had a chance to see the final results.
  setTimeout(() => deletePool(pool.code), SETTLED_POOL_TTL_MS);
}

module.exports = { registerSocketHandlers };