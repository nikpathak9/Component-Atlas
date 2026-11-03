import type { AnalyzerEdge, NodeKind } from "./index";

export type NextFileInfo = {
  kind: NodeKind;
  role: string;
  route: string;
  rendering: string;
  notes: string[];
};

export type NextAnalysis = {
  detected: boolean;
  router: "App Router" | "Pages Router" | "App + Pages Router" | "";
  files: Record<string, NextFileInfo>;
  edges: AnalyzerEdge[];
};

const SOURCE_FILE_PATTERN = /\.(tsx?|jsx?)$/i;

function hasNextDependency(sources: Record<string, string>) {
  const packageFile = Object.keys(sources).find((file) => /(^|\/)package\.json$/i.test(file));
  if (!packageFile) return false;
  try {
    const packageJson = JSON.parse(sources[packageFile]) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return Boolean(packageJson.dependencies?.next || packageJson.devDependencies?.next);
  } catch {
    return false;
  }
}

function routeSegment(segment: string) {
  if (/^\(.+\)$/.test(segment) || segment.startsWith("@")) return "";
  const optionalCatchAll = segment.match(/^\[\[\.\.\.(.+)\]\]$/)?.[1];
  if (optionalCatchAll) return `*${optionalCatchAll}?`;
  const catchAll = segment.match(/^\[\.\.\.(.+)\]$/)?.[1];
  if (catchAll) return `*${catchAll}`;
  const dynamic = segment.match(/^\[(.+)\]$/)?.[1];
  return dynamic ? `:${dynamic}` : segment.replace(/^\(\.\.\)?/, "");
}

function routeFromSegments(segments: string[]) {
  const route = segments.map(routeSegment).filter(Boolean).join("/");
  return route ? `/${route}` : "/";
}

function appLocation(file: string) {
  const normalized = file.replace(/\\/g, "/");
  const match = normalized.match(/^(?:src\/)?app\/(.+)$/i);
  if (!match) return null;
  const parts = match[1].split("/");
  const fileName = parts.pop() ?? "";
  return { directory: parts.join("/"), segments: parts, base: fileName.replace(SOURCE_FILE_PATTERN, "") };
}

function pagesLocation(file: string) {
  const normalized = file.replace(/\\/g, "/");
  const match = normalized.match(/^(?:src\/)?pages\/(.+)$/i);
  if (!match) return null;
  const parts = match[1].split("/");
  const fileName = parts.pop() ?? "";
  return { segments: parts, base: fileName.replace(SOURCE_FILE_PATTERN, "") };
}

