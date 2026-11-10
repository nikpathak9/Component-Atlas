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
  const authUser = authenticated;
  const beginProjectJourney = onPrimaryAction;
  return (
    <section className='landing-hero landing-reveal' id='top'>
      <div className='hero-copy'>
        <div className='hero-eyebrow'>
          <i /> Analysis for modern web frameworks
        </div>
        <h1>
          <strong>
            Understand any
            <br />
            codebase.
          </strong>
          <span>
            Before you touch
            <br />a line.
          </span>
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
            title={
              authUser
                ? "Import and analyze a project"
                : "Create an account to analyze a project"
            }
            onClick={beginProjectJourney}
          >
            {authUser ? (
              <>
                <Upload className='upload-icon' aria-hidden='true' /> Import
                your project{" "}
                <ArrowRight className='button-arrow' aria-hidden='true' />
              </>
            ) : (
              <>
                <Network className='upload-icon' aria-hidden='true' />{" "}
                Analyze your project{" "}
                <ArrowRight className='button-arrow' aria-hidden='true' />
              </>
            )}
          </button>
          <a className='hero-tour' href='#product'>
            <span>
              <Play aria-hidden='true' />
            </span>{" "}
            See how it works
          </a>
        </div>
        <div className='hero-support'>
          <span>
            <Check aria-hidden='true' /> Your source stays private
          </span>
          <span>
            <Check aria-hidden='true' /> No code execution
          </span>
          <span>
            <Check aria-hidden='true' /> React · Next.js · Remix · Solid ·
            Lightning · Vue
          </span>
        </div>
      </div>
      <div
        className='hero-product'
        aria-label='Preview of the Component Atlas analysis workspace'
      >
        <MobileWorkspacePreview
          theme={theme}
          alt='Component Atlas workspace showing the project explorer, component graph, source code, and flow inspector'
          eager
        />
        <div className='hero-product-glow' />
        <div className='hero-shot'>
          <div className='hero-shot-top'>
            <strong>
              <img src='/component-atlas-logo.png' alt='' /> Component Atlas
            </strong>
            <em>acme-dashboard</em>
            <small>● Analysis complete</small>
          </div>
          <div className='hero-shot-body'>
            <aside>
              <h3>PROJECT EXPLORER</h3>
              <p>▱ src</p>
              <ul>
                <li className='active'>⌁ Dashboard.tsx</li>
                <li>▦ Header.tsx</li>
                <li>▦ ActivityFeed.tsx</li>
                <li>↪ useActivity.ts</li>
                <li>⬡ activityApi.ts</li>
              </ul>
            </aside>
            <section>
              <header>
                <b>Component graph</b>
                <small>7 nodes · 8 relationships</small>
              </header>
              <div className='hero-shot-graph'>
                <i className='shot-edge shot-edge-a' />
                <i className='shot-edge shot-edge-b' />
                <i className='shot-edge shot-edge-c' />
                <i className='shot-edge shot-edge-d' />
                <div className='shot-node shot-node-a'>
                  <b>Dashboard</b>
                  <small>pages/Dashboard.tsx</small>
                </div>
                <div className='shot-node shot-node-b'>
                  <b>Header</b>
                  <small>components/Header.tsx</small>
                </div>
                <div className='shot-node shot-node-c'>
                  <b>ActivityFeed</b>
                  <small>components/ActivityFeed.tsx</small>
                </div>
                <div className='shot-node shot-node-d'>
                  <b>useActivity</b>
                  <small>hooks/useActivity.ts</small>
                </div>
                <div className='shot-node shot-node-e'>
                  <b>activityApi</b>
                  <small>services/activityApi.ts</small>
                </div>
              </div>
              <pre>
                <code>
                  <i>useEffect</i>
                  {"(() => activityApi.fetchActivity(), []);"}
                </code>
              </pre>
            </section>
            <aside className='hero-shot-inspector'>
              <h3>FLOW INSPECTOR</h3>
              <h4>Dashboard</h4>
              <small>pages/Dashboard.tsx</small>
              <div>
                <b>
                  Props <em>3</em>
                </b>
                <b>
                  Hooks <em>2</em>
                </b>
              </div>
              <h5>HOW IT WORKS</h5>
              <ol>
                <li>1&nbsp; Route opens</li>
                <li>2&nbsp; State initializes</li>
                <li className='active'>3&nbsp; API request data</li>
                <li>4&nbsp; Response updates state</li>
              </ol>
            </aside>
          </div>
        </div>
        <span className='hero-shot-chip chip-private'>
          ✓&nbsp; Static analysis only
        </span>
        <span className='hero-shot-chip chip-flow'>
          ⌁ <b>Data flow traced</b>
          <small>Dashboard → ActivityFeed</small>
        </span>
      </div>
    </section>
  );
});
