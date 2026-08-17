import { Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { getCurrentUser, logout } from "../auth";
import { useLanguage } from "../LanguageContext";
import { LANGUAGES } from "../i18n";

export default function Home() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [pin, setPin] = useState("");
  const { language, setLanguage, t } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const langWrapRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileWrapRef = useRef(null);

  useEffect(() => {
    if (!langOpen) return;

    function handleClickOutside(e) {
      if (langWrapRef.current && !langWrapRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [langOpen]);

  useEffect(() => {
    if (!profileOpen) return;

    function handleClickOutside(e) {
      if (profileWrapRef.current && !profileWrapRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileOpen]);

  function handleLogout() {
    logout();
    navigate("/");
    window.location.reload();
  }

  function handlePinEnter() {
    if (!pin.trim()) return;
    navigate(`/play?code=${pin.trim()}`);
  }

  return (
    <div className="jungle-page">
      <nav className="jungle-nav">
        <div className="jungle-logo">🌱 Trivia <span className="jungle-logo-accent">Pool</span></div>
        <div className="jungle-nav-links">
          <Link className="jungle-nav-link" to="/host">{t("host")}</Link>
          <Link className="jungle-nav-link jungle-nav-active" to="/play">{t("join")}</Link>
          {user && <Link className="jungle-nav-link" to="/dashboard">{t("dashboard")}</Link>}
        </div>
        <div className="jungle-nav-right">
          <div className="lang-selector-wrap" ref={langWrapRef}>
            <button className="jungle-lang-btn" onClick={() => setLangOpen((o) => !o)}>
              🌐 {language} ▾
            </button>
            {langOpen && (
              <div className="lang-dropdown">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    className={`lang-option ${language === l.code ? "lang-option-active" : ""}`}
                    onClick={() => {
                      setLanguage(l.code);
                      setLangOpen(false);
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {user ? (
            <div className="profile-dropdown-wrap" ref={profileWrapRef}>
              <button
                className="jungle-avatar"
                onClick={() => setProfileOpen((o) => !o)}
                title={user.displayName}
              >
                🌱
              </button>
              {profileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-header">
                    <div className="profile-avatar-large">🌱</div>
                    <div>
                      <div className="profile-name">{user.displayName}</div>
                      <div className="profile-email">{user.email}</div>
                    </div>
                  </div>

                  <div className="profile-balance-card">
                    <div className="profile-balance-label">Balance</div>
                    <div className="profile-balance-amount">0 credits</div>
                    <div className="profile-balance-note">No real money yet, placeholder only</div>
                  </div>

                  <div className="profile-actions-row">
                    <button className="profile-action-btn" disabled>Deposit</button>
                    <button className="profile-action-btn" disabled>Withdraw</button>
                  </div>

                  <div className="profile-activity-section">
                    <div className="profile-activity-label">Recent Activity</div>
                    <div className="profile-activity-empty">No games played yet</div>
                  </div>

                  <button className="profile-logout-btn" onClick={handleLogout}>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link className="jungle-nav-link" to="/login">{t("logIn")}</Link>
              <Link className="jungle-avatar" to="/signup" title={t("signUp")}>🌱</Link>
            </>
          )}
        </div>
      </nav>

      <div className="jungle-hero">
        <h1 className="jungle-title">Trivia Pool</h1>
        <p className="jungle-subtitle">🌿 {t("subtitle")} 🌿</p>

        <div className="jungle-stone-card">
          <p className="jungle-stone-label">{t("gamePin")}</p>
          <input
            className="jungle-pin-input"
            placeholder="Enter 6-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePinEnter()}
          />
          <button className="jungle-enter-btn" onClick={handlePinEnter}>{t("enter")}</button>
        </div>

        <div className="jungle-divider"><span>or</span></div>

        <Link className="jungle-wood-btn" to="/host">
          👤➕ {t("hostAPool")}
        </Link>
      </div>

      <div className="jungle-badge-row">
        <div className="jungle-badge-card">
          <div className="jungle-badge-icon">🏆</div>
          <div>
            <h4>Compete</h4>
            <p>Challenge players in real time</p>
          </div>
        </div>
        <div className="jungle-badge-card">
          <div className="jungle-badge-icon">🏅</div>
          <div>
            <h4>Win Big</h4>
            <p>Outsmart others and take the pool</p>
          </div>
        </div>
        <div className="jungle-badge-card">
          <div className="jungle-badge-icon">👥</div>
          <div>
            <h4>Have Fun</h4>
            <p>Enjoy exciting trivia across categories</p>
          </div>
        </div>
        <div className="jungle-badge-card">
          <div className="jungle-badge-icon">💎</div>
          <div>
            <h4>Real Rewards</h4>
            <p>Real stakes. Real excitement.</p>
          </div>
        </div>
      </div>

      <footer className="jungle-footer">
        <p>🎁 {t("footerGetStarted")} <span className="jungle-footer-highlight">trivia-pool.com</span></p>
        <p className="jungle-footer-links">Terms | Privacy | Cookie notice</p>
        <p className="jungle-footer-powered">
          Powered by <a href="https://near.org" target="_blank" rel="noopener noreferrer" className="jungle-footer-highlight">NEAR</a>
        </p>
      </footer>
    </div>
  );
}