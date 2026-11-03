import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSources, resolveLocalImport } from "../app/analyzer/index";

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
  assert.match(result.details["src/pages/Dashboard.tsx"].steps.join(" "), /renders Header/);
  assert.match(result.details["src/pages/Dashboard.tsx"].steps.join(" "), /useState, useActivity, useEffect/);
  assert.ok(result.details["src/pages/Dashboard.tsx"].explanations.some((item) => item.kind === "state" && item.line === 7));
  assert.ok(result.details["src/pages/Dashboard.tsx"].explanations.some((item) => item.kind === "effect" && item.line === 9 && item.endLine === 11));
  assert.equal(result.issues.length, 0);
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
