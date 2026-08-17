import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { playTick, playGameStart, playWinnerFanfare } from "../soundEffects";
import AnimatedNumber from "../components/AnimatedNumber";
import LoadingScreen from "../components/LoadingScreen";
import { getCurrentUser } from "../auth";

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
const RECENT_TOPICS_KEY = "triviaPool.recentTopics";
const MAX_RECENT_TOPICS = 8;

function loadRecentTopics() {
  try {
    const raw = localStorage.getItem(RECENT_TOPICS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentTopic(topic) {
  try {
    const existing = loadRecentTopics().filter(
      (t) => t.toLowerCase() !== topic.toLowerCase()
    );
    const updated = [topic, ...existing].slice(0, MAX_RECENT_TOPICS);
    localStorage.setItem(RECENT_TOPICS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return loadRecentTopics();
  }
}

function removeRecentTopic(topic) {
  try {
    const updated = loadRecentTopics().filter((t) => t !== topic);
    localStorage.setItem(RECENT_TOPICS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return loadRecentTopics();
  }
}

export default function HostView() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("setup");
  const [topic, setTopic] = useState("");
  const [entryStake, setEntryStake] = useState(10);
  const [questionCount, setQuestionCount] = useState(5);
  const [code, setCode] = useState(null);
  const [players, setPlayers] = useState([]);
  const [pot, setPot] = useState(0);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [recentTopics, setRecentTopics] = useState([]);

  const [question, setQuestion] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [reveal, setReveal] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!getCurrentUser()) {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    setRecentTopics(loadRecentTopics());
  }, []);

  useEffect(() => {
    socket.on("pool:player_joined", ({ players, pot }) => {
      setPlayers(players);
      setPot(pot);
    });
    socket.on("pool:generating_questions", () => setGenerating(true));
    socket.on("pool:question_started", (q) => {
      setGenerating(false);
      setStage("playing");
      setQuestion(q);
      setAnsweredCount(0);
      setReveal(null);
      playGameStart();
      startCountdown(q.timeLimitSec);
    });
    socket.on("pool:answer_progress", ({ answeredCount }) => setAnsweredCount(answeredCount));
    socket.on("pool:reveal", (data) => {
      clearInterval(timerRef.current);
      setStage("reveal");
      setReveal(data);
    });
    socket.on("pool:game_ended", (data) => {
      setStage("ended");
      setFinalResult(data);
      playWinnerFanfare();
    });

    return () => {
      clearInterval(timerRef.current);
      socket.off("pool:player_joined");
      socket.off("pool:generating_questions");
      socket.off("pool:question_started");
      socket.off("pool:answer_progress");
      socket.off("pool:reveal");
      socket.off("pool:game_ended");
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

  function createPool() {
    if (!topic.trim()) return setError("Enter a topic");
    socket.emit(
      "host:create_pool",
      { topic, entryStake, questionCount, timeLimitSec: 20 },
      (res) => {
        if (!res.ok) return setError(res.error);
        setRecentTopics(saveRecentTopic(topic.trim()));
        setCode(res.code);
        setStage("lobby");
      }
    );
  }

  function startGame() {
    socket.emit("host:start_game", { code }, (res) => {
      if (!res.ok) setError(res.error);
    });
  }

  if (stage === "setup") {
    return (
      <div className="screen center">
        <Link to="/" className="back-home-link">← Back to Home</Link>
        <div className="setup-card">
          <h2>Host a Pool</h2>
          <p className="subtitle">Set your topic and stake, then invite players to join.</p>

          <div className="field-group full-width">
            <label>Topic</label>
            <input placeholder="e.g. 90s movies" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>

          {recentTopics.length > 0 && (
            <div className="recent-topics">
              <p className="recent-topics-label">Recent topics</p>
              <div className="topic-chip-grid">
                {recentTopics.map((t) => (
                  <span key={t} className="topic-chip-wrap">
                    <button className="topic-chip" onClick={() => setTopic(t)}>
                      {t}
                    </button>
                    <button
                      className="topic-chip-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecentTopics(removeRecentTopic(t));
                      }}
                      aria-label={`Remove ${t}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="field-row">
            <div className="field-group">
              <label>Entry stake per player</label>
              <div className="number-stepper">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setEntryStake((v) => Math.max(1, v - 1))}
                  aria-label="Decrease entry stake"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={entryStake}
                  onChange={(e) => setEntryStake(Math.max(1, Number(e.target.value) || 1))}
                />
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setEntryStake((v) => v + 1)}
                  aria-label="Increase entry stake"
                >
                  +
                </button>
              </div>
            </div>
            <div className="field-group">
              <label>Number of questions</label>
              <div className="number-stepper">
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setQuestionCount((v) => Math.max(1, v - 1))}
                  aria-label="Decrease number of questions"
                >
                  −
                </button>
                <input
                  type="number"
                  min="1"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(1, Number(e.target.value) || 1))}
                />
                <button
                  type="button"
                  className="stepper-btn"
                  onClick={() => setQuestionCount((v) => v + 1)}
                  aria-label="Increase number of questions"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {error && <p className="error">{error}</p>}
          <button className="btn" onClick={createPool}>Create Pool</button>
        </div>
      </div>
    );
  }

  if (stage === "lobby" && generating) {
    return <LoadingScreen title="Building your quiz..." />;
  }

  if (stage === "lobby") {
    return (
      <div className="screen center">
        <div className="lobby-card">
          <p className="subtitle">Players join at /play with this code</p>
          <div className="pin">{code}</div>

          <div className="lobby-status">
            <span>Pot: <strong>{pot}</strong></span>
            <span>•</span>
            <span>Players: <strong>{players.length}</strong></span>
          </div>

          <div className="player-chip-grid">
            {players.length === 0 && <p className="waiting-text">Waiting for players to join...</p>}
            {players.map((p) => (
              <div key={p.name} className="player-chip">{p.name}</div>
            ))}
          </div>

          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={players.length < 2 || generating} onClick={startGame}>
            Start Game
          </button>
        </div>
      </div>
    );
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
          <h1>{question.question}</h1>
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
            <div key={i} className={`choice-card shape-${i}`}>
              <span className="shape-icon">{SHAPE_ICONS[i]}</span>
              {c}
            </div>
          ))}
        </div>
        <p className="answered-count">{answeredCount} / {players.length} answered</p>
      </div>
    );
  }

  if (stage === "reveal" && reveal) {
    return (
      <div className="screen center pop-in">
        <h2>Correct answer</h2>
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
              <li key={p.name} className="rank-row">
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
    const [firstTier, secondTier, thirdTier] = getPodiumTiers(finalResult.finalLeaderboard);
    return (
      <div className="screen center pop-in">
        <div className="confetti-layer">
          {Array.from({ length: 30 }).map((_, i) => (
            <span key={i} className={`confetti-piece confetti-${i % 4}`} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.3}s` }} />
          ))}
        </div>

        <h1>🏆 Winner takes it all</h1>
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
          {finalResult.winners.map((w) => (
            <p key={w.name}><strong>{w.name}</strong> wins <strong>{w.payout}</strong> ({w.score} pts)</p>
          ))}
        </div>

        <div className="leaderboard-card">
          <h3>Final Leaderboard</h3>
          <ol className="rank-list">
            {finalResult.finalLeaderboard.map((p, i) => (
              <li key={p.name} className="rank-row">
                <span className="rank-number">{i + 1}</span>
                <span className="rank-name">{p.name}</span>
                <span className="rank-score"><AnimatedNumber value={p.score} /> pts</span>
              </li>
            ))}
          </ol>
        </div>

        <button className="btn" onClick={() => (window.location.href = "/")}>Host Another Pool</button>
      </div>
    );
  }

  return <div className="screen center">Loading...</div>;
}