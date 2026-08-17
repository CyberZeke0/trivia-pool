import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleReset() {
    setError("");
    if (!email.trim() || !newPassword) {
      return setError("Enter your email and a new password");
    }
    if (newPassword.length < 6) {
      return setError("Password must be at least 6 characters");
    }
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not reset password");
        return;
      }
      localStorage.setItem("triviaPool.token", data.token);
      localStorage.setItem("triviaPool.user", JSON.stringify(data.user));
      setSuccess(true);
      setTimeout(() => navigate("/"), 1500);
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
        <h2>Reset Password</h2>
        <p className="subtitle">
          No email gets sent — just enter your account email and pick a new password.
        </p>

        {success ? (
          <p className="subtitle" style={{ color: "#8fe05a", fontWeight: 700 }}>
            Password updated! Logging you in...
          </p>
        ) : (
          <>
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
              <label>New Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            {error && <p className="error">{error}</p>}
            <button className="btn" onClick={handleReset} disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </>
        )}

        <p className="auth-switch">
          Remembered it? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}