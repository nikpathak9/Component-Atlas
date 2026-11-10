/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { memo, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import Activity from "lucide-react/icons/activity";
import BookOpen from "lucide-react/icons/book-open";
import Boxes from "lucide-react/icons/boxes";
import ChevronLeft from "lucide-react/icons/chevron-left";
import ChevronRight from "lucide-react/icons/chevron-right";
import Code2 from "lucide-react/icons/code-2";
import Database from "lucide-react/icons/database";
import GitBranch from "lucide-react/icons/git-branch";
import PanelLeft from "lucide-react/icons/panel-left";
import PanelRight from "lucide-react/icons/panel-right";
import Route from "lucide-react/icons/route";
import { useShallow } from "zustand/react/shallow";
import { HighlightedCode } from "../code/highlighted-code";
import { buildCodeUnderstanding, explanationWhy, relationshipMeaning, type ExplanationLevel, type InspectorRelationship } from "../../lib/code-understanding";
import { fileIcon } from "../../lib/file-types";
import { useEditorStore } from "../../stores/editor-store";
import { useWorkspaceUiStore, type InspectorTab } from "../../stores/ui-store";
import type { NodeDetail, NodeKind } from "../../types/workspace";

type Insights = NonNullable<NodeDetail["insights"]>;

type Props = {
  selected: string;
  selectedName: string;
  detail: NodeDetail;
  insights: Insights;
  relationships: InspectorRelationship[];
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSelectNode: (id: string) => void;
  onOpenFile: (file: string) => void | Promise<void>;
  onJumpToCode: (file: string, line: number, endLine?: number) => void;
  onFocusLoadedCode: (file: string, line: number, endLine?: number) => void;
  notify: (message: string) => void;
};

const nodeKindIcon = (kind: NodeKind) =>
  kind === "Page" ? <Route aria-hidden='true' />
    : kind === "Hook" ? <Activity aria-hidden='true' />
      : kind === "Service" ? <Database aria-hidden='true' />
        : kind === "Utility" ? <Code2 aria-hidden='true' />
          : <Boxes aria-hidden='true' />;

const kindTone = (kind: NodeKind) =>
  kind === "Page" ? "amber" : kind === "Hook" ? "purple" : kind === "Service" ? "mint" : kind === "Utility" ? "slate" : "blue";

const lineRangeLabel = (line: number, endLine = line) =>
  endLine > line ? `Lines ${line}–${endLine}` : `Line ${line}`;

const explanationKindLabel = (kind: string) => ({
  declaration: "Declaration", import: "Import", render: "Render", hook: "Hook",
  props: "Data input", state: "State", effect: "Effect", event: "Event", api: "API",
  resource: "Resource", export: "Used by", diagnostic: "Issue",
})[kind] ?? "Analysis";

function inferExplanationEndLine(source: string, line: number, kind: string) {
  const lines = source.split("\n");
  const startIndex = Math.max(0, Math.min(lines.length - 1, line - 1));
  if (["diagnostic", "import", "export", "resource", "event"].includes(kind)) return line;
  if (kind === "render") {
    const remainder = lines.slice(startIndex, startIndex + 120).join("\n");
    const tag = remainder.match(/<([A-Za-z][\w.]*)\b/);
    if (tag) {
      const openingEnd = remainder.indexOf(">", tag.index ?? 0);
      const selfClosing = openingEnd >= 0 && /\/\s*>$/.test(remainder.slice(tag.index ?? 0, openingEnd + 1));
      const closingStart = selfClosing ? openingEnd : remainder.indexOf(`</${tag[1]}>`, openingEnd + 1);
      const closingEnd = selfClosing ? openingEnd : closingStart >= 0 ? closingStart + tag[1].length + 3 : -1;
      if (closingEnd >= openingEnd && openingEnd >= 0) return line + remainder.slice(0, closingEnd).split("\n").length - 1;
    }
  }
  const opener = ["declaration", "props"].includes(kind) ? "{" : "(";
  const closer = opener === "{" ? "}" : ")";
  let depth = 0;
  let started = false;
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 120); index += 1) {
    const scrubbed = lines[index].replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "").replace(/\/\/.*$/, "");
    for (const character of scrubbed) {
      if (character === opener) { depth += 1; started = true; }
      if (character === closer && started) depth -= 1;
    }
    if (started && depth <= 0) return index + 1;
  }
  return line;
}

