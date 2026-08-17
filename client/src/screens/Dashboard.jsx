import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getCurrentUser, logout } from "../auth";

const RECENT_TOPICS_KEY = "triviaPool.recentTopics";

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

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    setRecentTopics(loadRecentTopics());
  }, [user, navigate]);

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
            📊 Reports
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
            <p className="subtitle">All topics you've hosted before, saved on this device. Remove ones you don't want anymore.</p>
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
            <h2>Reports</h2>
            <p className="subtitle">Post-game history and results — coming soon.</p>
            <div className="dash-empty-state">
              <div className="dash-empty-icon">📊</div>
              <p>Once you host some games, results will show up here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}