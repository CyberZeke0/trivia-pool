import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter (a–z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number (0–9)", test: (pw) => /[0-9]/.test(pw) },
  { label: "One special character (!@#$%^&* etc.)", test: (pw) => /[!@#$%^&*(),.?":{}|<>_\-]/.test(pw) },
];

export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function suggestedDisplayName(first, last) {
    if (!first) return "";
    const lastInitial = last ? `${last.charAt(0).toUpperCase()}.` : "";
    return [first, lastInitial].filter(Boolean).join(" ");
  }

  function handleFirstNameChange(value) {
    setFirstName(value);
    if (!displayNameTouched) {
      setDisplayName(suggestedDisplayName(value, lastName));
    }
  }

  function handleLastNameChange(value) {
    setLastName(value);
    if (!displayNameTouched) {
      setDisplayName(suggestedDisplayName(firstName, value));
    }
  }

  const allRequirementsMet = PASSWORD_REQUIREMENTS.every((r) => r.test(password));

  async function handleSignup() {
    setError("");
    if (!email.trim() || !password) {
      return setError("Enter your email and password");
    }
    if (!allRequirementsMet) {
      return setError("Password doesn't meet all the requirements below");
    }
    setLoading(true);
    try {
      const finalDisplayName = displayName.trim() || suggestedDisplayName(firstName, lastName) || email.split("@")[0];
      const res = await fetch(`${SERVER_URL}/api/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName: finalDisplayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }
      localStorage.setItem("triviaPool.token", data.token);
      localStorage.setItem("triviaPool.user", JSON.stringify(data.user));
      navigate("/");
    } catch (err) {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="screen center">
      <Link to="/" className="back-home-link">← Back to Home</Link>
      <div className="setup-card">
        <h2>Create Account</h2>
        <p className="subtitle">Set up your host profile.</p>

        <div className="field-group full-width">
          <label>First Name</label>
          <input
            placeholder="e.g. Alex"
            value={firstName}
            onChange={(e) => handleFirstNameChange(e.target.value)}
          />
          <p className="field-hint">This is how your first name will appear.</p>
        </div>

        <div className="field-group full-width">
          <label>Last Name</label>
          <input
            placeholder="e.g. Johnson"
            value={lastName}
            onChange={(e) => handleLastNameChange(e.target.value)}
          />
          <p className="field-hint">This is how your last name will appear.</p>
        </div>

        <div className="field-group full-width">
          <label>Display Name</label>
          <input
            placeholder="e.g. Alex J."
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setDisplayNameTouched(true);
            }}
          />
          <p className="field-hint">This is the name others will see on your profile.</p>
        </div>

        <div className="field-group full-width">
          <label>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field-group full-width">
          <label>Password</label>
          <div className="password-input-wrap">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>

          <div className="password-requirements">
            {PASSWORD_REQUIREMENTS.map((req) => {
              const met = req.test(password);
              return (
                <div key={req.label} className={`requirement-item ${met ? "requirement-met" : ""}`}>
                  <span className="requirement-circle">{met ? "✓" : ""}</span>
                  <span>{req.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        <button className="btn" onClick={handleSignup} disabled={loading}>
          {loading ? "Creating account..." : "Sign Up"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}