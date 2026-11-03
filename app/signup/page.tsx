"use client";

import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import ArrowRight from "lucide-react/icons/arrow-right";
import ShieldCheck from "lucide-react/icons/shield-check";
import UserPlus from "lucide-react/icons/user-plus";
import { createEmailAccount, observeAuthState } from "../firebase/auth";

function safeReturnPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function SignupPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [ready, setReady] = useState(false);
  const [returnTo, setReturnTo] = useState("/");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    const storedTheme = window.localStorage.getItem("component-atlas-theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    const destination = safeReturnPath(new URLSearchParams(window.location.search).get("return_to"));
    setReturnTo(destination);
    return observeAuthState((user) => {
      if (user) window.location.replace(destination);
      else setReady(true);
    });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    setSubmitting(true);
    try {
      await createEmailAccount(name, email, password);
      window.location.replace(returnTo);
    } catch (signupError) {
      const raw = signupError instanceof Error ? signupError.message : "Your account could not be created.";
      setError(/operation-not-allowed/i.test(raw) ? "Email/password accounts are not enabled for this Firebase project. Enable the provider under Authentication → Sign-in method." : /email-already-in-use/i.test(raw) ? "An account already uses this email. Sign in instead, or use Google." : /weak-password/i.test(raw) ? "Use a stronger password with at least six characters." : raw.replace(/^Firebase:\s*/i, ""));
      setSubmitting(false);
    }
  };

  if (!ready) return <main className={`login-page login-loading ${theme === "light" ? "light-theme" : ""}`}><img src="/component-atlas-logo.png" alt="" /><p>Preparing account creation…</p></main>;

  return <main className={`login-page signup-page ${theme === "light" ? "light-theme" : ""}`}>
    <a className="login-brand" href="/"><img src="/component-atlas-logo.png" alt="" /><strong>Component Atlas</strong></a>
    <section className="login-panel signup-panel">
      <span className="login-icon"><UserPlus aria-hidden="true" /></span>
      <div className="analysis-kicker">CREATE YOUR ACCOUNT</div>
      <h1>Start using Component Atlas</h1>
      <p>Create an account to save projects and access your workspace across sessions.</p>
      <form className="email-auth-form" onSubmit={submit}>
        <label><span>Display name</span><input type="text" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
        <label><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <label><span>Password</span><input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>
        <label><span>Confirm password</span><input type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter the password again" /></label>
        <button type="submit" disabled={submitting}><span>{submitting ? "Creating account…" : "Create account"}</span><ArrowRight aria-hidden="true" /></button>
      </form>
      {error && <div className="login-auth-error" role="alert">{error}</div>}
      <p className="auth-switch">Already have an account? <a href={`/login?return_to=${encodeURIComponent(returnTo)}`}>Sign in</a></p>
      <small><ShieldCheck aria-hidden="true" /> We send an email-verification link after account creation. Passwords are handled securely by Firebase.</small>
    </section>
    <a className="login-back" href={returnTo}>← Back to Component Atlas</a>
  </main>;
}
