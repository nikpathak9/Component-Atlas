import assert from "node:assert/strict";
import test from "node:test";
import { analyzeProjectSources, analyzeSources, resolveLocalImport } from "../app/analyzer/index";

test("builds component relationships and metrics from TypeScript and JSX AST nodes", () => {
  const result = analyzeSources({
    "src/pages/Dashboard.tsx": `
      import { useEffect, useState as useLocalState } from "react";
      import Header from "../components/Header";
      import { useActivity } from "../hooks/useActivity";

      export function Dashboard({ user, onSave }: DashboardProps) {
        const [selected, setSelected] = useLocalState(user.id);
        const activities = useActivity(selected);
        useEffect(() => {
          onSave(selected);
        }, [selected, onSave]);
        return <Header user={user} activities={activities} onSelect={setSelected} />;
      }
    `,
    "src/components/Header.tsx": `export default function Header({ user }: HeaderProps) { return <header>{user.name}</header>; }`,
    "src/hooks/useActivity.ts": `export function useActivity(id: string) { return id ? [] : []; }`,
  });

  assert.equal(result.nodes.length, 3);
  const dashboard = result.nodes.find((node) => node.file === "src/pages/Dashboard.tsx");
  assert.equal(dashboard?.name, "Dashboard");
  assert.equal(dashboard?.kind, "Page");
  assert.match(dashboard?.meta ?? "", /2 props/);
  assert.match(dashboard?.meta ?? "", /1 state/);
  assert.match(dashboard?.meta ?? "", /1 effect/);

  assert.deepEqual(
    result.edges.map(({ from, to, dashed }) => ({ from, to, dashed })),
    [
      { from: "src/pages/Dashboard.tsx", to: "src/components/Header.tsx", dashed: false },
      { from: "src/pages/Dashboard.tsx", to: "src/hooks/useActivity.ts", dashed: true },
    ],
  );
  assert.equal(result.edges.find((edge) => edge.to === "src/components/Header.tsx")?.kind, "callback");
  assert.equal(result.edges.find((edge) => edge.to === "src/hooks/useActivity.ts")?.kind, "data");
  assert.match(result.details["src/pages/Dashboard.tsx"].steps.join(" "), /renders Header/);
  assert.match(result.details["src/pages/Dashboard.tsx"].steps.join(" "), /useState, useActivity, useEffect/);
  assert.match(result.details["src/pages/Dashboard.tsx"].steps.join(" "), /imports Header from src\/components\/Header\.tsx; this is why Dashboard connects to Header/);
  assert.match(result.details["src/pages/Dashboard.tsx"].steps.join(" "), /selected starts with user\.id; calling setSelected/);
  assert.match(result.details["src/pages/Dashboard.tsx"].steps.join(" "), /effect reruns when selected, onSave changes/);
  assert.match(result.details["src/pages/Dashboard.tsx"].steps.join(" "), /onSelect sends the user interaction to setSelected/);
  assert.match(result.details["src/pages/Dashboard.tsx"].steps.join(" "), /user ← user.*activities ← activities.*onSelect ← setSelected.*enters the child component/);
  assert.ok(result.details["src/pages/Dashboard.tsx"].explanations.some((item) => item.kind === "state" && item.line === 7));
  assert.ok(result.details["src/pages/Dashboard.tsx"].explanations.some((item) => item.kind === "effect" && item.line === 9 && item.endLine === 11));
  assert.equal(result.issues.length, 0);
});

test("detects circular dependencies and annotates every file in the cycle", async () => {
  const result = await analyzeProjectSources({
    "src/A.ts": `import { b } from "./B"; export const a = () => b();`,
    "src/B.ts": `import { c } from "./C"; export const b = () => c();`,
    "src/C.ts": `import { a } from "./A"; export const c = () => a();`,
  });

  assert.ok(result.issues.some((issue) => issue.title === "Circular dependency" && /src\/A\.ts/.test(issue.detail)));
  assert.ok(result.details["src/A.ts"].explanations.some((item) => item.kind === "diagnostic" && /Circular dependency/.test(item.text)));
  assert.ok(result.details["src/B.ts"].insights.diagnostics.some((issue) => issue.title === "Circular dependency"));
});

test("explains API origins, methods, event triggers, and incoming export relationships", () => {
  const result = analyzeSources({
    "src/services/activity.ts": `export async function saveActivity(value: string) { return fetch("/api/activity", { method: "POST", body: value }); }`,
    "src/components/Editor.tsx": `import { saveActivity } from "../services/activity"; export function Editor({ value }) { return <button onClick={() => saveActivity(value)}>Save</button>; }`,
  });
  const service = result.details["src/services/activity.ts"];
  const editor = result.details["src/components/Editor.tsx"];

  assert.match(service.steps.join(" "), /POST API request to "\/api\/activity"/);
  assert.match(service.steps.join(" "), /referenced by Editor/);
  assert.match(editor.steps.join(" "), /onClick sends the user interaction to a callback/);
  assert.ok(service.explanations.some((item) => item.kind === "api" && item.line === 1));
  assert.ok(editor.explanations.some((item) => item.kind === "event" && item.line === 1));
});

test("reports parser failures and unresolved local imports with source locations", () => {
  const result = analyzeSources({
    "src/Broken.tsx": `import Missing from "./Missing";\nexport function Broken( { return <Missing />; }`,
  });

  assert.ok(result.issues.some((issue) => issue.title === "Invalid source syntax" && issue.file === "src/Broken.tsx"));
  assert.ok(result.issues.some((issue) => issue.title === "Unresolved import" && issue.detail === "./Missing" && issue.line === 1));
});

test("ignores type-only relationships while resolving aliases and index files", () => {
  const sources = {
    "src/App.tsx": `import { type User } from "./types"; import Card from "@/components/Card"; export default function App() { return <Card />; }`,
    "src/types.ts": `export type User = { id: string };`,
    "src/components/Card/index.tsx": `export default function Card() { return <article />; }`,
  };
  const files = Object.keys(sources);

  assert.equal(resolveLocalImport("src/App.tsx", "@/components/Card", files), "src/components/Card/index.tsx");
  const result = analyzeSources(sources);
  assert.deepEqual(result.edges.map((edge) => edge.to), ["src/components/Card/index.tsx"]);
  assert.equal(result.issues.length, 0);
});

test("resolves local styles, data, and assets without adding graph nodes", () => {
  const result = analyzeSources({
    "src/components/Card.tsx": `import "./Card.css"; import logo from "../assets/logo.svg"; import content from "../data/card.json"; export function Card() { return <img src={logo} alt={content.title} />; }`,
    "src/components/Card.css": `.card { background: white; }`,
    "src/assets/logo.svg": `<svg viewBox="0 0 10 10" />`,
    "src/data/card.json": `{"title":"Atlas"}`,
  });

  assert.equal(result.nodes.length, 1);
  assert.deepEqual(result.details["src/components/Card.tsx"].relations.resources, [
    "src/components/Card.css",
    "src/assets/logo.svg",
    "src/data/card.json",
  ]);
  assert.match(result.details["src/components/Card.tsx"].steps.join(" "), /Card\.css.*logo\.svg.*card\.json/);
});
