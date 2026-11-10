import { memo } from "react";
import Code2 from "lucide-react/icons/code-2";
import Network from "lucide-react/icons/network";
import Workflow from "lucide-react/icons/workflow";
import { MobileWorkspacePreview } from "./mobile-workspace-preview";

export const LandingProductPreview = memo(function LandingProductPreview({
  theme,
}: {
  theme: "light" | "dark";
}) {
  return (
    <section className='landing-preview-section'>
      <div className='landing-section-copy'>
        <span>SEE THE WHOLE SYSTEM</span>
        <h2>From file tree to execution flow</h2>
        <p>
          Atlas turns source code into a navigable model. Select any component
          to see where its data comes from and what happens next.
        </p>
      </div>
      <div className='preview-switchers'>
        <article>
          <i><Network aria-hidden='true' /></i>
          <span><b>Component graph</b><small>See every relationship</small></span>
        </article>
        <article>
          <i><Workflow aria-hidden='true' /></i>
          <span><b>Execution flow</b><small>Follow behavior step by step</small></span>
        </article>
        <article>
          <i><Code2 aria-hidden='true' /></i>
          <span><b>Connected source</b><small>Jump directly to the code</small></span>
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
      </div>
    </section>
  );
});
