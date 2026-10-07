import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, FullScreenLoader, Notice, TextField } from "../components/ui";

function signInErrorMessage(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/network-request-failed":
      return "Can't reach the server. Check your connection and try again.";
    default:
      return "Unable to sign in. Please try again.";
  }
}

export default function Login() {
  const { user, loading, signIn, resetPassword } = useAuth();
  const location = useLocation();

  const [mode, setMode] = useState("signin"); // "signin" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  if (loading) return <FullScreenLoader />;
  // Already signed in — ProtectedRoute decides whether they have leader access.
  if (user) return <Navigate to={location.state?.from || "/dashboard"} replace />;

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setInfo("");
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(signInErrorMessage(err.code));
      setSubmitting(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await resetPassword(email.trim());
    } catch (err) {
      // Don't reveal whether an address has an account.
      if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
        setSubmitting(false);
        return;
      }
    }
    setInfo("If that email has an account, a password reset link is on its way.");
    setSubmitting(false);
  };

  return (
    <div className="auth">
      <div className="auth-hero">
        <img src="/icons/icon-192.png" alt="" />
        <h1>PF Management</h1>
        <p>Palouse Fellowship Management</p>
      </div>

      <div className="auth-body">
        <div className="card auth-card">
          {mode === "signin" ? (
            <form className="form" onSubmit={handleSignIn} noValidate>
              <div>
                <h2>Sign in</h2>
                <p className="lede">For Palouse Fellowship managers.</p>
              </div>
              {error && <Notice tone="error">{error}</Notice>}
              <TextField label="Email" id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              <TextField label="Password" id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="submit" variant="primary" block loading={submitting}>
                {submitting ? "Signing in…" : "Sign In"}
              </Button>
              <div style={{ textAlign: "center" }}>
                <button type="button" className="link-btn" onClick={() => switchMode("reset")}>
                  Forgot password?
                </button>
              </div>
            </form>
          ) : (
            <form className="form" onSubmit={handleReset} noValidate>
              <div>
                <h2>Reset password</h2>
                <p className="lede">We'll email you a link to choose a new password.</p>
              </div>
              {error && <Notice tone="error">{error}</Notice>}
              {info && <Notice tone="success">{info}</Notice>}
              <TextField label="Email" id="reset-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              <Button type="submit" variant="primary" block loading={submitting}>
                {submitting ? "Sending…" : "Send Reset Link"}
              </Button>
              <div style={{ textAlign: "center" }}>
                <button type="button" className="link-btn" onClick={() => switchMode("signin")}>
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
        <p className="auth-foot">Accounts are by invitation only. Ask a main admin if you need access.</p>
      </div>
    </div>
  );
}
