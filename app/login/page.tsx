"use client";

import { useEffect, useState, type FormEvent } from "react";
import ArrowRight from "lucide-react/icons/arrow-right";
import LogIn from "lucide-react/icons/log-in";
import ShieldCheck from "lucide-react/icons/shield-check";

const LOCAL_AUTH_KEY = "component-atlas-local-user";

function safeReturnPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage() {
  const [ready, setReady] = useState(false);
  const [localPreview, setLocalPreview] = useState(false);
  const [returnTo, setReturnTo] = useState("/");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const nextReturnTo = safeReturnPath(parameters.get("return_to"));
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    setReturnTo(nextReturnTo);
    setLocalPreview(isLocal);

    if (parameters.get("signout") === "1") {
      window.localStorage.removeItem(LOCAL_AUTH_KEY);
      if (isLocal) { window.location.replace(nextReturnTo); return; }
      fetch("/api/auth/me", { credentials: "same-origin" })
        .then((response) => response.json() as Promise<{ user: unknown }>)
        .then(({ user }) => window.location.replace(user ? `/signout-with-chatgpt?return_to=${encodeURIComponent(nextReturnTo)}` : nextReturnTo))
        .catch(() => window.location.replace(nextReturnTo));
      return;
    }

    if (isLocal) {
      try {
        const existing = JSON.parse(window.localStorage.getItem(LOCAL_AUTH_KEY) ?? "null") as { displayName?: string; email?: string } | null;
        if (existing) { setName(existing.displayName ?? ""); setEmail(existing.email ?? ""); }
      } catch { /* Ignore an invalid local preview profile. */ }
    }
    setReady(true);
  }, []);

  const signInLocally = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;
    const cleanName = name.trim() || cleanEmail.split("@")[0];
    window.localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify({ userId: `local:${cleanEmail}`, displayName: cleanName, email: cleanEmail, fullName: cleanName }));
    window.location.replace(returnTo);
  };

  if (!ready) return <main className="login-page login-loading"><img src="/component-atlas-logo.png" alt="" /><p>Preparing sign in…</p></main>;

  return (
    <main className="login-page">
      <a className="login-brand" href="/"><img src="/component-atlas-logo.png" alt="" /><strong>Component Atlas</strong></a>
      <section className="login-panel">
        <span className="login-icon"><LogIn aria-hidden="true" /></span>
        <div className="analysis-kicker">WELCOME BACK</div>
        <h1>Sign in to Component Atlas</h1>
        <p>Keep your identity available while you explore and return to your saved workspace.</p>
        {localPreview ? <form onSubmit={signInLocally}>
          <div className="local-preview-note"><b>Local preview mode</b><span>This profile is stored only in this browser. No password is collected.</span></div>
          <label><span>Name</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
          <label><span>Email</span><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <button type="submit">Continue locally <ArrowRight aria-hidden="true" /></button>
        </form> : <a className="chatgpt-login-button" href={`/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo)}`}><LogIn aria-hidden="true" /> Continue with ChatGPT <ArrowRight aria-hidden="true" /></a>}
        <small><ShieldCheck aria-hidden="true" /> Authentication is handled securely. Component Atlas never stores your password.</small>
      </section>
      <a className="login-back" href={returnTo}>← Back to Component Atlas</a>
    </main>
  );
}