export const FlowInspector = memo(function FlowInspector({
  selected, selectedName, detail, insights, relationships, onResizeStart,
  onSelectNode, onOpenFile, onJumpToCode, onFocusLoadedCode, notify,
}: Props) {
  const { inspectorCollapsed, inspectorWidth, inspectorTab, setInspectorCollapsed, setInspectorWidth, setInspectorTab, setModal } = useWorkspaceUiStore(useShallow((state) => ({
    inspectorCollapsed: state.inspectorCollapsed,
    inspectorWidth: state.inspectorWidth,
    inspectorTab: state.inspectorTab,
    setInspectorCollapsed: state.setInspectorCollapsed,
    setInspectorWidth: state.setInspectorWidth,
    setInspectorTab: state.setInspectorTab,
    setModal: state.setModal,
  })));
  const { activeStep, setActiveStep } = useEditorStore(useShallow((state) => ({ activeStep: state.activeStep, setActiveStep: state.setActiveStep })));
  const explanations = detail.explanations ?? detail.steps.map((text) => ({ text, line: 1, endLine: 1, kind: "analysis" }));
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [explanationLevel, setExplanationLevel] = useState<ExplanationLevel>("simple");
  const understanding = useMemo(
    () => buildCodeUnderstanding(detail, relationships),
    [detail, relationships],
  );
  const incomingRelationships = relationships.filter((edge) => edge.direction === "incoming");
  const outgoingRelationships = relationships.filter((edge) => edge.direction === "outgoing");
  const resources = detail.relations?.resources ?? [];
  const simpleWorkflow = understanding.flow.slice(0, 4);
  const developerWorkflow = explanations.filter((step) => step.kind !== "diagnostic");
  const workflow = explanationLevel === "simple" ? simpleWorkflow : developerWorkflow;
  const visibleWorkflow = showAllSteps ? workflow : workflow.slice(0, explanationLevel === "simple" ? 4 : 6);
  const activeExplanation = explanations[Math.min(Math.max(activeStep, 0), Math.max(explanations.length - 1, 0))];
  const activeWorkflowIndex = workflow.findIndex((step) =>
    step.line === activeExplanation?.line
    && step.kind === activeExplanation?.kind
    && step.text === activeExplanation?.text,
  );

  const openExplanation = (step: { text: string; line: number; endLine?: number; kind: string }) => {
    const index = explanations.findIndex((item) => item.line === step.line && item.kind === step.kind && item.text === step.text);
    if (index >= 0) setActiveStep(index);
    onJumpToCode(detail.file, step.line, step.endLine ?? inferExplanationEndLine(detail.source, step.line, step.kind));
  };

  const moveWorkflowStep = (direction: -1 | 1) => {
    if (!workflow.length) return;
    const currentIndex = activeWorkflowIndex < 0
      ? (direction === 1 ? -1 : workflow.length)
      : activeWorkflowIndex;
    const nextIndex = Math.min(workflow.length - 1, Math.max(0, currentIndex + direction));
    openExplanation(workflow[nextIndex]);
  };

  useEffect(() => setShowAllSteps(false), [selected]);

  return (
    <aside className={`inspector ${inspectorCollapsed ? "panel-collapsed" : ""}`}>
      <div className='resize-handle resize-left' role='separator' tabIndex={0} aria-label='Resize flow inspector' aria-orientation='vertical' aria-valuemin={350} aria-valuemax={560} aria-valuenow={inspectorWidth}
        onKeyDown={(event) => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); setInspectorWidth((current) => Math.min(560, Math.max(350, current + (event.key === "ArrowLeft" ? 10 : -10)))); }}
        onPointerDown={onResizeStart} />
      <div className='section-label'>
        <span className='panel-title'>FLOW INSPECTOR</span>{selected && <mark>Inspecting</mark>}
        <button className='panel-toggle' type='button' aria-label={inspectorCollapsed ? "Expand flow inspector" : "Collapse flow inspector"} title={inspectorCollapsed ? "Expand flow inspector" : "Collapse flow inspector"} aria-expanded={!inspectorCollapsed} onClick={() => setInspectorCollapsed((current) => !current)}>
          {inspectorCollapsed ? <PanelLeft aria-hidden='true' /> : <PanelRight aria-hidden='true' />}
        </button>
      </div>
      {selected ? <div className='component-title'><span className={`node-icon ${kindTone(detail.type)}`}>{nodeKindIcon(detail.type)}</span><div><h2>{selectedName} <small>{detail.type}</small></h2><p>{detail.file}</p></div></div>
        : <div className='inspector-empty-state'><PanelRight aria-hidden='true' /><b>Nothing selected</b><p>Select a graph node or file to inspect how it works.</p></div>}
      {selected && <>
      <div className='inspector-tabs' role='tablist' aria-label='Inspector views' tabIndex={0} onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
        const current = tabs.indexOf(document.activeElement as HTMLButtonElement); if (current < 0) return;
        event.preventDefault(); const next = (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; tabs[next]?.focus(); tabs[next]?.click();
      }}>
        {(["Overview", "Relations", "Source"] as InspectorTab[]).map((tab) => <button className={inspectorTab === tab ? "active" : ""} key={tab} role='tab' aria-selected={inspectorTab === tab} onClick={() => setInspectorTab(tab)}>{tab === "Overview" ? "Understand" : tab === "Relations" ? "Connections" : tab}</button>)}
      </div>
      <div className='inspector-scroll-body'>
      {inspectorTab === "Overview" && <>
        <div className='understanding-level' role='group' aria-label='Explanation detail level'>
          <span>Explanation</span>
          {(["simple", "developer"] as ExplanationLevel[]).map((level) => (
            <button key={level} className={explanationLevel === level ? "active" : ""} aria-pressed={explanationLevel === level} onClick={() => setExplanationLevel(level)}>{level}</button>
          ))}
        </div>
        <section className='inspector-purpose'>
          <header><BookOpen aria-hidden='true' /><div><h3>What this file does</h3>{explanationLevel === "developer" && <small>{understanding.role}</small>}</div></header>
          <p>{understanding.purpose}</p>
        </section>
        <section className='inspector-workflow'>
          <header><span><GitBranch aria-hidden='true' /><h3>How it works</h3></span><small>{workflow.length} {workflow.length === 1 ? "step" : "steps"}</small></header>
          <p className='inspector-section-intro'>Select a step to highlight the relevant code.</p>
          <ol>
            {visibleWorkflow.map((step, index) => {
              const stepIndex = explanations.findIndex((item) => item.line === step.line && item.kind === step.kind && item.text === step.text);
              const endLine = step.endLine ?? inferExplanationEndLine(detail.source, step.line, step.kind);
              const hasIssue = step.kind === "diagnostic";
              return <li className={`${stepIndex === activeStep ? "active " : ""}${hasIssue ? "has-issue" : ""}`} key={`${step.kind}-${step.line}-${step.text}`}>
                <button onClick={() => openExplanation(step)}>
                  <i>{hasIssue ? "!" : index + 1}</i>
                  <span><b>{explanationKindLabel(step.kind)}</b><strong>{step.text}</strong>{explanationLevel === "developer" && <small>{explanationWhy(step.kind)} · {lineRangeLabel(step.line, endLine)}</small>}</span>
                  <ChevronRight aria-hidden='true' />
                </button>
              </li>;
            })}
          </ol>
          <div className='workflow-actions'>
            <button disabled={activeWorkflowIndex <= 0} onClick={() => moveWorkflowStep(-1)}><ChevronLeft aria-hidden='true' /> Previous</button>
            <button disabled={activeWorkflowIndex >= workflow.length - 1} onClick={() => moveWorkflowStep(1)}>Next <ChevronRight aria-hidden='true' /></button>
          </div>
          {workflow.length > visibleWorkflow.length && <button className='workflow-show-all' aria-expanded={showAllSteps} onClick={() => setShowAllSteps(true)}>Show all {workflow.length} steps <ChevronRight aria-hidden='true' /></button>}
          {showAllSteps && workflow.length > (explanationLevel === "simple" ? 4 : 6) && <button className='workflow-show-all' onClick={() => setShowAllSteps(false)}>Show fewer steps</button>}
        </section>
        <section className='inspector-impact'>
          <header><Activity aria-hidden='true' /><h3>Why this matters</h3></header>
          <p>{understanding.impact.summary}{understanding.impact.resources.length ? ` It also uses ${understanding.impact.resources.length} linked ${understanding.impact.resources.length === 1 ? "resource" : "resources"}.` : ""}</p>
          {explanationLevel === "developer" && incomingRelationships.length > 0 && <div>{incomingRelationships.slice(0, 4).map((edge) => <button key={`${edge.from}-${edge.to}`} onClick={() => edge.peer && onSelectNode(edge.peer.id)}>{edge.peer?.name ?? edge.from}<ChevronRight aria-hidden='true' /></button>)}</div>}
        </section>
        {insights.diagnostics.length > 0 && <button className='inspector-issue-summary' onClick={() => setModal("diagnostics")}>
          <span><Activity aria-hidden='true' /><span><b>{insights.diagnostics.length} {insights.diagnostics.length === 1 ? "issue" : "issues"} need attention</b><small>Open Project Health to review affected files and lines.</small></span></span><ChevronRight aria-hidden='true' />
        </button>}
        {explanationLevel === "developer" && <details className='technical-details'>
          <summary><span><Code2 aria-hidden='true' /><b>Technical details</b></span><small>Props, hooks, state and exports</small><ChevronRight aria-hidden='true' /></summary>
          <div className='technical-detail-grid'>
            {(insights.framework?.length ?? 0) > 0 && <article><b>Framework</b><p>{insights.framework?.join(", ")}</p></article>}
            <article><b>Props</b><p>{insights.props.length ? insights.props.join(", ") : "None detected"}</p></article>
            <article><b>Hooks</b><p>{insights.hooks.length ? insights.hooks.join(", ") : "None detected"}</p></article>
            <article><b>Exports</b><p>{insights.exports.length ? insights.exports.join(", ") : "None detected"}</p></article>
            <article><b>Analysis</b><p>{detail.metrics.join(" · ") || `${understanding.explanationCount} detected behaviors`}</p></article>
          </div>
        </details>}
      </>}
      {inspectorTab === "Relations" && <div className='connections-panel'>
        <div className='connection-counts'><span><b>{incomingRelationships.length}</b>Receives from</span><span><b>{outgoingRelationships.length}</b>Sends to</span><span><b>{resources.length}</b>Resources</span></div>
        <section className='connection-group'>
          <header><div><h3>Receives from</h3><p>Files that render, import, or provide data to this file.</p></div><b>{incomingRelationships.length}</b></header>
          {incomingRelationships.length ? <div>{incomingRelationships.map((edge) => <button key={`${edge.from}-${edge.to}`} onClick={() => edge.peer && onSelectNode(edge.peer.id)}><i className={`relationship-dot edge-${edge.kind ?? "import"}`} /><span><span><b>{edge.peer?.name ?? edge.from}</b><em>{edge.kind ?? "import"}</em></span><p>{relationshipMeaning(edge)}</p>{edge.line && <small>{detail.file} · Line {edge.line}</small>}</span><ChevronRight aria-hidden='true' /></button>)}</div> : <p className='connections-empty'>No incoming connections were detected.</p>}
        </section>
        <section className='connection-group'>
          <header><div><h3>Sends to</h3><p>Files, components, routes, or services used by this file.</p></div><b>{outgoingRelationships.length}</b></header>
          {outgoingRelationships.length ? <div>{outgoingRelationships.map((edge) => <button key={`${edge.from}-${edge.to}`} onClick={() => edge.peer && onSelectNode(edge.peer.id)}><i className={`relationship-dot edge-${edge.kind ?? "import"}`} /><span><span><b>{edge.peer?.name ?? edge.to}</b><em>{edge.kind ?? "import"}</em></span><p>{relationshipMeaning(edge)}</p>{edge.line && <small>{detail.file} · Line {edge.line}</small>}</span><ChevronRight aria-hidden='true' /></button>)}</div> : <p className='connections-empty'>No outgoing connections were detected.</p>}
        </section>
        <section className='connection-group resource-connections'>
          <header><div><h3>Resources</h3><p>Styles, assets, or local data used by this file.</p></div><b>{resources.length}</b></header>
          {resources.length ? <div>{resources.map((file) => <button key={file} onClick={() => void onOpenFile(file)}>{fileIcon(file)}<span><b>{file.split("/").at(-1)}</b><small>{file}</small></span><ChevronRight aria-hidden='true' /></button>)}</div> : <p className='connections-empty'>No linked resources were detected.</p>}
        </section>
      </div>}
      {inspectorTab === "Source" && <div className='source-panel inspector-source-view'>
        <div className='source-context'><span><b>{activeExplanation ? lineRangeLabel(activeExplanation.line, activeExplanation.endLine) : "Full source"}</b><small>{activeExplanation?.text ?? "Select a workflow step to highlight its source range."}</small></span>{insights.diagnostics.length > 0 && <button onClick={() => onFocusLoadedCode(insights.diagnostics[0].file, insights.diagnostics[0].line)}>{insights.diagnostics.length} issues</button>}</div>
        <div className='source-actions'><button onClick={() => activeExplanation && onJumpToCode(detail.file, activeExplanation.line, activeExplanation.endLine)}>Open in code panel</button><button onClick={() => navigator.clipboard?.writeText(detail.source).then(() => notify("Source copied"))}>Copy source</button></div>
        <pre><HighlightedCode source={detail.source} highlightedLine={activeExplanation?.line} highlightedEndLine={activeExplanation?.endLine} diagnostics={insights.diagnostics} /></pre>
      </div>}
      </div>
      </>}
    </aside>
  );
});
