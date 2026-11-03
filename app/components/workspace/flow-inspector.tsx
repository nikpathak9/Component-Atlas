/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */
import { memo, type PointerEvent as ReactPointerEvent } from "react";
import Activity from "lucide-react/icons/activity";
import Boxes from "lucide-react/icons/boxes";
import ChevronRight from "lucide-react/icons/chevron-right";
import Code2 from "lucide-react/icons/code-2";
import Database from "lucide-react/icons/database";
import PanelLeft from "lucide-react/icons/panel-left";
import PanelRight from "lucide-react/icons/panel-right";
import Route from "lucide-react/icons/route";
import { useShallow } from "zustand/react/shallow";
import { HighlightedCode } from "../code/highlighted-code";
import { fileIcon } from "../../lib/file-types";
import { useEditorStore } from "../../stores/editor-store";
import { useWorkspaceUiStore, type InspectorTab } from "../../stores/ui-store";
import type { GraphEdge, GraphNode, NodeDetail, NodeKind } from "../../types/workspace";

type Relationship = GraphEdge & {
  direction: "incoming" | "outgoing";
  peer?: GraphNode;
};

type Insights = NonNullable<NodeDetail["insights"]>;

type Props = {
  selected: string;
  selectedName: string;
  detail: NodeDetail;
  insights: Insights;
  relationships: Relationship[];
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSelectNode: (id: string) => void;
  onOpenFile: (file: string) => void | Promise<void>;
  onJumpToCode: (file: string, line: number, endLine?: number) => void;
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
  onSelectNode, onOpenFile, onJumpToCode, notify,
}: Props) {
  const { inspectorCollapsed, inspectorWidth, inspectorTab, setInspectorCollapsed, setInspectorWidth, setInspectorTab } = useWorkspaceUiStore(useShallow((state) => ({
    inspectorCollapsed: state.inspectorCollapsed,
    inspectorWidth: state.inspectorWidth,
    inspectorTab: state.inspectorTab,
    setInspectorCollapsed: state.setInspectorCollapsed,
    setInspectorWidth: state.setInspectorWidth,
    setInspectorTab: state.setInspectorTab,
  })));
  const { activeStep, setActiveStep } = useEditorStore(useShallow((state) => ({ activeStep: state.activeStep, setActiveStep: state.setActiveStep })));
  const explanations = detail.explanations ?? detail.steps.map((text) => ({ text, line: 1, endLine: 1, kind: "analysis" }));

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
      <div className='inspector-tabs' role='tablist' aria-label='Inspector views' tabIndex={0} onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
        const current = tabs.indexOf(document.activeElement as HTMLButtonElement); if (current < 0) return;
        event.preventDefault(); const next = (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; tabs[next]?.focus(); tabs[next]?.click();
      }}>
        {(["Overview", "Relations", "Source"] as InspectorTab[]).map((tab) => <button className={inspectorTab === tab ? "active" : ""} key={tab} role='tab' aria-selected={inspectorTab === tab} onClick={() => setInspectorTab(tab)}>{tab}</button>)}
      </div>
      {inspectorTab === "Overview" && <>
        <div className='metric-grid'>{detail.metrics.map((metric) => { const [number = "0"] = metric.match(/\d+/) ?? []; const label = metric.replace(number, "").trim(); return <div key={metric}><b>{number}</b><span>{label || "items"}</span></div>; })}</div>
        <div className='inspector-insight-summary' aria-label='Analysis summary'>
          {(insights.framework?.length ?? 0) > 0 && <span className='framework-insight'>{insights.framework?.[0]}</span>}
          {insights.props.length > 0 && <span>{insights.props.length} props</span>}{insights.hooks.length > 0 && <span>{insights.hooks.length} hooks</span>}{insights.exports.length > 0 && <span>{insights.exports.length} exports</span>}
          {(insights.bundler?.length ?? 0) > 0 && <span>{insights.bundler?.length} build links</span>}{insights.diagnostics.length > 0 && <span className='diagnostic-insight'>{insights.diagnostics.length} issues</span>}
        </div>
        <h3>HOW THIS FILE WORKS</h3><p className='steps-note'>{explanations.length} steps · Select a step to highlight its source range</p>
        <ol className='steps'>{explanations.map((step, index) => { const endLine = step.endLine ?? inferExplanationEndLine(detail.source, step.line, step.kind); const isActive = index === activeStep; const hasIssue = step.kind === "diagnostic"; return (
          <li className={`${isActive ? "active " : ""}${hasIssue ? "has-issue" : ""}`} key={`${step.kind}-${step.line}-${endLine}-${step.text}`}><button type='button' aria-pressed={isActive} aria-label={`${hasIssue ? "Issue: " : ""}${step.text} ${lineRangeLabel(step.line, endLine)}`} onClick={() => { setActiveStep(index); onJumpToCode(detail.file, step.line, endLine); }}><span>{hasIssue ? "!" : index + 1}</span><p><em className={`step-kind step-kind-${step.kind}`}>{explanationKindLabel(step.kind)}</em>{step.text}<small>{detail.file} · {lineRangeLabel(step.line, endLine)}</small></p><b><ChevronRight aria-hidden='true' /></b></button></li>
        ); })}</ol>
      </>}
      {inspectorTab === "Relations" && <div className='tab-panel'>
        <h3>RELATIONSHIPS</h3>
        <div className='relation relationship-summary'><span><Route aria-hidden='true' /> Used by</span><div className='relation-items'>{detail.parent.split(",").map((item) => item.trim()).filter(Boolean).map((item) => <em key={item}>{item}</em>)}</div></div>
        <div className='relation relationship-summary'><span><Boxes aria-hidden='true' /> Depends on</span><div className='relation-items'>{detail.children.split(",").map((item) => item.trim()).filter(Boolean).map((item) => <em key={item}>{item}</em>)}</div></div>
        {relationships.length > 0 ? <div className='relationship-reasons'>{relationships.map((edge) => <button className={`relationship-${edge.direction}`} key={`${edge.from}-${edge.to}`} onClick={() => edge.peer && onSelectNode(edge.peer.id)}><i className={`relationship-dot edge-${edge.kind ?? "import"}`} /><span><b>{edge.peer?.name ?? (edge.direction === "outgoing" ? edge.to : edge.from)}</b><small><em>{edge.direction === "outgoing" ? "Outgoing" : "Incoming"}</em>{" · "}{edge.label ?? edge.kind ?? "Runtime import"}{edge.line ? ` · Line ${edge.line}` : ""}</small></span><ChevronRight aria-hidden='true' /></button>)}</div>
          : <div className='relationships-empty'>No mapped relationships for this file yet.</div>}
        <div className='relation resource-list'><span>Resources</span><div>{detail.relations?.resources?.length ? detail.relations.resources.map((file) => <button title={file} key={file} onClick={() => void onOpenFile(file)}>{fileIcon(file)} {file.split("/").at(-1)}</button>) : <small>None</small>}</div></div>
        <p className='panel-copy'>Each connection is classified from imports, rendered JSX, callbacks, hooks, services, and framework routes.</p>
      </div>}
      {inspectorTab === "Source" && <div className='source-panel'><div><span>{detail.file}</span><button onClick={() => navigator.clipboard?.writeText(detail.source).then(() => notify("Source copied"))}>Copy</button></div><pre><HighlightedCode source={detail.source} /></pre></div>}
    </aside>
  );
});
