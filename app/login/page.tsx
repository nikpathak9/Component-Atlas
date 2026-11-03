"use client";

import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import ArrowRight from "lucide-react/icons/arrow-right";
import LogIn from "lucide-react/icons/log-in";
import ShieldCheck from "lucide-react/icons/shield-check";
import { observeAuthState, sendResetEmail, signInWithEmail, signInWithGoogle, signOutFromFirebase } from "../firebase/auth";

function safeReturnPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [ready, setReady] = useState(false);
  const [returnTo, setReturnTo] = useState("/");
  const [signingIn, setSigningIn] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useLayoutEffect(() => {
    const storedTheme = window.localStorage.getItem("component-atlas-theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const nextReturnTo = safeReturnPath(parameters.get("return_to"));
    setReturnTo(nextReturnTo);

    if (parameters.get("signout") === "1") {
      signOutFromFirebase()
        .then(() => window.location.replace(nextReturnTo))
        .catch(() => window.location.replace(nextReturnTo));
      return;
    }

    return observeAuthState((user) => {
      if (user) window.location.replace(nextReturnTo);
      else setReady(true);
    });
  }, []);

  const handleGoogleSignIn = async () => {
    setSigningIn("google");
    setError("");
    try {
      await signInWithGoogle();
      window.location.replace(returnTo);
    } catch (signInError) {
      const message = signInError instanceof Error ? signInError.message : "Google sign-in could not be completed.";
      if (!message.includes("popup-closed-by-user")) setError(message.replace(/^Firebase:\s*/i, ""));
      setSigningIn(null);
    }
  };

  const handleEmailSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setSigningIn("email");
    setError("");
    setMessage("");
    try {
      await signInWithEmail(email, password);
      window.location.replace(returnTo);
    } catch (signInError) {
      const raw = signInError instanceof Error ? signInError.message : "Email sign-in could not be completed.";
      setError(/operation-not-allowed/i.test(raw) ? "Email/password sign-in is not enabled for this Firebase project. Enable it under Authentication → Sign-in method." : /invalid-credential|wrong-password|user-not-found/i.test(raw) ? "The email or password is incorrect." : raw.replace(/^Firebase:\s*/i, ""));
      setSigningIn(null);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) { setError("Enter your email address first, then select Forgot password."); return; }
    setError("");
    try {
      await sendResetEmail(email);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message.replace(/^Firebase:\s*/i, "") : "Password reset could not be sent.");
    }
  };

  if (!ready) return <main className={`login-page login-loading ${theme === "light" ? "light-theme" : ""}`}><img src="/component-atlas-logo.png" alt="" /><p>Preparing sign in…</p></main>;

  return (
    <main className={`login-page ${theme === "light" ? "light-theme" : ""}`}>
      <a className="login-brand" href="/"><img src="/component-atlas-logo.png" alt="" /><strong>Component Atlas</strong></a>
      <section className="login-panel">
        <span className="login-icon"><LogIn aria-hidden="true" /></span>
        <div className="analysis-kicker">WELCOME BACK</div>
        <h1>Sign in to Component Atlas</h1>
        <p>Sign in to return to your saved Component Atlas workspace.</p>
        <button className="google-login-button" type="button" disabled={Boolean(signingIn)} onClick={handleGoogleSignIn}><LogIn aria-hidden="true" /><span>{signingIn === "google" ? "Opening Google…" : "Continue with Google"}</span><ArrowRight aria-hidden="true" /></button>
        <div className="auth-divider"><span>or continue with email</span></div>
        <form className="email-auth-form" onSubmit={handleEmailSignIn}>
          <label><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label><span>Password</span><input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></label>
          <button type="submit" disabled={Boolean(signingIn)}><span>{signingIn === "email" ? "Signing in…" : "Sign in with email"}</span><ArrowRight aria-hidden="true" /></button>
        </form>
        <button className="forgot-password" type="button" onClick={() => void handlePasswordReset()}>Forgot password?</button>
        {error && <div className="login-auth-error" role="alert">{error}</div>}
        {message && <div className="login-auth-message" role="status">{message}</div>}
        <p className="auth-switch">New to Component Atlas? <a href={`/signup?return_to=${encodeURIComponent(returnTo)}`}>Create an account</a></p>
        <small><ShieldCheck aria-hidden="true" /> Authentication is handled securely by Firebase. Component Atlas never sees your Google password.</small>
      </section>
      <a className="login-back" href={returnTo}>← Back to Component Atlas</a>
    </main>
  );
}
