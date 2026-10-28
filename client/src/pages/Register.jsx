import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, User, Film, AlertCircle, CheckCircle } from "lucide-react";
import { useApp } from "../context/AppContext";
import { authAPI } from "../services/api";
import "./Auth.css";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, login } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.email.trim() || !form.password || !form.confirm) {
      setError("Please fill in all required fields.");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(form.email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const data = await authAPI.register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      if (data && data.user) {
        login(data.user, data.token);
        const from = location.state?.from?.pathname || "/";
        navigate(from, { replace: true });
      }
    } catch (err) {
      if (err.isNetworkError) {
        const demoUser = {
          _id: `user-${Date.now()}`,
          id: `user-${Date.now()}`,
          name: form.name.trim(),
          email: form.email.trim(),
          role: "user",
        };
        login(demoUser, "demo-token-local");
        const from = location.state?.from?.pathname || "/";
        navigate(from, { replace: true });
        return;
      }
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pwdStrength = (pwd) => {
    if (!pwd) return 0;
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
  };

  const strength = pwdStrength(form.password);
  const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];
  const STRENGTH_COLOR = ["", "#e50914", "#f59e0b", "#22c55e", "#16a34a"];

  const criteria = [
    { label: "At least 6 characters", met: form.password.length >= 6 },
    { label: "One uppercase letter", met: /[A-Z]/.test(form.password) },
    { label: "One number", met: /[0-9]/.test(form.password) },
  ];

  return (
    <div className="auth-page">
      <div className="auth-bg" />

      <div className="auth-card" id="register-card">
        <Link to="/" className="auth-logo">
          <Film size={28} />
          i<span>Movies</span>
        </Link>

        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join iMovies and never miss a blockbuster</p>

        {error && (
          <div className="auth-error" id="register-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" id="register-form">
          <div className="auth-field">
            <label htmlFor="reg-name" className="auth-label">Full Name *</label>
            <div className="auth-input-wrap">
              <User size={16} className="auth-input-icon" />
              <input
                id="reg-name"
                type="text"
                placeholder="John Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="auth-input"
                autoComplete="name"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="reg-email" className="auth-label">Email *</label>
            <div className="auth-input-wrap">
              <Mail size={16} className="auth-input-icon" />
              <input
                id="reg-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="auth-input"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="reg-password" className="auth-label">Password *</label>
            <div className="auth-input-wrap">
              <Lock size={16} className="auth-input-icon" />
              <input
                id="reg-password"
                type={showPwd ? "text" : "password"}
                placeholder="Create a password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="auth-input"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="auth-pwd-toggle"
                onClick={() => setShowPwd((v) => !v)}
                id="reg-pwd-toggle"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div className="auth-pwd-strength">
                <div className="auth-pwd-bar">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="auth-pwd-segment"
                      style={{
                        background:
                          n <= strength
                            ? STRENGTH_COLOR[strength]
                            : "rgba(255,255,255,0.1)",
                      }}
                    />
                  ))}
                </div>
                <span style={{ color: STRENGTH_COLOR[strength] }}>
                  {STRENGTH_LABEL[strength]}
                </span>
              </div>
            )}
          </div>

          <div className="auth-field">
            <label htmlFor="reg-confirm" className="auth-label">Confirm Password *</label>
            <div className="auth-input-wrap">
              <Lock size={16} className="auth-input-icon" />
              <input
                id="reg-confirm"
                type={showPwd ? "text" : "password"}
                placeholder="Repeat your password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                className={`auth-input${
                  form.confirm && form.confirm !== form.password
                    ? " auth-input--error"
                    : ""
                }${
                  form.confirm && form.confirm === form.password
                    ? " auth-input--success"
                    : ""
                }`}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          {form.password && (
            <ul className="auth-criteria">
              {criteria.map((c) => (
                <li
                  key={c.label}
                  className={c.met ? "auth-criteria__item--met" : ""}
                >
                  <CheckCircle size={13} /> {c.label}
                </li>
              ))}
            </ul>
          )}

          <button
            type="submit"
            className={`auth-submit${loading ? " auth-submit--loading" : ""}`}
            disabled={loading}
            id="register-submit-btn"
          >
            {loading ? <span className="auth-spinner" /> : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login" id="go-to-login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
