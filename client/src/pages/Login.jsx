import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Film, AlertCircle, Sparkles } from "lucide-react";
import { useApp } from "../context/AppContext";
import { authAPI } from "../services/api";
import "./Auth.css";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
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

    if (!form.email.trim() || !form.password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const data = await authAPI.login({
        email: form.email.trim(),
        password: form.password,
      });

      if (data && data.user) {
        login(data.user, data.token);
        const from = location.state?.from?.pathname || "/";
        navigate(from, { replace: true });
        return;
      }
    } catch (err) {
      // If network fails (backend not running), allow demo sign-in
      if (err.isNetworkError) {
        handleDemoLogin();
        return;
      }
      setError(err.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    const demoUser = {
      _id: "demo-user-1",
      id: "demo-user-1",
      name: "Alex Rivera",
      email: form.email || "alex.rivera@cinemafan.com",
      role: "user",
    };
    login(demoUser, "demo-jwt-token-2026");
    const from = location.state?.from?.pathname || "/";
    navigate(from, { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" />

      <div className="auth-card" id="login-card">
        {/* Logo */}
        <Link to="/" className="auth-logo">
          <Film size={28} />
          i<span>Movies</span>
        </Link>

        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to continue your cinematic journey</p>

        {error && (
          <div className="auth-error" id="login-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" id="login-form">
          <div className="auth-field">
            <label htmlFor="login-email" className="auth-label">Email</label>
            <div className="auth-input-wrap">
              <Mail size={16} className="auth-input-icon" />
              <input
                id="login-email"
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
            <label htmlFor="login-password" className="auth-label">Password</label>
            <div className="auth-input-wrap">
              <Lock size={16} className="auth-input-icon" />
              <input
                id="login-password"
                type={showPwd ? "text" : "password"}
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="auth-input"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-pwd-toggle"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Hide password" : "Show password"}
                id="login-pwd-toggle"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`auth-submit${loading ? " auth-submit--loading" : ""}`}
            disabled={loading}
            id="login-submit-btn"
          >
            {loading ? <span className="auth-spinner" /> : "Sign In"}
          </button>

          {/* Quick 1-click Demo Account button */}
          <button
            type="button"
            className="auth-demo-btn"
            onClick={handleDemoLogin}
            id="demo-login-btn"
          >
            <Sparkles size={15} /> Instant Demo Sign In
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account?{" "}
          <Link to="/register" id="go-to-register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
