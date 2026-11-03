import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "../app/globals.css";
import "../app/interaction.css";
import "../app/landing.css";
import { ComponentAtlas } from "../app/page";
import LoginPage from "../app/login/page";
import SignupPage from "../app/signup/page";

const path = window.location.pathname.replace(/\/+$/, "") || "/";

function App() {
  if (path === "/login") return <LoginPage />;
  if (path === "/signup") return <SignupPage />;
  return <ComponentAtlas initialView={path === "/workspace" ? "workspace" : "landing"} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
