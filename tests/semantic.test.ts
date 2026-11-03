import assert from "node:assert/strict";
import test from "node:test";
import { analyzeProjectSources } from "../app/analyzer/index";

test("adds TypeScript props, diagnostics, and cross-file symbol references", async () => {
  const result = await analyzeProjectSources({
    "src/App.tsx": `import { Dashboard } from "./Dashboard"; export function App() { return <Dashboard title="Atlas" count={2} />; }`,
    "src/Dashboard.tsx": `
      export interface DashboardProps { title: string; count: number }
      export function Dashboard(props: DashboardProps) {
        return <main>{props.title}{props.missing}</main>;
      }
    `,
  });

  assert.match(result.nodes.find((node) => node.file === "src/Dashboard.tsx")?.meta ?? "", /2 props/);
  assert.ok(result.issues.some((issue) => issue.file === "src/Dashboard.tsx" && issue.detail.startsWith("TS2339:")));
  assert.match(result.details["src/Dashboard.tsx"].steps.join(" "), /DashboardProps.*title, count/);
  assert.match(result.details["src/Dashboard.tsx"].steps.join(" "), /referenced by src\/App.tsx/);
  assert.deepEqual(result.details["src/Dashboard.tsx"].relations.usedBy, ["src/App.tsx"]);
  assert.deepEqual(result.details["src/App.tsx"].relations.dependsOn, ["src/Dashboard.tsx"]);
  assert.deepEqual(result.details["src/Dashboard.tsx"].insights.props, ["title", "count"]);
  assert.ok(result.details["src/Dashboard.tsx"].insights.diagnostics.some((issue) => issue.detail.startsWith("TS2339:")));
});

test("uses semantic resolution for dynamic imports and CommonJS requires", async () => {
  const result = await analyzeProjectSources({
    "src/App.tsx": `export async function loadCard() { return import("./Card"); }\nexport const helpers = require("./helpers");`,
    "src/Card.tsx": `export default function Card() { return <article />; }`,
    "src/helpers.ts": `export const format = (value: string) => value.trim();`,
  });

  assert.deepEqual(
    result.details["src/App.tsx"].relations.dependsOn,
    ["src/Card.tsx", "src/helpers.ts"],
  );
});

test("keeps type-only imports out of the semantic runtime graph", async () => {
  const result = await analyzeProjectSources({
    "src/App.tsx": `import { type User } from "./types"; export const user: User = { id: "atlas" };`,
    "src/types.ts": `export type User = { id: string };`,
  });

  assert.deepEqual(result.edges, []);
  assert.deepEqual(result.details["src/App.tsx"].relations.dependsOn, []);
});

test("uses tsconfig path aliases to create semantic graph relationships", async () => {
  const result = await analyzeProjectSources({
    "tsconfig.json": JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "#/*": ["src/*"] } } }),
    "src/App.tsx": `import Card from "#/components/Card"; export default function App() { return <Card />; }`,
    "src/components/Card.tsx": `export default function Card() { return <article />; }`,
  });

  assert.ok(result.edges.some((edge) => edge.from === "src/App.tsx" && edge.to === "src/components/Card.tsx"));
  assert.equal(result.issues.length, 0);
});

test("reports common TypeScript assignment errors with line numbers", async () => {
  const result = await analyzeProjectSources({
    "src/model.ts": `interface User { id: number }\nexport const user: User = { id: "wrong" };`,
  });
  const issue = result.issues.find((candidate) => candidate.detail.startsWith("TS2322:"));
  assert.equal(issue?.title, "Incompatible TypeScript type");
  assert.equal(issue?.line, 2);
});

test("reports real analyzer stages in order", async () => {
  const stages: number[] = [];
  await analyzeProjectSources({
    "src/App.tsx": `export function App() { return <main>Atlas</main>; }`,
  }, (progress) => stages.push(progress.stage));

  assert.deepEqual(stages, [1, 2, 3, 4]);
});
