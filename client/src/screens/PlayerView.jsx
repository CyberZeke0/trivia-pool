import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { socket } from "../socket";
import { playTick, playCorrect, playWrong, playGameStart, playWinnerFanfare } from "../soundEffects";
import AnimatedNumber from "../components/AnimatedNumber";
import LoadingScreen from "../components/LoadingScreen";

const SHAPE_ICONS = ["▲", "◆", "●", "■"];

// Groups the sorted leaderboard into up to 3 podium tiers, keeping
// players with equal scores together in the same tier instead of
// splitting a tie across two different podium places.
function getPodiumTiers(leaderboard) {
  const tiers = [];
  let i = 0;
  while (i < leaderboard.length && tiers.length < 3) {
    const score = leaderboard[i].score;
    const group = [];
    while (i < leaderboard.length && leaderboard[i].score === score) {
      group.push(leaderboard[i]);
      i++;
    }
    tiers.push(group);
  }
  return tiers;
}

export default function PlayerView() {
  const [searchParams] = useSearchParams();
  const [stage, setStage] = useState("join");
  const [code, setCode] = useState(searchParams.get("code") || "");
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [error, setError] = useState("");

  const [players, setPlayers] = useState([]);
  const [pot, setPot] = useState(0);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);
  const selectedRef = useRef(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    socket.on("pool:player_joined", ({ players, pot }) => {
      setPlayers(players);
      setPot(pot);
    });
    socket.on("pool:generating_questions", () => {
      setStage("generating");
      playGameStart();
    });
    socket.on("pool:question_started", (q) => {
      setStage("playing");
      setQuestion(q);
      setSelected(null);
      setReveal(null);
      startCountdown(q.timeLimitSec);
    });
    socket.on("pool:reveal", (data) => {
      clearInterval(timerRef.current);
      setStage("reveal");
      setReveal(data);
      const wasCorrect = selectedRef.current === data.correctIndex;
      if (wasCorrect) playCorrect(); else playWrong();
    });
    socket.on("pool:game_ended", (data) => {
      setStage("ended");
      setFinalResult(data);
      playWinnerFanfare();
    });
    socket.on("pool:host_left", () => setError("Host left, pool closed"));

    return () => {
      clearInterval(timerRef.current);
      socket.off("pool:player_joined");
      socket.off("pool:generating_questions");
      socket.off("pool:question_started");
      socket.off("pool:reveal");
      socket.off("pool:game_ended");
      socket.off("pool:host_left");
    };
  }, []);

  function startCountdown(seconds) {
    setTimeLeft(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        playTick();
        return prev - 1;
      });
    }, 1000);
  }

  function joinPool() {
    if (!code.trim() || !name.trim()) return setError("Enter code and name");
    socket.emit("player:join", { code, name }, (res) => {
      if (!res.ok) return setError(res.error);
      setPlayerId(res.playerId);
      setStage("lobby");
    });
  }

  function submitAnswer(choiceIndex) {
    if (selected !== null) return;
    setSelected(choiceIndex);
    socket.emit("player:submit_answer", { code, choiceIndex });
  }

  if (stage === "join") {
    return (
      <div className="screen center">
        <div className="setup-card">
          <h2>Join a Pool</h2>
          <div className="field-group full-width">
            <label>Pool code</label>
            <input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="field-group full-width">
            <label>Your name</label>
            <input placeholder="e.g. Alex" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn" onClick={joinPool}>Join</button>
        </div>
      </div>
    );
  }

  if (stage === "lobby") {
    return (
      <div className="screen center">
        <h2>Waiting for host to start...</h2>
        <p>Pot so far: {pot}</p>
        <ul>{players.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}</ul>
      </div>
    );
  }

  if (stage === "generating") {
    return <LoadingScreen title="Building your quiz..." />;
  }

  if (stage === "playing" && question) {
    return (
      <div className="screen center pop-in">
        <div className="progress-dots">
          {Array.from({ length: question.total }).map((_, i) => (
            <span key={i} className={`dot ${i <= question.index ? "dot-filled" : ""}`} />
          ))}
        </div>
        <p className="question-label">Question {question.index + 1} of {question.total}</p>

        <div className="question-card">
          <h2>{question.question}</h2>
          <div className="timer-row">
            <div className="timer-bar-track">
              <div
                className="timer-bar-fill"
                style={{ width: `${(timeLeft / question.timeLimitSec) * 100}%` }}
              />
            </div>
            <div className="timer-number">{timeLeft}</div>
          </div>
        </div>

        <div className="choices-grid">
          {question.choices.map((c, i) => (
            <button
              key={i}
              className={`choice-btn shape-${i} ${selected === i ? "selected" : ""}`}
              disabled={selected !== null}
              onClick={() => submitAnswer(i)}
            >
              <span className="shape-icon">{SHAPE_ICONS[i]}</span>
              {c}
            </button>
          ))}
        </div>
        {selected !== null && <p>Answer locked in!</p>}
      </div>
    );
  }

  if (stage === "reveal" && reveal) {
    const wasCorrect = selected === reveal.correctIndex;
    return (
      <div className="screen center pop-in">
        <h1>{wasCorrect ? "✅ Correct!" : "❌ Not quite"}</h1>
        <div className="choices-grid">
          {question.choices.map((c, i) => (
            <div
              key={i}
              className={`choice-card shape-${i} ${i === reveal.correctIndex ? "correct-choice" : "dim-choice"}`}
            >
              <span className="shape-icon">{SHAPE_ICONS[i]}</span>
              {c}
              {i === reveal.correctIndex && <span className="check-mark">✓</span>}
            </div>
          ))}
        </div>

        <div className="leaderboard-card">
          <h3>Leaderboard</h3>
          <ol className="rank-list">
            {reveal.leaderboard.map((p, i) => (
              <li key={p.id} className={`rank-row ${p.id === playerId ? "rank-row-me" : ""}`}>
                <span className="rank-number">{i + 1}</span>
                <span className="rank-name">{p.name}</span>
                <span className="rank-score"><AnimatedNumber value={p.score} /> pts</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  if (stage === "ended" && finalResult) {
    const iWon = finalResult.winners.some((w) => w.id === playerId);
    const [firstTier, secondTier, thirdTier] = getPodiumTiers(finalResult.finalLeaderboard);
    return (
      <div className="screen center pop-in">
        {iWon && (
          <div className="confetti-layer">
            {Array.from({ length: 30 }).map((_, i) => (
              <span key={i} className={`confetti-piece confetti-${i % 4}`} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.3}s` }} />
            ))}
          </div>
        )}

        <h1>{iWon ? "🎉 You won the pot!" : "Game over"}</h1>
        <div className="pot-banner">Pot: <strong>{finalResult.pot}</strong></div>

        <div className="podium">
          {secondTier?.length > 0 && (
            <div className="podium-place podium-2">
              <div className="podium-name">{secondTier.map((p) => p.name).join(" & ")}</div>
              <div className="podium-block">🥈</div>
            </div>
          )}
          {firstTier?.length > 0 && (
            <div className="podium-place podium-1">
              <div className="crown">👑</div>
              <div className="podium-name">{firstTier.map((p) => p.name).join(" & ")}</div>
              <div className="podium-block">🥇</div>
            </div>
          )}
          {thirdTier?.length > 0 && (
            <div className="podium-place podium-3">
              <div className="podium-name">{thirdTier.map((p) => p.name).join(" & ")}</div>
              <div className="podium-block">🥉</div>
            </div>
          )}
        </div>

        <div className="winner-banner">
          {finalResult.winners.map((w) => <p key={w.id}><strong>{w.name}</strong> wins <strong>{w.payout}</strong></p>)}
        </div>

        <div className="leaderboard-card">
          <h3>Final Leaderboard</h3>
          <ol className="rank-list">
            {finalResult.finalLeaderboard.map((p, i) => (
              <li key={p.id} className={`rank-row ${p.id === playerId ? "rank-row-me" : ""}`}>
                <span className="rank-number">{i + 1}</span>
                <span className="rank-name">{p.name}</span>
                <span className="rank-score"><AnimatedNumber value={p.score} /> pts</span>
              </li>
            ))}
          </ol>
        </div>

        <button className="btn" onClick={() => (window.location.href = "/")}>Play Again</button>
      </div>
    );
  }

  return <div className="screen center">Loading...</div>;
}