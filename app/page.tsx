"use client";

import { useState } from "react";

const files = ["App.tsx", "pages/Dashboard.tsx", "components/Header.tsx", "components/ActivityFeed.tsx", "components/ActivityCard.tsx", "hooks/useActivity.ts", "services/activityApi.ts", "utils/formatDate.ts"];

const details: Record<string, { file: string; type: string; parent: string; children: string; metrics: string[]; steps: string[] }> = {
  Dashboard: { file: "src/pages/Dashboard.tsx", type: "Page", parent: "App", children: "Header, ActivityFeed", metrics: ["3 props", "1 local state", "2 hooks & effects", "2 events & API"], steps: ["Dashboard renders when the ‘/’ route opens.", "useActivity initializes state.", "useEffect requests data from activityApi.", "The response updates state.", "Dashboard passes activities to ActivityFeed.", "ActivityFeed renders an ActivityCard.", "Selecting an item triggers onSelect."] },
  Header: { file: "src/components/Header.tsx", type: "Component", parent: "Dashboard", children: "None", metrics: ["2 props", "0 local state", "0 effects", "1 event"], steps: ["Dashboard renders Header.", "Header receives the current user as a prop.", "Navigation items are rendered.", "A click emits an onNavigate callback."] },
  ActivityFeed: { file: "src/components/ActivityFeed.tsx", type: "Component", parent: "Dashboard", children: "ActivityCard", metrics: ["3 props", "0 local state", "0 effects", "1 event"], steps: ["Dashboard passes activities into ActivityFeed.", "ActivityFeed checks the loading state.", "Activities are mapped into cards.", "ActivityCard receives each activity.", "Selection is passed back through onSelect."] },
  ActivityCard: { file: "src/components/ActivityCard.tsx", type: "Component", parent: "ActivityFeed", children: "None", metrics: ["2 props", "0 local state", "0 effects", "1 event"], steps: ["ActivityFeed renders one card per item.", "Activity data is displayed.", "Clicking the card calls onSelect."] },
  useActivity: { file: "src/hooks/useActivity.ts", type: "Hook", parent: "Dashboard", children: "activityApi", metrics: ["0 props", "2 local states", "1 effect", "1 API call"], steps: ["Dashboard calls useActivity.", "Loading and activity state initialize.", "An effect requests activity data.", "The result updates state.", "The hook returns data to Dashboard."] },
  activityApi: { file: "src/services/activityApi.ts", type: "Service", parent: "useActivity", children: "None", metrics: ["0 props", "0 local state", "0 effects", "1 endpoint"], steps: ["useActivity calls getActivity.", "A GET request is created.", "The response is parsed.", "Activity data returns to the hook."] },
};

