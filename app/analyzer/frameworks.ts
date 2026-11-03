import type { AnalyzerEdge, NodeKind } from "./index";

export type FrameworkFileInfo = {
  kind: NodeKind;
  role: string;
  route?: string;
  rendering?: string;
  notes: string[];
};

export type FrameworkAnalysis = {
  detected: boolean;
  name: string;
  variant: string;
  files: Record<string, FrameworkFileInfo>;
  edges: AnalyzerEdge[];
};

const SOURCE_FILE_PATTERN = /\.(tsx?|jsx?)$/i;
const VUE_FILE_PATTERN = /\.vue$/i;
const ASTRO_FILE_PATTERN = /\.astro$/i;

function fileRoute(file: string, directory: string, extension: RegExp) {
  const normalized = file.replace(/\\/g, "/");
  const marker = `/${directory}/`;
  const offset = normalized.includes(marker) ? normalized.indexOf(marker) + marker.length : normalized.startsWith(`${directory}/`) ? directory.length + 1 : -1;
  if (offset < 0) return "";
  const relative = normalized.slice(offset).replace(extension, "");
  const parts = relative.split("/");
  if (parts.at(-1) === "index") parts.pop();
  const route = parts.map(routeSegment).filter(Boolean).join("/");
  return route ? `/${route}` : "/";
}

function dependencies(sources: Record<string, string>) {
  const packageFile = Object.keys(sources).find((file) => /(^|\/)package\.json$/i.test(file));
  if (!packageFile) return {} as Record<string, string>;
  try {
    const value = JSON.parse(sources[packageFile]) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return { ...value.dependencies, ...value.devDependencies };
  } catch {
    return {} as Record<string, string>;
  }
}

function routeSegment(segment: string) {
  if (/^\(.+\)$/.test(segment)) return "";
  const optional = segment.match(/^\[\[\.\.\.(.+)\]\]$/)?.[1];
  if (optional) return `*${optional}?`;
  const catchAll = segment.match(/^\[\.\.\.(.+)\]$/)?.[1];
  if (catchAll) return `*${catchAll}`;
  const dynamic = segment.match(/^\[(.+)\]$/)?.[1];
  return dynamic ? `:${dynamic}` : segment;
}

function solidRoute(file: string) {
  const match = file.replace(/\\/g, "/").match(/^(?:src\/)?routes\/(.+)\.(?:tsx?|jsx?)$/i);
  if (!match) return "";
  const parts = match[1].split("/").filter((part) => !part.startsWith("_"));
  if (parts.at(-1) === "index") parts.pop();
  const route = parts.map(routeSegment).filter(Boolean).join("/");
  return route ? `/${route}` : "/";
}

