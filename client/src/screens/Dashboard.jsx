import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getCurrentUser, logout } from "../auth";

const RECENT_TOPICS_KEY = "triviaPool.recentTopics";
const SERVER = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

function loadRecentTopics() {
  try {
    const raw = localStorage.getItem(RECENT_TOPICS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
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

export default function Dashboard() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [recentTopics, setRecentTopics] = useState([]);
  const [activeNav, setActiveNav] = useState("home");
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    setRecentTopics(loadRecentTopics());
  }, [user, navigate]);

  useEffect(() => {
    if (activeNav === "reports" && user) {
      fetchStats();
    }
  }, [activeNav]);

  async function fetchStats() {
    setLoadingStats(true);
    try {
      const name = user.displayName;
      const [statsRes, historyRes] = await Promise.all([
        fetch(`${SERVER}/api/stats/${encodeURIComponent(name)}`),
        fetch(`${SERVER}/api/history/${encodeURIComponent(name)}`),
      ]);
      const statsData = await statsRes.json();
      const historyData = await historyRes.json();
      setStats(statsData);
      setHistory(historyData);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
    setLoadingStats(false);
  }

  function handleLogout() {
    logout();
    navigate("/");
    window.location.reload();
  }

  if (!user) return null;

  return (
    <div className="dashboard-shell">
      <aside className="dash-sidebar">
        <Link to="/" className="dash-back-link">← Back to Home</Link>
        <div className="dash-logo">🧠 Trivia Pool</div>
        <nav className="dash-nav">
          <button
            className={`dash-nav-item ${activeNav === "home" ? "dash-nav-active" : ""}`}
            onClick={() => setActiveNav("home")}
          >
            🏠 Home
          </button>
          <button
            className={`dash-nav-item ${activeNav === "library" ? "dash-nav-active" : ""}`}
            onClick={() => setActiveNav("library")}
          >
            📚 Library
          </button>
          <button
            className={`dash-nav-item ${activeNav === "reports" ? "dash-nav-active" : ""}`}
            onClick={() => setActiveNav("reports")}
          >
            📊 My Stats
          </button>
        </nav>
        <button className="dash-logout" onClick={handleLogout}>Log Out</button>
      </aside>

      <div className="dash-main">
        <header className="dash-topbar">
          <input className="dash-search" placeholder="Search your topics..." />
          <Link className="btn" to="/host">+ Create Pool</Link>
        </header>

        {activeNav === "home" && (
          <div className="dash-content">
            <h2>Welcome back, {user.displayName}</h2>
            <p className="subtitle">Jump back into hosting or joining a pool.</p>

            <div className="dash-quick-actions">
              <Link className="dash-action-card" to="/host">
                <span className="dash-action-icon">🎯</span>
                <span>Host a Pool</span>
              </Link>
              <Link className="dash-action-card" to="/play">
                <span className="dash-action-icon">🎮</span>
                <span>Join a Pool</span>
              </Link>
            </div>

            <h3 className="dash-section-title">Recent Topics</h3>
            {recentTopics.length === 0 ? (
              <p className="waiting-text">No topics yet — host a pool to start building your library.</p>
            ) : (
              <div className="dash-topic-grid">
                {recentTopics.map((t) => (
                  <div key={t} className="dash-topic-card dash-topic-card-deletable">
                    <button
                      className="dash-topic-remove"
                      onClick={() => setRecentTopics(removeRecentTopic(t))}
                      aria-label={`Remove ${t}`}
                    >
                      ×
                    </button>
                    <div className="dash-topic-icon">📝</div>
                    <div>{t}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeNav === "library" && (
          <div className="dash-content">
            <h2>Your Library</h2>
            <p className="subtitle">All topics you've hosted before, saved on this device.</p>
            {recentTopics.length === 0 ? (
              <p className="waiting-text">Your library is empty — host a pool to add your first topic.</p>
            ) : (
              <div className="dash-topic-grid">
                {recentTopics.map((t) => (
                  <div key={t} className="dash-topic-card dash-topic-card-deletable">
                    <button
                      className="dash-topic-remove"
                      onClick={() => setRecentTopics(removeRecentTopic(t))}
                      aria-label={`Remove ${t}`}
                    >
                      ×
                    </button>
                    <div className="dash-topic-icon">📝</div>
                    <div>{t}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeNav === "reports" && (
          <div className="dash-content">
            <h2>My Stats</h2>
            <p className="subtitle">Your personal game history and performance.</p>

            {loadingStats ? (
              <p className="waiting-text">Loading your stats...</p>
            ) : (
              <>
                {/* Stats cards */}
                {stats && (
                  <div className="dash-stats-grid">
                    <div className="dash-stat-card">
                      <div className="dash-stat-icon">🎮</div>
                      <div className="dash-stat-num">{stats.total_games || 0}</div>
                      <div className="dash-stat-label">Games Played</div>
                    </div>
                    <div className="dash-stat-card">
                      <div className="dash-stat-icon">🏆</div>
                      <div className="dash-stat-num">{stats.total_wins || 0}</div>
                      <div className="dash-stat-label">Total Wins</div>
                    </div>
                    <div className="dash-stat-card">
                      <div className="dash-stat-icon">💰</div>
                      <div className="dash-stat-num">{stats.total_earnings || 0}</div>
                      <div className="dash-stat-label">Total Earnings</div>
                    </div>
                    <div className="dash-stat-card">
                      <div className="dash-stat-icon">⭐</div>
                      <div className="dash-stat-num">{stats.best_score || 0}</div>
                      <div className="dash-stat-label">Best Score</div>
                    </div>
                  </div>
                )}

                {/* Game history */}
                <h3 className="dash-section-title">Game History</h3>
                {history.length === 0 ? (
                  <div className="dash-empty-state">
                    <div className="dash-empty-icon">📊</div>
                    <p>No games yet — play a game to see your history here!</p>
                  </div>
                ) : (
                  <div className="dash-history-list">
                    {history.map((game, i) => (
                      <div key={i} className="dash-history-item">
                        <div className="dash-history-left">
                          <div className="dash-history-icon">
                            {game.won ? '🏆' : '🎮'}
                          </div>
                          <div>
                            <div className="dash-history-topic">{game.topic}</div>
                            <div className="dash-history-date">
                              {new Date(game.created_at).toLocaleDateString('en-NG', {
                                day: 'numeric', month: 'short', year: 'numeric',
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="dash-history-right">
                          <div className="dash-history-score">{game.score} pts</div>
                          {game.won && (
                            <div className="dash-history-win">Won {game.payout}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}