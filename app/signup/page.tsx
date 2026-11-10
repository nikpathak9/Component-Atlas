"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import ArrowRight from "lucide-react/icons/arrow-right";
import ShieldCheck from "lucide-react/icons/shield-check";
import { AuthLayout, GoogleAuthButton, PasswordField } from "../components/auth/auth-ui";
import { createEmailAccount, observeAuthState, signInWithGoogle } from "../firebase/auth";

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
  const [submitting, setSubmitting] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState("");
  const authActionInProgressRef = useRef(false);

  useLayoutEffect(() => {
    const storedTheme = window.localStorage.getItem("component-atlas-theme");
    if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    const destination = safeReturnPath(new URLSearchParams(window.location.search).get("return_to"));
    setReturnTo(destination);
    return observeAuthState((user) => {
      if (user && !authActionInProgressRef.current) window.location.replace(destination);
      else setReady(true);
    });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    authActionInProgressRef.current = true;
    setSubmitting("email");
    try {
      await createEmailAccount(name, email, password);
      window.location.replace(returnTo);
    } catch (signupError) {
      const raw = signupError instanceof Error ? signupError.message : "Your account could not be created.";
      setError(/operation-not-allowed/i.test(raw) ? "Email/password accounts are not enabled for this Firebase project. Enable the provider under Authentication → Sign-in method." : /email-already-in-use/i.test(raw) ? "An account already uses this email. Sign in instead, or use Google." : /weak-password/i.test(raw) ? "Use a stronger password with at least six characters." : raw.replace(/^Firebase:\s*/i, ""));
      authActionInProgressRef.current = false;
      setSubmitting(null);
    }
  };

  const handleGoogleSignUp = async () => {
    authActionInProgressRef.current = true;
    setSubmitting("google");
    setError("");
    try {
      await signInWithGoogle();
      window.location.replace(returnTo);
    } catch (signupError) {
      const message = signupError instanceof Error ? signupError.message : "Google sign-up could not be completed.";
      if (!message.includes("popup-closed-by-user")) setError(message.replace(/^Firebase:\s*/i, ""));
      authActionInProgressRef.current = false;
      setSubmitting(null);
    }
  };

  const passwordStrength = password.length >= 12 ? "Strong" : password.length >= 8 ? "Good" : password.length ? "Use at least 8 characters" : "";
  const passwordsMatch = confirmation.length > 0 && password === confirmation;

  if (!ready) return <main className={`login-page login-loading ${theme === "light" ? "light-theme" : ""}`}><img src="/component-atlas-logo.png" alt="" /><p>Preparing account creation…</p></main>;

  return <AuthLayout mode='signup' returnTo={returnTo} theme={theme}>
      <div className='auth-card-header'>
        <span>CREATE YOUR ACCOUNT</span>
        <h2>Start mapping your projects</h2>
        <p>Create an account to save your work and return to it across sessions.</p>
      </div>
      <GoogleAuthButton busy={submitting === "google"} onClick={handleGoogleSignUp} text='Sign up with Google' />
      <div className="auth-divider"><span>or use your email</span></div>
      <form className="email-auth-form auth-form" onSubmit={submit}>
        <label className='auth-field'><span className='auth-field-label'><b>Display name</b></span><input type="text" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
        <label className='auth-field'><span className='auth-field-label'><b>Email address</b></span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
        <PasswordField autoComplete='new-password' label='Password' minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder='At least 8 characters' />
        {passwordStrength && <div className={`password-strength strength-${password.length >= 12 ? "strong" : password.length >= 8 ? "good" : "weak"}`}><i /><span>{passwordStrength}</span></div>}
        <PasswordField autoComplete='new-password' label='Confirm password' minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder='Enter the password again' trailing={confirmation ? <small className={passwordsMatch ? "password-match" : "password-mismatch"}>{passwordsMatch ? "Passwords match" : "Does not match"}</small> : null} />
        <button className='auth-submit' type="submit" disabled={Boolean(submitting)}><span>{submitting === "email" ? "Creating account…" : "Create account"}</span><ArrowRight aria-hidden="true" /></button>
      </form>
      {error && <div className="login-auth-error" role="alert">{error}</div>}
      <p className="auth-switch">Already have an account? <a href={`/login?return_to=${encodeURIComponent(returnTo)}`}>Sign in</a></p>
      <small className='auth-security-note'><ShieldCheck aria-hidden="true" /> We send an email-verification link after account creation. Passwords are handled securely by Firebase.</small>
    </AuthLayout>;
}
