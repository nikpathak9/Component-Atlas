import { memo } from "react";
import Code2 from "lucide-react/icons/code-2";
import Network from "lucide-react/icons/network";
import Workflow from "lucide-react/icons/workflow";
import { MobileWorkspacePreview } from "./mobile-workspace-preview";

export const LandingProductPreview = memo(function LandingProductPreview({ theme }: { theme: "light" | "dark" }) {
  return (
    
    <section className='landing-preview-section'>
      <div className='landing-section-copy'>
        <span>SEE THE WHOLE SYSTEM</span>
        <h2>From file tree to execution flow</h2>
        <p>
          Atlas turns source code into a navigable model. Select any
          component to see where its data comes from and what happens next.
        </p>
      </div>
      <div className='preview-switchers'>
        <article>
          <i>
            <Network aria-hidden='true' />
          </i>
          <span>
            <b>Component graph</b>
            <small>See every relationship</small>
          </span>
        </article>
        <article>
          <i>
            <Workflow aria-hidden='true' />
          </i>
          <span>
            <b>Execution flow</b>
            <small>Follow behavior step by step</small>
          </span>
        </article>
        <article>
          <i>
            <Code2 aria-hidden='true' />
          </i>
          <span>
            <b>Connected source</b>
            <small>Jump directly to the code</small>
          </span>
        </article>
      </div>
      <div
        className='landing-product-frame'
        role='img'
        aria-label='Component Atlas workspace preview showing a file explorer, component graph, source code, and flow inspector'
      >
        <MobileWorkspacePreview
          theme={theme}
          alt='Component Atlas workspace showing a connected component graph and its source code'
        />
        <div className='landing-product-canvas'>
          <div className='demo-topbar'>
          <div>
            <i />
            <i />
            <i />
          </div>
          <strong>
            <img src='/component-atlas-logo.png' alt='' /> Component Atlas
          </strong>
          <em>acme-dashboard⌄</em>
          <small>● Analysis complete</small>
          <b>Search project&nbsp;&nbsp; ⌘ K</b>
        </div>
        <div className='demo-workspace'>
          <aside className='demo-explorer'>
            <h3>PROJECT EXPLORER</h3>
            <button>↥ Import project</button>
            <div className='demo-search'>⌕ Search files...</div>
            <p>
              ⌄ ▱ <b>src</b>
            </p>
            <ul>
              <li>└─ App.tsx</li>
              <li className='demo-active'>└─ Dashboard.tsx</li>
              <li>└─ Header.tsx</li>
              <li>└─ ActivityFeed.tsx</li>
              <li>└─ useActivity.ts</li>
            </ul>
          </aside>
          <div className='demo-center'>
            <div className='demo-toolbar'>
              <b>◇ Component graph</b>
              <span>7 nodes · 8 relationships</span>
              <i>Find node&nbsp;&nbsp; Filter</i>
            </div>
            <div className='demo-graph'>
              <i className='demo-edge edge-a' />
              <i className='demo-edge edge-b' />
              <i className='demo-edge edge-c' />
              <div className='demo-node node-a'>
                <b>Dashboard</b>
                <small>pages/Dashboard.tsx</small>
              </div>
              <div className='demo-node node-b'>
                <b>Header</b>
                <small>components/Header.tsx</small>
              </div>
              <div className='demo-node node-c'>
                <b>ActivityFeed</b>
                <small>components/ActivityFeed.tsx</small>
              </div>
              <div className='demo-node node-d'>
                <b>useActivity</b>
                <small>hooks/useActivity.ts</small>
              </div>
              <div className='demo-legend'>
                ━ Import / render&nbsp;&nbsp; <span>━ Data flow</span>
                &nbsp;&nbsp; ┄ Callback
              </div>
            </div>
            <div className='demo-code'>
              <div>
                <b>Dashboard.tsx</b>
                <span>useActivity.ts</span>
                <em>Source preview</em>
              </div>
              <pre>
                <code>
                  <i>import</i> {"{ Header }"} <i>from</i>{" "}
                  <q>&quot;../components/Header&quot;</q>;{`\n`}
                  <i>export function</i> <strong>Dashboard</strong>() {"{"}
                  {`\n  `}
                  <i>const</i> {"{ activities }"} ={" "}
                  <strong>useActivity</strong>();{`\n  `}
                  <i>return</i> &lt;<strong>ActivityFeed</strong> items=
                  {"{activities}"} /&gt;;{`\n`}
                  {"}"}
                </code>
              </pre>
            </div>
          </div>
          <aside className='demo-inspector'>
            <h3>FLOW INSPECTOR</h3>
            <div className='demo-file-title'>
              <i>⌁</i>
              <span>
                <b>Dashboard</b>
                <small>pages/Dashboard.tsx</small>
              </span>
            </div>
            <nav>Overview&nbsp;&nbsp; Relations&nbsp;&nbsp; Source</nav>
            <div className='demo-metrics'>
              <span>
                Props <b>3</b>
              </span>
              <span>
                State <b>1</b>
              </span>
              <span>
                Effects <b>2</b>
              </span>
              <span>
                Events <b>2</b>
              </span>
            </div>
            <h4>HOW THIS FILE WORKS</h4>
            <ol>
              <li>
                <b>1</b> Dashboard renders
              </li>
              <li className='demo-step'>
                <b>2</b> useActivity loads data
              </li>
              <li>
                <b>3</b> ActivityFeed receives items
              </li>
            </ol>
          </aside>
          </div>
        </div>
      </div>
    </section>
  );
});
