// socketHandlers.js
// All real-time game logic lives here. The server is authoritative:
// clients never see correct answers before reveal, and timing is
// always measured server-side, never trusted from the client.

const {
  createPool,
  getPool,
  deletePool,
  addPlayer,
  removePlayer,
  totalPot,
  publicPlayerList,
  scoreAnswer,
  settlePool,
} = require("./poolManager");
const { generateQuestions } = require("./aiQuestions");

function registerSocketHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("host:create_pool", ({ topic, entryStake, questionCount, timeLimitSec }, ack) => {
      const pool = createPool({
        hostSocketId: socket.id,
        topic,
        entryStake,
        questionCount: questionCount || 5,
        timeLimitSec: timeLimitSec || 20,
      });
      socket.join(pool.code);
      ack?.({ ok: true, code: pool.code });
    });

    socket.on("player:join", ({ code, name, stakeAmount }, ack) => {
      const pool = getPool(code);
      if (!pool) return ack?.({ ok: false, error: "Pool not found" });
      if (pool.status !== "open") return ack?.({ ok: false, error: "Pool already started" });

      addPlayer(pool, socket.id, name, stakeAmount);
      socket.join(pool.code);

      io.to(pool.code).emit("pool:player_joined", {
        players: publicPlayerList(pool),
        pot: totalPot(pool),
      });
      ack?.({ ok: true });
    });

    socket.on("host:start_game", async ({ code }, ack) => {
      const pool = getPool(code);
      if (!pool) return ack?.({ ok: false, error: "Pool not found" });
      if (pool.hostSocketId !== socket.id) return ack?.({ ok: false, error: "Not the host" });
      if (pool.players.size < 2) return ack?.({ ok: false, error: "Need at least 2 players" });

      try {
        io.to(pool.code).emit("pool:generating_questions");
        pool.questions = await generateQuestions(pool.topic, pool.questionCount);
        pool.status = "in_progress";
        pool.currentQuestionIndex = -1;
        ack?.({ ok: true });
        advanceToNextQuestion(io, pool);
      } catch (err) {
        console.error("Failed to generate questions:", err.message);
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
      for (const [code, pool] of require("./poolManager").pools.entries()) {
        if (pool.players.has(socket.id)) {
          removePlayer(pool, socket.id);
          io.to(code).emit("pool:player_joined", {
            players: publicPlayerList(pool),
            pot: totalPot(pool),
          });
        }
        if (pool.hostSocketId === socket.id && pool.status === "open") {
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
}

module.exports = { registerSocketHandlers };