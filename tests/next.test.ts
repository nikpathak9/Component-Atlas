import assert from "node:assert/strict";
import test from "node:test";
import { analyzeNextProject } from "../app/analyzer/next";
import { analyzeProjectSources } from "../app/analyzer/index";

test("maps App Router layouts, dynamic pages, client components, and route handlers", async () => {
  const sources = {
    "package.json": JSON.stringify({ dependencies: { next: "latest", react: "latest" } }),
    "app/layout.tsx": `export default function RootLayout({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html>; }`,
    "app/blog/[slug]/page.tsx": `export async function generateStaticParams() { return []; } export default function BlogPage() { return <main />; }`,
    "app/blog/[slug]/loading.tsx": `"use client"; export default function Loading() { return <p>Loading</p>; }`,
    "app/api/posts/route.ts": `export async function GET() { return Response.json([]); }`,
  };
  const next = analyzeNextProject(sources);
  const result = await analyzeProjectSources(sources);

  assert.equal(next.detected, true);
  assert.equal(next.router, "App Router");
  assert.equal(next.files["app/blog/[slug]/page.tsx"].route, "/blog/:slug");
  assert.equal(next.files["app/blog/[slug]/loading.tsx"].rendering, "Client Component");
  assert.equal(result.nodes.find((node) => node.file === "app/api/posts/route.ts")?.kind, "Service");
  assert.ok(result.edges.some((edge) => edge.from === "app/layout.tsx" && edge.to === "app/blog/[slug]/page.tsx"));
  assert.match(result.details["app/api/posts/route.ts"].steps.join(" "), /handles GET HTTP requests/);
});

test("maps Pages Router pages, API routes, and data-loading conventions", async () => {
  const result = await analyzeProjectSources({
    "pages/_app.tsx": `export default function App({ Component, pageProps }) { return <Component {...pageProps} />; }`,
    "pages/products/[id].tsx": `export async function getServerSideProps() { return { props: {} }; } export default function Product() { return <main />; }`,
    "pages/api/products.ts": `export default function handler() { return null; }`,
  });

  assert.equal(result.nodes.find((node) => node.file === "pages/products/[id].tsx")?.kind, "Page");
  assert.equal(result.nodes.find((node) => node.file === "pages/api/products.ts")?.kind, "Service");
  assert.ok(result.edges.some((edge) => edge.from === "pages/_app.tsx" && edge.to === "pages/products/[id].tsx"));
  assert.match(result.details["pages/products/[id].tsx"].steps.join(" "), /getServerSideProps/);
});
