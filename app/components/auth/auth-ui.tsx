"use client";

import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import ArrowLeft from "lucide-react/icons/arrow-left";
import ArrowRight from "lucide-react/icons/arrow-right";
import Check from "lucide-react/icons/check";
import Cloud from "lucide-react/icons/cloud";
import Eye from "lucide-react/icons/eye";
import EyeOff from "lucide-react/icons/eye-off";
import Network from "lucide-react/icons/network";
import ShieldCheck from "lucide-react/icons/shield-check";

type AuthLayoutProps = {
  children: ReactNode;
  mode: "login" | "signup";
  returnTo: string;
  theme: "dark" | "light";
};

export function AuthLayout({ children, mode, returnTo, theme }: AuthLayoutProps) {
  return (
    <main className={`auth-page ${theme === "light" ? "light-theme" : ""}`}>
      <header className='auth-header'>
        <a className='auth-brand' href='/'>
          <img src='/component-atlas-logo.png' alt='' />
          <strong>Component Atlas</strong>
        </a>
        <a className='auth-home-link' href={returnTo}>
          <ArrowLeft aria-hidden='true' /> Back to home
        </a>
      </header>
      <div className='auth-layout'>
        <aside className='auth-story'>
          <div className='auth-story-copy'>
            <span className='auth-eyebrow'>{mode === "login" ? "WELCOME BACK" : "START EXPLORING"}</span>
            <h1>Understand your codebase before changing it.</h1>
            <p>Turn a modern frontend project into a navigable map of components, data flow, routes, and connected source.</p>
          </div>
          <div className='auth-graph-preview' aria-hidden='true'>
            <i className='auth-graph-line line-one' />
            <i className='auth-graph-line line-two' />
            <span className='auth-graph-node node-page'><Network /></span>
            <span className='auth-graph-node node-component'><img src='/component-atlas-logo.png' alt='' /></span>
            <span className='auth-graph-node node-cloud'><Cloud /></span>
          </div>
          <ul className='auth-benefits'>
            <li><Check aria-hidden='true' /><span><b>Static analysis only</b><small>Your application is never executed.</small></span></li>
            <li><Cloud aria-hidden='true' /><span><b>Secure project sync</b><small>Return to your projects across sessions.</small></span></li>
            <li><ShieldCheck aria-hidden='true' /><span><b>Your source stays private</b><small>Authentication is handled securely by Firebase.</small></span></li>
          </ul>
        </aside>
        <section className='auth-card'>{children}</section>
      </div>
    </main>
  );
}

type GoogleButtonProps = {
  busy: boolean;
  onClick: () => void | Promise<void>;
  text: string;
};

export function GoogleAuthButton({ busy, onClick, text }: GoogleButtonProps) {
  return (
    <button className='google-auth-button' type='button' disabled={busy} onClick={() => void onClick()}>
      <img src='/google-g.png' alt='' />
      <span>{busy ? "Opening Google…" : text}</span>
      <ArrowRight aria-hidden='true' />
    </button>
  );
}

type PasswordFieldProps = {
  autoComplete: "current-password" | "new-password";
  label: string;
  minLength?: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  trailing?: ReactNode;
  value: string;
};

export function PasswordField({ autoComplete, label, minLength = 6, onChange, placeholder, trailing, value }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();
  return (
    <div className='auth-field'>
      <span className='auth-field-label'><label htmlFor={inputId}>{label}</label>{trailing}</span>
      <span className='auth-password-input'>
        <input id={inputId} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} value={value} onChange={onChange} placeholder={placeholder} />
        <button type='button' aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible((current) => !current)}>
          {visible ? <EyeOff aria-hidden='true' /> : <Eye aria-hidden='true' />}
        </button>
      </span>
    </div>
  );
}
