import type { Metadata } from "next";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";
import "./interaction.css";
import "./landing.css";

export const metadata: Metadata = {
  title: "Component Atlas — Understand React codebases",
  description: "Visual component maps and readable execution flows for React code.",
  icons: {
    icon: "/component-atlas-logo.png",
    shortcut: "/component-atlas-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("component-atlas-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.appTheme=t;document.body.dataset.appTheme=t}}catch(e){}` }} />
        {children}
      </body>
    </html>
  );
}