export default function Home() {
  const [selected, setSelected] = useState("Dashboard");
  const [activeStep, setActiveStep] = useState(2);
  const [graphMode, setGraphMode] = useState<"graph" | "flow">("graph");
  const selectedDetail = details[selected] ?? details.Dashboard;
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="product"><span className="logo">A</span><strong>Component Atlas</strong></div>
        <div className="project">▣ <b>acme-dashboard</b>⌄</div>
        <span className="react-badge">⚛ React</span>
        <span className="analysis"><i /> Analysis complete <small>2m ago</small></span>
        <div className="header-spacer" />
        <button className="search">⌕&nbsp; Search project <kbd>⌘ K</kbd></button>
        <button className="icon-button">☼</button><button className="icon-button">⚙</button><span className="avatar">JD</span>
      </header>

      <section className="studio">
        <aside className="explorer">
          <div className="section-label">PROJECT EXPLORER <span>◫</span></div>
          <button className="import-button">↥&nbsp; Import project <span>⌘ I</span></button>
          <div className="import-options"><button>▱<small>Upload folder</small></button><button>⌘<small>Paste code</small></button><button>⑂<small>GitHub</small></button></div>
          <div className="file-search">⌕ Search files… <kbd>⌥ F</kbd></div>
          <div className="file-tabs"><button className="active">Files</button><button>Components</button><button>Routes</button><button>Hooks</button></div>
          <div className="file-tree"><div className="folder">⌄ ▱ <b>src</b><span>10</span></div>{files.map((file) => { const fileName = file.split("/").at(-1)?.replace(/\.tsx?$/, "") ?? file; return <button className={fileName === selected ? "active-file" : ""} key={file} onClick={() => { if (details[fileName]) { setSelected(fileName); setActiveStep(0); } }}>└─ {file}</button>; })}</div>
          <div className="explorer-footer"><i /> 14 files analyzed <span>•••</span></div>
        </aside>

        <section className="canvas-column">
          <div className="canvas-toolbar"><button className={graphMode === "graph" ? "active" : ""} onClick={() => setGraphMode("graph")}>⌘ Component graph</button><button className={graphMode === "flow" ? "active" : ""} onClick={() => setGraphMode("flow")}>⌁ Execution flow</button><small>7 nodes · 8 relationships</small><span /><button>⌕ Find node</button><button>▽ Filter</button><button>•••</button></div>
          <div className={`graph-canvas ${graphMode === "flow" ? "flow-mode" : ""}`}>
            <div className="graph-grid" />
            <div className="connector c1" /><div className="connector c2" /><div className="connector c3" /><div className="connector c4" />
            <button onClick={() => { setSelected("Header"); setActiveStep(0); }} className={`graph-node header-node ${selected === "Header" ? "selected" : ""}`}><span className="node-icon blue">▦</span><b>Header</b><small>components/Header.tsx</small><em>2 props</em></button>
            <button onClick={() => { setSelected("Dashboard"); setActiveStep(0); }} className={`graph-node dashboard-node ${selected === "Dashboard" ? "selected" : ""}`}><span className="node-icon amber">⌁</span><b>Dashboard</b><small>pages/Dashboard.tsx</small><em>3 props&nbsp;&nbsp; 1 state&nbsp;&nbsp; 1 effect</em></button>
            <button onClick={() => { setSelected("ActivityFeed"); setActiveStep(0); }} className={`graph-node feed-node ${selected === "ActivityFeed" ? "selected" : ""}`}><span className="node-icon blue">▦</span><b>ActivityFeed</b><small>components/ActivityFeed.tsx</small><em>3 props&nbsp;&nbsp; 1 event</em></button>
            <button onClick={() => { setSelected("useActivity"); setActiveStep(0); }} className={`graph-node hook-node ${selected === "useActivity" ? "selected" : ""}`}><span className="node-icon purple">∪</span><b>useActivity</b><small>hooks/useActivity.ts</small><em>2 state&nbsp;&nbsp; 1 effect</em></button>
            <button onClick={() => { setSelected("activityApi"); setActiveStep(0); }} className={`graph-node api-node ${selected === "activityApi" ? "selected" : ""}`}><span className="node-icon mint">◇</span><b>activityApi</b><small>services/activityApi.ts</small><em>GET /activity</em></button>
            <button onClick={() => { setSelected("ActivityCard"); setActiveStep(0); }} className={`graph-node card-node ${selected === "ActivityCard" ? "selected" : "muted"}`}><span className="node-icon blue">▦</span><b>ActivityCard</b><small>components/ActivityCard.tsx</small><em>2 props&nbsp;&nbsp; 1 event</em></button>
            <div className="zoom-controls">− <small>100%</small> ＋　⌗　↻</div>
            <div className="graph-legend"><span>━ Import / render</span><span className="mint-text">━ Data flow</span><span className="purple-text">┄ Callback</span><span>┈ API</span></div>
            <div className="minimap"><i /><i /><i /><i /></div>
          </div>
          <div className="code-preview"><div className="code-tabs"><b>⌁ Dashboard.tsx ●</b><span>∪ useActivity.ts</span><span>◇ activityApi.ts</span><em>Step 3 of 7 · Lines 11–14</em></div><pre><code><span>1</span> <i>import</i> Header <i>from</i> <q>&apos;../components/Header&apos;</q>;
{"\n"}<span>2</span> <i>import</i> ActivityFeed <i>from</i> <q>&apos;../components/ActivityFeed&apos;</q>;
{"\n"}<span>3</span> <i>import</i> useActivity <i>from</i> <q>&apos;../hooks/useActivity&apos;</q>;
{"\n\n"}<span>5</span> <i>export function</i> <b>Dashboard</b>() {'{'}
{"\n"}<span>6</span> &nbsp; <i>const</i> {'{'} activities, isLoading, error {'}'} = useActivity();
{"\n"}<span>7</span> &nbsp; <i>return</i> &lt;ActivityFeed items={'{'}activities{'}'} /&gt;;
{"\n"}<span>8</span> {'}'}</code></pre></div>
        </section>

        <aside className="inspector"><div className="section-label">FLOW INSPECTOR <mark>Selected</mark><span>◫</span></div><div className="component-title"><span className={`node-icon ${selectedDetail.type === "Page" ? "amber" : selectedDetail.type === "Hook" ? "purple" : selectedDetail.type === "Service" ? "mint" : "blue"}`}>{selectedDetail.type === "Hook" ? "∪" : selectedDetail.type === "Service" ? "◇" : selectedDetail.type === "Page" ? "⌁" : "▦"}</span><div><h2>{selected} <small>{selectedDetail.type}</small></h2><p>{selectedDetail.file}</p></div></div><div className="inspector-tabs"><button className="active">Overview</button><button>Relations</button><button>Source</button></div><div className="metric-grid">{selectedDetail.metrics.map((metric) => { const [number = "0"] = metric.match(/\d+/) ?? []; return <div key={metric}>{metric.replace(number, "")} <b>{number}</b><small>{metric}</small></div>; })}</div><h3>RELATIONSHIPS</h3><div className="relation"><span>Parent</span><b>⌁ {selectedDetail.parent}</b></div><div className="relation"><span>Children</span><b>▦ {selectedDetail.children}</b></div><h3>HOW THIS COMPONENT WORKS</h3><p className="steps-note">{selectedDetail.steps.length} steps · Select a step to trace it</p><ol className="steps">{selectedDetail.steps.map((step, index) => <li className={index === activeStep ? "active" : ""} key={step} onClick={() => setActiveStep(index)}><span>{index + 1}</span><p>{step}<small>{selected}.tsx · Lines {index + 4}–{index + 7}</small></p><b>›</b></li>)}</ol></aside>
      </section>
    </main>
  );
}
