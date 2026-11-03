import assert from "node:assert/strict";
import test from "node:test";
import { analyzeBundlerConfig } from "../app/analyzer/bundler";
import { analyzeProjectSources, resolveLocalImport } from "../app/analyzer/index";

test("reads Vite and Webpack aliases without executing configuration", () => {
  const vite = analyzeBundlerConfig({
    "vite.config.ts": `import { defineConfig } from "vite"; import path from "node:path"; export default defineConfig({ resolve: { alias: { "@ui": path.resolve(__dirname, "src/components") } } });`,
  });
  const webpack = analyzeBundlerConfig({
    "webpack.config.js": `module.exports = { resolve: { alias: { "@data": "./src/data" } } };`,
  });

  assert.deepEqual(vite.tools, ["Vite"]);
  assert.equal(vite.aliases["@ui"], "src/components");
  assert.deepEqual(webpack.tools, ["Webpack"]);
  assert.equal(webpack.aliases["@data"], "src/data");
});

test("uses bundler aliases to create graph edges and explain lazy and asset imports", async () => {
  const result = await analyzeProjectSources({
    "vite.config.ts": `export default { resolve: { alias: { "@ui": "./src/components" } } };`,
    "package.json": JSON.stringify({ devDependencies: { vite: "latest" } }),
    "src/App.tsx": `import "./app.css"; import "@ui/card.css"; import Card from "@ui/Card"; export async function loadPanel() { return import("@ui/Panel"); } export function App() { return <Card />; }`,
    "src/components/Card.tsx": `export default function Card() { return <article />; }`,
    "src/components/Panel.tsx": `export default function Panel() { return <aside />; }`,
  });

  assert.ok(result.edges.some((edge) => edge.from === "src/App.tsx" && edge.to === "src/components/Card.tsx"));
  assert.ok(result.edges.some((edge) => edge.from === "src/App.tsx" && edge.to === "src/components/Panel.tsx"));
  assert.match(result.details["src/App.tsx"].steps.join(" "), /lazy-loads @ui\/Panel/);
  assert.match(result.details["src/App.tsx"].steps.join(" "), /app\.css.*as bundled/);
  assert.match(result.details["src/App.tsx"].steps.join(" "), /@ui\/card\.css/);
  assert.ok(result.details["src/App.tsx"].insights.bundler.includes("@ui → src/components"));
  assert.equal(result.nodes.some((node) => node.file === "vite.config.ts"), false);
});

test("resolves the longest matching configured alias", () => {
  assert.equal(
    resolveLocalImport("src/App.tsx", "@ui/forms/Input", ["src/forms/Input.tsx", "src/components/forms/Input.tsx"], { "@": "src", "@ui": "src/components" }),
    "src/components/forms/Input.tsx",
  );
});