export function analyzeSolidProject(sources: Record<string, string>): FrameworkAnalysis {
  const packages = dependencies(sources);
  const sourceFiles = Object.keys(sources).filter((file) => SOURCE_FILE_PATTERN.test(file));
  const detected = Boolean(packages["solid-js"] || packages["@solidjs/start"] || packages["solid-start"] || sourceFiles.some((file) => /from\s+["'](?:solid-js|@solidjs\/)/.test(sources[file])));
  if (!detected) return { detected: false, name: "SolidJS", variant: "", files: {}, edges: [] };
  const isStart = Boolean(packages["@solidjs/start"] || packages["solid-start"] || sourceFiles.some((file) => solidRoute(file)));
  const files: Record<string, FrameworkFileInfo> = {};
  sourceFiles.forEach((file) => {
    const source = sources[file];
    const route = solidRoute(file);
    const primitives = Array.from(new Set(Array.from(source.matchAll(/\b(createSignal|createEffect|createMemo|createResource|createStore|createContext|onMount|onCleanup)\s*\(/g), (match) => match[1])));
    const controls = Array.from(new Set(Array.from(source.matchAll(/<(For|Show|Switch|Match|Suspense|ErrorBoundary)\b/g), (match) => match[1])));
    const isRoute = Boolean(route);
    const isEntry = /(^|\/)(entry-client|entry-server|root|app)\.[jt]sx?$/i.test(file);
    if (!isRoute && !isEntry && !/from\s+["'](?:solid-js|@solidjs\/)/.test(source)) return;
    const notes = [
      isRoute ? `SolidStart maps this file to ${route}.` : isEntry ? "This module initializes the Solid application shell." : "This module uses SolidJS fine-grained reactivity.",
      primitives.length ? `It uses ${primitives.join(", ")} as reactive primitives.` : "Solid updates this component through fine-grained reactive dependencies.",
    ];
    if (controls.length) notes.push(`Its JSX control flow uses ${controls.join(", ")}.`);
    if (/\bcreateServerAction\$?\b|\bquery\s*\(|\baction\s*\(/.test(source)) notes.push("It declares a SolidStart server data or action boundary.");
    if (/\b(createContext|useContext)\s*\(/.test(source)) notes.push("It provides or consumes shared state through Solid context.");
    if (/\b(startTransition|useTransition)\s*\(/.test(source)) notes.push("It coordinates a deferred reactive transition while dependent UI updates.");
    if (/\b(createAsync|cache)\s*\(/.test(source)) notes.push("It participates in SolidStart server-data caching and asynchronous route loading.");
    files[file] = {
      kind: isRoute ? "Page" : "Component",
      role: isRoute ? "SolidStart route" : isEntry ? "Solid application shell" : "Solid component",
      route: route || undefined,
      rendering: /["']use server["']/.test(source) ? "Server Module" : "Fine-grained reactive UI",
      notes,
    };
  });
  const shell = Object.keys(files).find((file) => /(^|\/)(root|app)\.[jt]sx?$/i.test(file));
  const edges = shell ? Object.keys(files).filter((file) => files[file].kind === "Page" && file !== shell).map((file) => ({ from: shell, to: file, dashed: true, kind: "route" as const, label: "Solid route" })) : [];
  return { detected: true, name: "SolidJS", variant: isStart ? "SolidStart" : "SolidJS", files, edges };
}

function importMap(source: string) {
  const result = new Map<string, string>();
  for (const match of source.matchAll(/import\s+(?:\{([^}]+)\}|([A-Za-z_$][\w$]*))\s+from\s+["']([^"']+)["']/g)) {
    if (match[2]) result.set(match[2], match[3]);
    if (match[1]) match[1].split(",").map((item) => item.trim().split(/\s+as\s+/).at(-1)).filter(Boolean).forEach((name) => result.set(name!, match[3]));
  }
  return result;
}

function resolveImport(fromFile: string, specifier: string, files: string[]) {
  if (!specifier.startsWith(".")) return "";
  const directory = fromFile.split("/").slice(0, -1).join("/");
  const parts: string[] = [];
  `${directory}/${specifier}`.split("/").forEach((part) => part === ".." ? parts.pop() : part !== "." && parts.push(part));
  const base = parts.join("/");
  return files.find((file) => [base, ...[".ts", ".tsx", ".js", ".jsx", ".vue", ".astro"].map((extension) => `${base}${extension}`), ...[".ts", ".tsx", ".js", ".jsx", ".vue", ".astro"].map((extension) => `${base}/index${extension}`)].includes(file)) ?? "";
}

export function analyzeLightningProject(sources: Record<string, string>): FrameworkAnalysis {
  const packages = dependencies(sources);
  const sourceFiles = Object.keys(sources).filter((file) => SOURCE_FILE_PATTERN.test(file));
  const packageNames = Object.keys(packages);
  const detected = packageNames.some((name) => /^@lightningjs\/(?:sdk|core|ui)$/.test(name) || name === "wpe-lightning-sdk") || sourceFiles.some((file) => /from\s+["'](?:@lightningjs\/|wpe-lightning-sdk)/.test(sources[file]));
  if (!detected) return { detected: false, name: "LightningJS", variant: "", files: {}, edges: [] };
  const files: Record<string, FrameworkFileInfo> = {};
  const edges: AnalyzerEdge[] = [];
  sourceFiles.forEach((file) => {
    const source = sources[file];
    const isComponent = /extends\s+(?:Lightning\.)?Component\b|static\s+(?:get\s+)?_template\b/.test(source);
    const isRouter = /Router\.(?:startRouter|App)|\broutes\s*[:=]/.test(source);
    const isScreen = /(^|\/)(pages|screens|views)\//i.test(file) || /Screen\b/.test(file);
    if (!isComponent && !isRouter && !/from\s+["'](?:@lightningjs\/|wpe-lightning-sdk)/.test(source)) return;
    const notes = [
      isRouter ? "This module configures the LightningJS navigation router." : "This class participates in the LightningJS component tree.",
      /static\s+(?:get\s+)?_template\b/.test(source) ? "Its static _template defines the GPU-rendered visual tree." : "LightningJS manages this module through its component lifecycle.",
    ];
    const lifecycle = Array.from(new Set(Array.from(source.matchAll(/\b(_init|_active|_inactive|_focus|_unfocus|_handle[A-Z]\w*)\s*\(/g), (match) => match[1])));
    if (lifecycle.length) notes.push(`It implements ${lifecycle.join(", ")} lifecycle or input handlers.`);
    if (/\bthis\.patch\s*\(/.test(source)) notes.push("It updates the GPU render tree through this.patch().");
    if (/\b(?:fireAncestors|signal)\s*\(/.test(source)) notes.push("It sends an event or signal through the Lightning component hierarchy.");
    if (/\bthis\.tag\s*\(/.test(source)) notes.push("It looks up a rendered child with this.tag() before updating or focusing it.");
    files[file] = {
      kind: isRouter ? "Service" : isScreen ? "Page" : "Component",
      role: isRouter ? "Lightning router" : isScreen ? "Lightning screen" : "Lightning component",
      rendering: "GPU-rendered component",
      notes,
    };
    if (isRouter) {
      const imports = importMap(source);
      for (const match of source.matchAll(/component\s*:\s*([A-Za-z_$][\w$]*)/g)) {
        const target = resolveImport(file, imports.get(match[1]) ?? "", sourceFiles);
        if (target) edges.push({ from: file, to: target, dashed: true, kind: "route", label: "Lightning route" });
      }
    }
  });
  const variant = packageNames.includes("@lightningjs/core") ? "Lightning 3" : "Lightning SDK";
  return { detected: true, name: "LightningJS", variant, files, edges };
}

function remixRoute(file: string) {
  const match = file.replace(/\\/g, "/").match(/^(?:app\/)?routes\/(.+)\.(?:tsx?|jsx?)$/i);
  if (!match) return "";
  const route = match[1].replace(/^_index$/, "").replace(/\._index$/, "").split(".").map((part) => part.startsWith("$") ? `:${part.slice(1)}` : part).filter((part) => part && !part.startsWith("_")).join("/");
  return route ? `/${route}` : "/";
}

export function analyzeRemixProject(sources: Record<string, string>): FrameworkAnalysis {
  const packages = dependencies(sources);
  const sourceFiles = Object.keys(sources).filter((file) => SOURCE_FILE_PATTERN.test(file));
  const detected = Boolean(packages["@remix-run/react"] || packages["@remix-run/node"] || sourceFiles.some((file) => /from\s+["']@remix-run\//.test(sources[file])));
  if (!detected) return { detected: false, name: "Remix", variant: "", files: {}, edges: [] };
  const files: Record<string, FrameworkFileInfo> = {};
  sourceFiles.forEach((file) => {
    const source = sources[file];
    const route = remixRoute(file);
    const root = /(^|\/)root\.[jt]sx?$/i.test(file);
    if (!route && !root && !/from\s+["']@remix-run\//.test(source)) return;
    const boundaries = ["loader", "action", "clientLoader", "clientAction", "ErrorBoundary", "meta", "links"].filter((name) => new RegExp(`\\b${name}\\b`).test(source));
    files[file] = { kind: route ? "Page" : root ? "Component" : "Utility", role: route ? "Remix route" : root ? "Remix root shell" : "Remix module", route: route || undefined, rendering: /\bloader\b|\baction\b/.test(source) ? "Server data boundary" : "React UI", notes: [route ? `Remix maps this file to ${route}.` : root ? "This module defines the Remix document shell and outlet." : "This module uses Remix runtime APIs.", boundaries.length ? `It exports or uses ${boundaries.join(", ")}.` : "It participates in Remix route execution."] };
  });
  const root = Object.keys(files).find((file) => /(^|\/)root\.[jt]sx?$/i.test(file));
  const edges = root ? Object.keys(files).filter((file) => files[file].kind === "Page").map((file) => ({ from: root, to: file, dashed: true, kind: "route" as const, label: "Remix route" })) : [];
  return { detected: true, name: "Remix", variant: "Remix", files, edges };
}

export function analyzeVueProject(sources: Record<string, string>): FrameworkAnalysis {
  const packages = dependencies(sources);
  const sourceFiles = Object.keys(sources).filter((file) => SOURCE_FILE_PATTERN.test(file) || VUE_FILE_PATTERN.test(file));
  const detected = Boolean(packages.vue || packages.nuxt || sourceFiles.some((file) => /from\s+["']vue["']/.test(sources[file])));
  if (!detected) return { detected: false, name: "Vue", variant: "", files: {}, edges: [] };
  const files: Record<string, FrameworkFileInfo> = {};
  const edges: AnalyzerEdge[] = [];
  const pageMiddleware = new Map<string, string[]>();
  sourceFiles.forEach((file) => {
    const source = sources[file];
    const middleware = /(^|\/)middleware\/([^/]+)\.[jt]s$/i.test(file);
    if (!VUE_FILE_PATTERN.test(file) && !middleware && !/from\s+["'](?:vue|vue-router|nuxt)/.test(source) && !/(^|\/)(?:main|app|router)\.[jt]s$/i.test(file)) return;
    const primitives = Array.from(new Set(Array.from(source.matchAll(/\b(ref|reactive|computed|watch|watchEffect|provide|inject|onMounted|onUnmounted)\s*\(/g), (match) => match[1])));
    const router = /createRouter\s*\(|from\s+["']vue-router/.test(source);
    const route = VUE_FILE_PATTERN.test(file) ? fileRoute(file, "pages", /\.vue$/i) : "";
    const props = Array.from(source.matchAll(/defineProps(?:<([^>]+)>|\(\s*\{([^}]+)\})/g), (match) => (match[1] || match[2] || "props").replace(/\s+/g, " "));
    const emits = Array.from(source.matchAll(/defineEmits(?:<([^>]+)>|\(\s*\[([^\]]+)\])/g), (match) => (match[1] || match[2] || "events").replace(/\s+/g, " "));
    const composables = Array.from(new Set(Array.from(source.matchAll(/\b(use[A-Z][\w$]*)\s*\(/g), (match) => match[1])));
    const notes = [router ? "This module configures Vue Router navigation." : VUE_FILE_PATTERN.test(file) ? "This Vue single-file component combines template and script behavior." : "This module uses Vue's Composition API.", route ? `Nuxt maps this file to ${route}.` : primitives.length ? `It uses ${primitives.join(", ")} as reactive primitives.` : "Vue tracks this module through reactive dependencies."];
    if (props.length) notes.push(`It declares component props through ${props.join(", ")}.`);
    if (emits.length) notes.push(`It emits ${emits.join(", ")} to parent components.`);
    if (composables.length) notes.push(`It calls ${composables.join(", ")} as Vue composables.`);
    if (/definePageMeta\s*\(|middleware\s*:/.test(source)) notes.push("Its Nuxt page metadata configures layout or route middleware.");
    if (middleware) notes.push("This Nuxt route middleware runs before navigation completes.");
    const middlewareNames = Array.from(source.matchAll(/middleware\s*:\s*(?:["']([^"']+)["']|\[([^\]]+)\])/g)).flatMap((match) =>
      match[1] ? [match[1]] : Array.from((match[2] ?? "").matchAll(/["']([^"']+)["']/g), (name) => name[1]),
    );
    if (middlewareNames.length) pageMiddleware.set(file, middlewareNames);
    files[file] = { kind: router || middleware ? "Service" : route || /(^|\/)(pages|views)\//i.test(file) ? "Page" : "Component", role: router ? "Vue router" : middleware ? "Nuxt route middleware" : route ? "Nuxt file route" : VUE_FILE_PATTERN.test(file) ? "Vue single-file component" : "Vue composition module", route: route || undefined, rendering: middleware ? "Navigation boundary" : packages.nuxt ? "Nuxt/Vue UI" : "Vue reactive UI", notes };
    const imports = importMap(source);
    imports.forEach((specifier, binding) => {
      const target = resolveImport(file, specifier, sourceFiles);
      if (target) {
        const tag = source.match(new RegExp(`<${binding}\\b([^>]*)>`))?.[1] ?? "";
        const eventNames = Array.from(tag.matchAll(/(?:@|v-on:)([\w-]+)/g), (match) => match[1]);
        const propNames = Array.from(tag.matchAll(/(?:^|\s)(?::|v-bind:)?([\w-]+)\s*=/g), (match) => match[1]).filter((name) => !name.startsWith("@"));
        const composable = /^use[A-Z]/.test(binding);
        const kind = composable ? "data" : eventNames.length ? "callback" : "render";
        const label = composable ? "Vue composable" : eventNames.length ? `Vue emits: ${eventNames.join(", ")}` : propNames.length ? `Vue props: ${propNames.join(", ")}` : "Vue component";
        edges.push({ from: file, to: target, kind, dashed: composable || eventNames.length > 0, label });
      }
    });
  });
  const layout = Object.keys(files).find((file) => /(^|\/)layouts\/default\.vue$/i.test(file));
  if (layout) Object.keys(files).filter((file) => files[file].kind === "Page").forEach((page) => edges.push({ from: layout, to: page, kind: "route", dashed: true, label: "Nuxt layout" }));
  const middlewareByName = new Map(Object.keys(files).filter((file) => /(^|\/)middleware\/[^/]+\.[jt]s$/i.test(file)).map((file) => [file.split("/").at(-1)!.replace(/\.[jt]s$/i, ""), file]));
  pageMiddleware.forEach((names, page) => names.forEach((name) => { const target = middlewareByName.get(name); if (target) edges.push({ from: target, to: page, kind: "route", dashed: true, label: "Nuxt middleware" }); }));
  return { detected: true, name: "Vue", variant: packages.nuxt ? "Nuxt" : "Vue", files, edges };
}

export function analyzeAstroProject(sources: Record<string, string>): FrameworkAnalysis {
  const packages = dependencies(sources);
  const astroFiles = Object.keys(sources).filter((file) => ASTRO_FILE_PATTERN.test(file));
  const supportingFiles = Object.keys(sources).filter((file) => /(^|\/)src\/(?:content\/config|pages\/.+)\.(?:ts|js)$/i.test(file));
  const sourceFiles = [...astroFiles, ...supportingFiles];
  const detected = Boolean(packages.astro || astroFiles.length);
  if (!detected) return { detected: false, name: "Astro", variant: "", files: {}, edges: [] };
  const files: Record<string, FrameworkFileInfo> = {};
  const edges: AnalyzerEdge[] = [];
  sourceFiles.forEach((file) => {
    const source = sources[file];
    const contentConfig = /(^|\/)src\/content\/config\.[jt]s$/i.test(file) || /from\s+["']astro:content["']/.test(source);
    const endpoint = /(^|\/)src\/pages\/.+\.[jt]s$/i.test(file) && /\b(?:GET|POST|PUT|PATCH|DELETE)\b/.test(source);
    if (!ASTRO_FILE_PATTERN.test(file)) {
      const route = endpoint ? fileRoute(file, "pages", /\.[jt]s$/i) : "";
      const methods = Array.from(new Set(Array.from(source.matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\b/g), (match) => match[1])));
      files[file] = { kind: endpoint ? "Service" : "Utility", role: endpoint ? "Astro API endpoint" : contentConfig ? "Astro content collection" : "Astro server module", route: route || undefined, rendering: endpoint ? "Server endpoint" : contentConfig ? "Content schema" : "Server utility", notes: [endpoint ? `Astro exposes this endpoint at ${route}.` : contentConfig ? "This file defines Astro content collections and their schemas." : "This module supports an Astro server route.", methods.length ? `It handles ${methods.join(", ")} requests.` : "Astro uses this configuration while loading typed content."] };
      return;
    }
    const route = fileRoute(file, "pages", /\.astro$/i);
    const layout = /(^|\/)layouts\//i.test(file);
    const components = Array.from(source.matchAll(/<([A-Z][\w.]*)\b/g), (match) => match[1]);
    const directives = Array.from(new Set(Array.from(source.matchAll(/client:(load|idle|visible|media|only)/g), (match) => `client:${match[1]}`)));
    const contentCalls = Array.from(new Set(Array.from(source.matchAll(/\b(getCollection|getEntry|getEntries)\s*\(/g), (match) => match[1])));
    files[file] = { kind: route ? "Page" : "Component", role: route ? "Astro file route" : layout ? "Astro layout" : "Astro component", route: route || undefined, rendering: directives.length ? "Islands architecture" : "Server-rendered Astro", notes: [route ? `Astro maps this file to ${route}.` : layout ? "This layout wraps pages or components through its slot." : "This file defines an Astro component.", components.length ? `It composes ${Array.from(new Set(components)).join(", ")}.` : "Its template renders static or server-produced markup.", directives.length ? `It hydrates interactive islands with ${directives.join(", ")}.` : "It does not declare a client hydration directive.", ...(contentCalls.length ? [`It loads Astro content through ${contentCalls.join(", ")}.`] : [])] };
    const imports = importMap(source);
    imports.forEach((specifier, binding) => {
      const target = resolveImport(file, specifier, Object.keys(sources));
      if (!target) return;
      const hydrated = new RegExp(`<${binding}\\b[^>]*\\bclient:`).test(source);
      const targetLayout = /(^|\/)layouts\/.*\.astro$/i.test(target);
      edges.push({ from: file, to: target, kind: hydrated ? "data" : "render", dashed: hydrated, label: hydrated ? "Hydrated Astro island" : targetLayout ? "Astro layout" : "Astro component" });
    });
  });
  return { detected: true, name: "Astro", variant: "Astro", files, edges };
}

export function analyzeAdditionalFrameworks(sources: Record<string, string>) {
  return [analyzeSolidProject(sources), analyzeLightningProject(sources), analyzeRemixProject(sources), analyzeVueProject(sources), analyzeAstroProject(sources)].filter((analysis) => analysis.detected);
}
