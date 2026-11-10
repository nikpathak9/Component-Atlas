import { memo } from "react";
import ArrowRight from "lucide-react/icons/arrow-right";
import Check from "lucide-react/icons/check";
import Network from "lucide-react/icons/network";
import Play from "lucide-react/icons/play";
import Upload from "lucide-react/icons/upload";
import { MobileWorkspacePreview } from "./mobile-workspace-preview";

type Props = {
  authenticated: boolean;
  authLoading: boolean;
  theme: "light" | "dark";
  onPrimaryAction: () => void;
};

export const LandingHero = memo(function LandingHero({
  authenticated,
  authLoading,
  theme,
  onPrimaryAction,
}: Props) {
  return (
    <section className='landing-hero landing-reveal' id='top'>
      <div className='hero-copy'>
        <div className='hero-eyebrow'><i /> Analysis for modern web frameworks</div>
        <h1>
          <strong>Understand any<br />codebase.</strong>
          <span>Before you touch<br />a line.</span>
        </h1>
        <p>
          Upload a React, Next.js, Remix, SolidJS, LightningJS, or Vue
          JavaScript/TypeScript project and get an interactive map of its
          components, data flow, state, routes, and execution paths—without
          running the code.
        </p>
        <div className='hero-actions'>
          <button
            className='hero-upload'
            disabled={authLoading}
            title={authenticated ? "Import and analyze a project" : "Create an account to analyze a project"}
            onClick={onPrimaryAction}
          >
            {authenticated ? <Upload className='upload-icon' aria-hidden='true' /> : <Network className='upload-icon' aria-hidden='true' />}
            {authenticated ? "Import your project" : "Analyze your project"}
            <ArrowRight className='button-arrow' aria-hidden='true' />
          </button>
          <a className='hero-tour' href='#product'>
            <span><Play aria-hidden='true' /></span> See how it works
          </a>
        </div>
        <div className='hero-support'>
          <span><Check aria-hidden='true' /> Your source stays private</span>
          <span><Check aria-hidden='true' /> No code execution</span>
          <span><Check aria-hidden='true' /> React · Next.js · Remix · Solid · Lightning · Vue</span>
        </div>
      </div>
      <div className='hero-product' aria-label='Preview of the Component Atlas analysis workspace'>
        <MobileWorkspacePreview
          theme={theme}
          alt='Component Atlas workspace showing the project explorer, component graph, source code, and flow inspector'
          eager
        />
      </div>
    </section>
  );
});
