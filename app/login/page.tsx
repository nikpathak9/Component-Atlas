"use client";

import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import ArrowRight from "lucide-react/icons/arrow-right";
import ShieldCheck from "lucide-react/icons/shield-check";
import { AuthLayout, GoogleAuthButton, PasswordField } from "../components/auth/auth-ui";
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
    <AuthLayout mode='login' returnTo={returnTo} theme={theme}>
      <div className='auth-card-header'>
        <span>WELCOME BACK</span>
        <h2>Sign in to your workspace</h2>
        <p>Continue where you left off with your saved projects and analysis.</p>
      </div>
      <GoogleAuthButton busy={signingIn === "google"} onClick={handleGoogleSignIn} text='Continue with Google' />
      <div className="auth-divider"><span>or use your email</span></div>
      <form className="email-auth-form auth-form" onSubmit={handleEmailSignIn}>
        <label className='auth-field'><span className='auth-field-label'><b>Email address</b></span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <PasswordField autoComplete='current-password' label='Password' value={password} onChange={(event) => setPassword(event.target.value)} placeholder='Enter your password' trailing={<button className="forgot-password" type="button" onClick={() => void handlePasswordReset()}>Forgot password?</button>} />
        <button className='auth-submit' type="submit" disabled={Boolean(signingIn)}><span>{signingIn === "email" ? "Signing in…" : "Sign in"}</span><ArrowRight aria-hidden="true" /></button>
      </form>
      <div className='auth-feedback' aria-live='polite'>
        {error && <div className="login-auth-error" role="alert">{error}</div>}
        {message && <div className="login-auth-message" role="status">{message}</div>}
      </div>
      <p className="auth-switch">New to Component Atlas? <a href={`/signup?return_to=${encodeURIComponent(returnTo)}`}>Create an account</a></p>
      <small className='auth-security-note'><ShieldCheck aria-hidden="true" /> Authentication is handled securely by Firebase. Component Atlas never sees your Google password.</small>
    </AuthLayout>
  );
}