function renderingMode(source: string, appRouter: boolean) {
  if (/^\s*["']use client["'];?/m.test(source)) return "Client Component";
  if (/^\s*["']use server["'];?/m.test(source)) return "Server Action Module";
  return appRouter ? "Server Component" : "Pages Router Component";
}

function dataNotes(source: string) {
  const notes: string[] = [];
  if (/\bgetServerSideProps\b/.test(source)) notes.push("It loads request-time data with getServerSideProps.");
  if (/\bgetStaticProps\b/.test(source)) notes.push("It builds static page data with getStaticProps.");
  if (/\bgetStaticPaths\b/.test(source)) notes.push("It declares dynamic build paths with getStaticPaths.");
  if (/\bgenerateStaticParams\b/.test(source)) notes.push("It pre-generates dynamic App Router parameters.");
  if (/\bgenerateMetadata\b|\bmetadata\s*=/.test(source)) notes.push("It defines route-specific Next.js metadata.");
  if (/\brevalidate\s*=/.test(source)) notes.push("It configures incremental route revalidation.");
  if (/\bdynamic\s*=/.test(source)) notes.push("It explicitly configures static or dynamic rendering behavior.");
  if (/\bruntime\s*=\s*["']edge["']/.test(source)) notes.push("It runs in the Next.js Edge runtime.");
  if (/\b(?:cookies|headers)\s*\(/.test(source)) notes.push("It reads request-scoped server data.");
  return notes;
}

function appFileInfo(file: string, source: string): NextFileInfo | null {
  const location = appLocation(file);
  if (!location) return null;
  const route = routeFromSegments(location.segments);
  const rendering = renderingMode(source, true);
  const roles: Record<string, { role: string; kind: NodeKind }> = {
    page: { role: "App Router page", kind: "Page" },
    layout: { role: "App Router layout", kind: "Page" },
    template: { role: "App Router template", kind: "Component" },
    loading: { role: "Route loading UI", kind: "Component" },
    error: { role: "Route error boundary", kind: "Component" },
    "not-found": { role: "Not-found UI", kind: "Component" },
    "global-error": { role: "Global error boundary", kind: "Component" },
    default: { role: "Parallel-route fallback", kind: "Component" },
    route: { role: "Route handler", kind: "Service" },
  };
  const role = roles[location.base];
  if (!role) return null;
  const notes = [`Next.js maps this ${role.role.toLowerCase()} to ${route}.`, `${rendering} behavior applies to this module.`, ...dataNotes(source)];
  if (location.base === "route") {
    const methods = Array.from(source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g), (match) => match[1]);
    if (methods.length) notes.push(`It handles ${methods.join(", ")} HTTP requests.`);
  }
  return { kind: role.kind, role: role.role, route, rendering, notes };
}

function pagesFileInfo(file: string, source: string): NextFileInfo | null {
  const location = pagesLocation(file);
  if (!location) return null;
  const isApi = location.segments[0] === "api";
  const isFrameworkShell = ["_app", "_document", "_error"].includes(location.base);
  const routeSegments = [...location.segments, location.base === "index" ? "" : location.base];
  const route = isFrameworkShell ? `/${location.base}` : routeFromSegments(routeSegments);
  const role = isApi ? "Pages API route" : isFrameworkShell ? "Pages Router shell" : "Pages Router page";
  const rendering = isApi ? "Server API Module" : renderingMode(source, false);
  const notes = [`Next.js maps this ${role.toLowerCase()} to ${route}.`, `${rendering} behavior applies to this module.`, ...dataNotes(source)];
  return { kind: isApi ? "Service" : "Page", role, route, rendering, notes };
}

function nearestLayout(file: string, layouts: Map<string, string>) {
  const location = appLocation(file);
  if (!location) return "";
  const candidates = Array.from(layouts.entries()).filter(([directory, layoutFile]) => layoutFile !== file && (!directory || location.directory === directory || location.directory.startsWith(`${directory}/`)));
  candidates.sort(([left], [right]) => right.length - left.length);
  return candidates[0]?.[1] ?? "";
}

export function analyzeNextProject(sources: Record<string, string>): NextAnalysis {
  const sourceFiles = Object.keys(sources).filter((file) => SOURCE_FILE_PATTERN.test(file));
  const hasAppRouter = sourceFiles.some((file) => appLocation(file));
  const hasPagesRouter = sourceFiles.some((file) => pagesLocation(file));
  const detected = hasNextDependency(sources) || hasAppRouter || hasPagesRouter;
  if (!detected) return { detected: false, router: "", files: {}, edges: [] };

  const files: Record<string, NextFileInfo> = {};
  sourceFiles.forEach((file) => {
    const info = appFileInfo(file, sources[file]) ?? pagesFileInfo(file, sources[file]);
    if (info) files[file] = info;
    if (/(^|\/)middleware\.[jt]s$/i.test(file)) files[file] = {
      kind: "Service",
      role: "Next.js middleware",
      route: "Request pipeline",
      rendering: "Edge/Server Module",
      notes: ["Next.js runs this middleware before matching application routes.", "It can redirect, rewrite, or modify requests and responses."],
    };
    if (/(^|\/)(proxy|instrumentation)\.[jt]s$/i.test(file)) files[file] = {
      kind: "Service",
      role: /proxy\.[jt]s$/i.test(file) ? "Next.js proxy" : "Next.js instrumentation",
      route: /proxy\.[jt]s$/i.test(file) ? "Request pipeline" : "Server lifecycle",
      rendering: "Server Module",
      notes: [/proxy\.[jt]s$/i.test(file) ? "Next.js runs this proxy before matching application routes." : "Next.js loads this instrumentation module during server startup."],
    };
    if (!files[file] && /^\s*["']use server["'];?/m.test(sources[file])) files[file] = {
      kind: "Service",
      role: "Next.js server actions",
      route: "Server action boundary",
      rendering: "Server Action Module",
      notes: ["The use server directive exposes exported functions as Next.js server actions."],
    };
  });

  const edges: AnalyzerEdge[] = [];
  const layouts = new Map<string, string>();
  Object.keys(files).forEach((file) => {
    const location = appLocation(file);
    if (location?.base === "layout") layouts.set(location.directory, file);
  });
  Object.keys(files).forEach((file) => {
    const location = appLocation(file);
    if (!location || location.base === "route") return;
    const layout = nearestLayout(file, layouts);
    if (layout && !edges.some((edge) => edge.from === layout && edge.to === file)) edges.push({ from: layout, to: file, dashed: true, kind: "route", label: "Route layout" });
  });
  const appShell = Object.keys(files).find((file) => /(^|\/)pages\/_app\.[jt]sx?$/i.test(file));
  if (appShell) Object.keys(files).filter((file) => files[file].role === "Pages Router page" && file !== appShell).forEach((file) => edges.push({ from: appShell, to: file, dashed: true, kind: "route", label: "Router shell" }));

  return {
    detected,
    router: hasAppRouter && hasPagesRouter ? "App + Pages Router" : hasAppRouter ? "App Router" : "Pages Router",
    files,
    edges,
  };
}
