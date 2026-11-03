import assert from "node:assert/strict";
import test from "node:test";
import { analyzeProjectSources } from "../app/analyzer/index";
import { analyzeAstroProject, analyzeLightningProject, analyzeRemixProject, analyzeSolidProject, analyzeVueProject } from "../app/analyzer/frameworks";

test("detects SolidStart routes and fine-grained reactive primitives", async () => {
  const sources = {
    "package.json": JSON.stringify({ dependencies: { "solid-js": "latest", "@solidjs/start": "latest" } }),
    "src/root.tsx": `import { Suspense } from "solid-js"; export default function Root(props) { return <Suspense>{props.children}</Suspense>; }`,
    "src/routes/index.tsx": `import { createSignal, Show } from "solid-js"; export default function Home() { const [ready] = createSignal(true); return <Show when={ready()}><main /></Show>; }`,
    "src/routes/users/[id].tsx": `import { createResource } from "solid-js"; export default function User() { const [user] = createResource(() => fetch("/api/user")); return <p>{user()?.name}</p>; }`,
  };
  const solid = analyzeSolidProject(sources);
  const result = await analyzeProjectSources(sources);

  assert.equal(solid.detected, true);
  assert.equal(solid.variant, "SolidStart");
  assert.equal(solid.files["src/routes/users/[id].tsx"].route, "/users/:id");
  assert.equal(result.nodes.find((node) => node.file === "src/routes/index.tsx")?.kind, "Page");
  assert.match(result.details["src/routes/index.tsx"].insights.framework.join(" "), /SolidStart/);
  assert.match(result.details["src/routes/index.tsx"].steps.join(" "), /createSignal/);
  assert.ok(result.edges.some((edge) => edge.from === "src/root.tsx" && edge.to === "src/routes/users/[id].tsx"));
});

test("detects LightningJS screens, templates, lifecycle, and router relationships", async () => {
  const sources = {
    "package.json": JSON.stringify({ dependencies: { "@lightningjs/sdk": "latest" } }),
    "src/App.js": `import { Router } from "@lightningjs/sdk"; import Home from "./screens/Home"; export const routes = [{ path: "home", component: Home }]; export default class App extends Router.App {}`,
    "src/screens/Home.js": `import { Lightning } from "@lightningjs/sdk"; export default class Home extends Lightning.Component { static _template() { return { text: { text: "Home" } }; } _focus() {} _handleEnter() {} }`,
  };
  const lightning = analyzeLightningProject(sources);
  const result = await analyzeProjectSources(sources);

  assert.equal(lightning.detected, true);
  assert.equal(lightning.files["src/App.js"].kind, "Service");
  assert.equal(result.nodes.find((node) => node.file === "src/screens/Home.js")?.kind, "Page");
  assert.match(result.details["src/screens/Home.js"].insights.framework.join(" "), /Lightning/);
  assert.match(result.details["src/screens/Home.js"].steps.join(" "), /_template/);
  assert.match(result.details["src/screens/Home.js"].steps.join(" "), /_focus/);
  assert.ok(result.edges.some((edge) => edge.from === "src/App.js" && edge.to === "src/screens/Home.js"));
});

test("detects Remix routes, data boundaries, and root relationships", () => {
  const sources = {
    "package.json": JSON.stringify({ dependencies: { "@remix-run/react": "latest" } }),
    "app/root.tsx": `import { Outlet } from "@remix-run/react"; export default function Root(){ return <Outlet /> }`,
    "app/routes/users.$id.tsx": `export async function loader(){ return null } export default function User(){ return <main>User</main> }`,
  };
  const result = analyzeRemixProject(sources);
  assert.equal(result.detected, true);
  assert.equal(result.files["app/routes/users.$id.tsx"].route, "/users/:id");
  assert.ok(result.edges.some((edge) => edge.from === "app/root.tsx" && edge.to === "app/routes/users.$id.tsx"));
});

test("detects Vue composition primitives and router modules", () => {
  const sources = {
    "package.json": JSON.stringify({ dependencies: { vue: "latest", "vue-router": "latest" } }),
    "src/App.tsx": `import { ref, computed } from "vue"; export const count = ref(0); export const doubled = computed(() => count.value * 2);`,
    "src/router.ts": `import { createRouter } from "vue-router"; export const router = createRouter({ routes: [] });`,
  };
  const result = analyzeVueProject(sources);
  assert.equal(result.detected, true);
  assert.match(result.files["src/App.tsx"].notes.join(" "), /ref, computed/);
  assert.equal(result.files["src/router.ts"].role, "Vue router");
});

test("maps Nuxt Vue single-file pages", async () => {
  const sources = {
    "package.json": JSON.stringify({ dependencies: { vue: "latest", nuxt: "latest" } }),
    "pages/users/[id].vue": `<script setup lang="ts">import UserCard from "../../components/UserCard.vue"; import { ref } from "vue"; const props = defineProps<{ id: string }>(); const emit = defineEmits<[saved: string]>(); const user = ref(null)</script><template><UserCard /></template>`,
    "components/UserCard.vue": `<script setup>const props = defineProps({ name: String })</script><template><article /></template>`,
    "middleware/auth.ts": `export default defineNuxtRouteMiddleware(() => true)`,
    "pages/private.vue": `<script setup>definePageMeta({ middleware: "auth" })</script><template><UserCard :name="user" @saved="refresh" /></template>`,
  };
  const framework = analyzeVueProject(sources);
  const result = await analyzeProjectSources(sources);
  assert.equal(framework.files["pages/users/[id].vue"].route, "/users/:id");
  assert.equal(result.nodes.find((node) => node.file === "pages/users/[id].vue")?.kind, "Page");
  assert.match(result.details["pages/users/[id].vue"].insights.framework.join(" "), /Nuxt/);
  assert.ok(result.edges.some((edge) => edge.from === "pages/users/[id].vue" && edge.to === "components/UserCard.vue" && edge.kind === "render"));
  assert.match(framework.files["pages/users/[id].vue"].notes.join(" "), /component props/);
  assert.ok(framework.edges.some((edge) => edge.from === "middleware/auth.ts" && edge.to === "pages/private.vue" && edge.label === "Nuxt middleware"));
});

test("maps Astro pages and island hydration directives", async () => {
  const sources = {
    "package.json": JSON.stringify({ dependencies: { astro: "latest" } }),
    "src/pages/blog/[slug].astro": `---\nimport Card from "../../components/Card.astro";\n---\n<Card client:visible />`,
    "src/components/Card.astro": `<article>Card</article>`,
    "src/layouts/Base.astro": `<main><slot /></main>`,
    "src/pages/api/users.ts": `export const GET = async () => new Response("[]")`,
    "src/content/config.ts": `import { defineCollection } from "astro:content"; export const collections = { posts: defineCollection({}) }`,
  };
  const framework = analyzeAstroProject(sources);
  const result = await analyzeProjectSources(sources);
  assert.equal(framework.files["src/pages/blog/[slug].astro"].route, "/blog/:slug");
  assert.match(framework.files["src/pages/blog/[slug].astro"].notes.join(" "), /client:visible/);
  assert.equal(result.nodes.find((node) => node.file === "src/pages/blog/[slug].astro")?.kind, "Page");
  assert.ok(result.edges.some((edge) => edge.from === "src/pages/blog/[slug].astro" && edge.to === "src/components/Card.astro" && edge.label === "Hydrated Astro island"));
  assert.equal(framework.files["src/layouts/Base.astro"].role, "Astro layout");
  assert.equal(framework.files["src/pages/api/users.ts"].role, "Astro API endpoint");
  assert.equal(framework.files["src/pages/api/users.ts"].route, "/api/users");
  assert.equal(framework.files["src/content/config.ts"].role, "Astro content collection");
});
