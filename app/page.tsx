"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactElement, WheelEvent as ReactWheelEvent } from "react";
import Activity from "lucide-react/icons/activity";
import ArrowRight from "lucide-react/icons/arrow-right";
import Atom from "lucide-react/icons/atom";
import Boxes from "lucide-react/icons/boxes";
import Check from "lucide-react/icons/check";
import ChevronDown from "lucide-react/icons/chevron-down";
import ChevronRight from "lucide-react/icons/chevron-right";
import Code2 from "lucide-react/icons/code-2";
import Copy from "lucide-react/icons/copy";
import Database from "lucide-react/icons/database";
import Ellipsis from "lucide-react/icons/ellipsis";
import FileCode2 from "lucide-react/icons/file-code-2";
import FileImage from "lucide-react/icons/file-image";
import FileJson from "lucide-react/icons/file-json";
import FilePlus2 from "lucide-react/icons/file-plus-2";
import Filter from "lucide-react/icons/filter";
import FolderOpen from "lucide-react/icons/folder-open";
import GitFork from "lucide-react/icons/git-fork";
import Home from "lucide-react/icons/house";
import LogIn from "lucide-react/icons/log-in";
import LogOut from "lucide-react/icons/log-out";
import Maximize2 from "lucide-react/icons/maximize-2";
import Minus from "lucide-react/icons/minus";
import Monitor from "lucide-react/icons/monitor";
import Moon from "lucide-react/icons/moon";
import Network from "lucide-react/icons/network";
import PanelLeft from "lucide-react/icons/panel-left";
import PanelRight from "lucide-react/icons/panel-right";
import Palette from "lucide-react/icons/palette";
import Play from "lucide-react/icons/play";
import Plus from "lucide-react/icons/plus";
import RotateCcw from "lucide-react/icons/rotate-ccw";
import Route from "lucide-react/icons/route";
import Search from "lucide-react/icons/search";
import Settings from "lucide-react/icons/settings";
import ShieldCheck from "lucide-react/icons/shield-check";
import Sun from "lucide-react/icons/sun";
import Trash2 from "lucide-react/icons/trash-2";
import Upload from "lucide-react/icons/upload";
import Workflow from "lucide-react/icons/workflow";
import X from "lucide-react/icons/x";

type InspectorTab = "Overview" | "Relations" | "Source";
type FileTab = "Files" | "Components" | "Routes" | "Hooks" | "Styles" | "Assets";
type NodeKind = "Page" | "Component" | "Hook" | "Service" | "Utility";

type NodeDetail = {
  name?: string;
  file: string;
  type: NodeKind;
  parent: string;
  children: string;
  metrics: string[];
  steps: string[];
  explanations?: Array<{ text: string; line: number; endLine?: number; kind: string }>;
  source: string;
  relations?: { usedBy: string[]; dependsOn: string[]; resources?: string[] };
  insights?: { props: string[]; hooks: string[]; exports: string[]; diagnostics: AnalysisIssue[]; bundler?: string[]; framework?: string[] };
};

type GraphNode = { id: string; name: string; file: string; kind: NodeKind; icon: string; tone: string; meta: string };
type GraphEdge = { from: string; to: string; dashed?: boolean };
type IgnoredFile = { path: string; reason: string };
type ProjectWorkspace = {
  id: string;
  analyzedAt?: number;
  sourceKey: string;
  name: string;
  files: string[];
  sources: Record<string, string>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  details: Record<string, NodeDetail>;
  githubSourceBase: string;
  openFiles: string[];
  activeFile: string;
  selected: string;
  ignoredFiles: IgnoredFile[];
  reportIncludedCount: number;
  reportLabel: string;
};
type AnalysisStatus = "progress" | "complete" | "issues" | "setup" | "error";
type AnalysisProgress = { status: AnalysisStatus; stage: number; name: string; totalFiles: number; components: number; imports: number; error: string };
type AnalyzerProgressUpdate = { stage: 1 | 2 | 3 | 4; components?: number; imports?: number };
type AnalysisIssue = { title: string; file: string; line: number; column?: number; detail: string; source?: "parser" | "ast" | "typescript" | "eslint"; severity?: "error" | "warning" | "info"; ruleId?: string };
type AuthUser = { userId: string; displayName: string; email: string; fullName: string | null };
type StoredWorkspaceSession = { ownerId?: string; projects: ProjectWorkspace[]; activeProjectId: string; showWorkspace: boolean; showReport?: boolean; theme: "dark" | "light" };

const emptyDetail: NodeDetail = { file: "", type: "Component", parent: "None", children: "None", metrics: ["0 props", "0 dependencies", "0 local state", "0 effects & events"], steps: [], source: "", relations: { usedBy: [], dependsOn: [], resources: [] }, insights: { props: [], hooks: [], exports: [], diagnostics: [], bundler: [], framework: [] } };
const analyzeProjectSources = async (sources: Record<string, string>, onProgress?: (progress: AnalyzerProgressUpdate) => void) => (await import("./analyzer/client")).analyzeProjectSources(sources, onProgress);

const SOURCE_FILE_PATTERN = /\.(tsx?|jsx?)$/i;
const STYLE_FILE_PATTERN = /\.(css|scss|sass|less|styl|stylus)$/i;
const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp|avif|ico|bmp)$/i;
const VECTOR_FILE_PATTERN = /\.svg$/i;
const FONT_FILE_PATTERN = /\.(woff2?|ttf|otf|eot)$/i;
const DATA_FILE_PATTERN = /\.(json|graphql|gql|mdx)$/i;
const BINARY_ASSET_PATTERN = /\.(png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot)$/i;
const KEPT_FILE_PATTERN = /\.(tsx?|jsx?|css|scss|sass|less|styl|stylus|svg|png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|json|graphql|gql|mdx)$/i;
const MAX_LOCAL_BINARY_SIZE = 512 * 1024;
const MAX_GITHUB_SOURCE_FILES = 450;
const MAX_GITHUB_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_GITHUB_SUPPORTING_FILES = 180;
const MAX_GITHUB_SUPPORTING_TEXT_BYTES = 4 * 1024 * 1024;

const fileCategory = (file: string) => STYLE_FILE_PATTERN.test(file) ? "style" : IMAGE_FILE_PATTERN.test(file) || VECTOR_FILE_PATTERN.test(file) || FONT_FILE_PATTERN.test(file) ? "asset" : DATA_FILE_PATTERN.test(file) ? "data" : "source";
const fileIcon = (file: string) => fileCategory(file) === "style" ? <Palette aria-hidden="true" /> : fileCategory(file) === "asset" ? <FileImage aria-hidden="true" /> : fileCategory(file) === "data" ? <FileJson aria-hidden="true" /> : file.includes("hooks/") ? <Activity aria-hidden="true" /> : file.includes("services/") ? <Database aria-hidden="true" /> : file.includes("pages/") ? <Route aria-hidden="true" /> : <FileCode2 aria-hidden="true" />;
const fileTabIcon = (tab: FileTab) => tab === "Components" ? <Boxes aria-hidden="true" /> : tab === "Routes" ? <Route aria-hidden="true" /> : tab === "Hooks" ? <Activity aria-hidden="true" /> : tab === "Styles" ? <Palette aria-hidden="true" /> : tab === "Assets" ? <FileImage aria-hidden="true" /> : <FolderOpen aria-hidden="true" />;
const FILE_TABS: FileTab[] = ["Files", "Components", "Routes", "Hooks", "Styles", "Assets"];
const nodeKindIcon = (kind: NodeKind) => kind === "Page" ? <Route aria-hidden="true" /> : kind === "Hook" ? <Activity aria-hidden="true" /> : kind === "Service" ? <Database aria-hidden="true" /> : kind === "Utility" ? <Code2 aria-hidden="true" /> : <Boxes aria-hidden="true" />;
const nodeKindDescription: Record<NodeKind, string> = {
  Page: "Route-level screens",
  Component: "Reusable interface blocks",
  Hook: "State and React hooks",
  Service: "API and data services",
  Utility: "Shared helper modules",
};
const sourceExtension = (file: string) => file.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "file";
const isAnalyzerConfigFile = (path: string) => /(^|\/)(tsconfig(?:\.[^/]+)?\.json|jsconfig\.json|package\.json|\.babelrc(?:\.json)?|(vite|webpack|rollup|next|astro|remix|babel|eslint)\.config\.[cm]?[jt]s)$/i.test(path.replace(/\\/g, "/"));

function getIgnoreReason(path: string, size = 0) {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  if (/(^|\/)(node_modules|dist|build|out|coverage|vendor|storybook-static|\.next|\.nuxt|\.output|\.git|\.cache|\.turbo|\.vite)(\/|$)/.test(normalized)) return "Dependency, cache, or build output — generated and vendor folders are not part of the authored application.";
  if (/(^|\/)(__tests__|__mocks__|fixtures?|test-utils?)(\/|$)/.test(normalized) || /\.(test|spec|stories?|mock)\.[jt]sx?$/.test(normalized)) return "Test, story, mock, or fixture — excluded to keep the graph focused on application runtime code.";
  if (/(^|\/)\.env(?:\.|$)/.test(normalized) || /\.(pem|key|p12|pfx|crt)$/i.test(normalized)) return "Secret or credential file — excluded for security and never read by Component Atlas.";
  if (/\.d\.ts$/.test(normalized)) return "Type declaration — contains type metadata but no executable component behavior.";
  if (isAnalyzerConfigFile(normalized)) return "Analysis configuration — compiler, bundler, package, and path-alias settings are read internally but hidden from the component graph.";
  if (/(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|npm-shrinkwrap\.json)$/.test(normalized)) return "Dependency lock file — package resolution metadata does not describe application behavior.";
  if (/\.(generated|gen)\.[jt]sx?$/.test(normalized) || /\.min\.(js|css)$/.test(normalized) || /\.map$/.test(normalized)) return "Generated, minified, or source-map file — machine-produced content would add noise to the workspace.";
  if (/(^|\/)\.ds_store$/.test(normalized) || /\.(log|tmp|swp)$/.test(normalized)) return "Temporary or operating-system file — unrelated to application behavior.";
  if (/\.(mp4|mov|avi|mkv|webm|mp3|wav|ogg|zip|tar|gz|rar|7z|pdf|wasm)$/i.test(normalized)) return "Large media, archive, or binary file — excluded to keep imports and saved workspaces responsive.";
  if (/(^|\/)(vite|next|webpack|rollup|tailwind|postcss|eslint|prettier|babel|jest|vitest|playwright|cypress|commitlint|tsup|turbo|astro|remix)\.config\.[jt]sx?$/.test(normalized)) return "Tool configuration — build, lint, test, and framework settings do not represent UI execution flow.";
  if (/\.config\.[jt]sx?$/.test(normalized) || /(^|\/)(config|setup-tests?|setup-proxy)\.[jt]sx?$/.test(normalized)) return "Project setup file — initialization and configuration helpers are excluded from component analysis.";
  if (!KEPT_FILE_PATTERN.test(normalized)) return "Unsupported file type — this format cannot be inspected or connected safely in the workspace yet.";
  if (BINARY_ASSET_PATTERN.test(normalized) && size > MAX_LOCAL_BINARY_SIZE) return "Large asset — binary assets over 512 KB are excluded from saved workspaces to protect performance.";
  return null;
}

type RepositoryFileCandidate = { path: string; size: number };

function repositoryFilePriority(path: string) {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  const primaryDirectory = /(^|\/)(src|app|pages|routes|components|hooks|services)(\/|$)/.test(normalized) ? 0
    : /(^|\/)(screens|views|features|modules|lib|utils|store|state)(\/|$)/.test(normalized) ? 20
      : /(^|\/)(public|assets|styles)(\/|$)/.test(normalized) ? 45 : 65;
  const sourceType = /\.(tsx|jsx)$/.test(normalized) ? 0 : /\.(ts|js)$/.test(normalized) ? 5 : STYLE_FILE_PATTERN.test(normalized) ? 10 : DATA_FILE_PATTERN.test(normalized) ? 15 : 20;
  return primaryDirectory + sourceType + Math.min(normalized.split("/").length, 10);
}

function selectGithubSourceFiles(candidates: RepositoryFileCandidate[]) {
  const selected: string[] = [];
  let selectedBytes = 0;
  [...candidates].sort((left, right) => repositoryFilePriority(left.path) - repositoryFilePriority(right.path) || left.path.localeCompare(right.path)).forEach((candidate) => {
    if (selected.length >= MAX_GITHUB_SOURCE_FILES) return;
    if (selectedBytes + candidate.size > MAX_GITHUB_SOURCE_BYTES) return;
    selected.push(candidate.path);
    selectedBytes += candidate.size;
  });
  return selected;
}

function normalizeRepositoryPath(path: string) {
  const parts: string[] = [];
  path.replace(/\\/g, "/").split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}

function resolveRepositoryReference(fromFile: string, specifier: string, candidates: Set<string>) {
  const cleanSpecifier = specifier.split(/[?#]/)[0];
  if (!cleanSpecifier || /^(?:https?:|data:|#)/i.test(cleanSpecifier)) return "";
  const fromDirectory = fromFile.split("/").slice(0, -1).join("/");
  const base = cleanSpecifier.startsWith("@/") || cleanSpecifier.startsWith("~/")
    ? `src/${cleanSpecifier.slice(2)}`
    : cleanSpecifier.startsWith("/") ? cleanSpecifier.slice(1)
      : cleanSpecifier.startsWith(".") ? `${fromDirectory}/${cleanSpecifier}` : "";
  if (!base) return "";
  const normalized = normalizeRepositoryPath(base);
  const possible = [normalized, ...[".css", ".scss", ".sass", ".less", ".styl", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".json", ".graphql", ".gql"].map((extension) => `${normalized}${extension}`)];
  return possible.find((candidate) => candidates.has(candidate)) ?? "";
}

function referencedSupportingFiles(sources: Record<string, string>, candidates: RepositoryFileCandidate[]) {
  const candidatePaths = new Set(candidates.map((candidate) => candidate.path));
  const referenced = new Set<string>();
  Object.entries(sources).forEach(([file, source]) => {
    if (!SOURCE_FILE_PATTERN.test(file)) return;
    const patterns = [/(?:\bfrom|\bimport\s*\(|\brequire\s*\()\s*["']([^"']+)["']/g, /\bimport\s*["']([^"']+)["']/g, /\b(?:src|href)\s*=\s*["']([^"']+)["']/g];
    patterns.forEach((pattern) => {
      for (const match of source.matchAll(pattern)) {
        const resolved = resolveRepositoryReference(file, match[1], candidatePaths);
        if (resolved) referenced.add(resolved);
      }
    });
  });
  return referenced;
}

function selectGithubSupportingFiles(candidates: RepositoryFileCandidate[], referenced: Set<string>) {
  const selected: string[] = [];
  let selectedTextBytes = 0;
  const ordered = [...candidates].sort((left, right) => Number(!referenced.has(left.path)) - Number(!referenced.has(right.path)) || repositoryFilePriority(left.path) - repositoryFilePriority(right.path) || left.path.localeCompare(right.path));
  ordered.forEach((candidate) => {
    if (selected.length >= MAX_GITHUB_SUPPORTING_FILES) return;
    const storedAsUrl = BINARY_ASSET_PATTERN.test(candidate.path);
    if (!storedAsUrl && selectedTextBytes + candidate.size > MAX_GITHUB_SUPPORTING_TEXT_BYTES) return;
    selected.push(candidate.path);
    if (!storedAsUrl) selectedTextBytes += candidate.size;
  });
  return selected;
}

function readBinaryAsset(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Asset could not be read"));
    reader.readAsDataURL(file);
  });
}

function detectUnsupportedStack(paths: string[]) {
  const files = paths.map((path) => path.replace(/\\/g, "/").toLowerCase());
  const has = (pattern: RegExp) => files.some((path) => pattern.test(path));
  if (has(/(^|\/)(pom\.xml|build\.gradle(?:\.kts)?|settings\.gradle(?:\.kts)?)$/) || has(/\.java$/)) return "Spring Boot / Java";
  if (has(/(^|\/)go\.mod$/) || has(/\.go$/)) return "Go";
  if (has(/(^|\/)cargo\.toml$/) || has(/\.rs$/)) return "Rust";
  if (has(/\.(csproj|sln|cs)$/)) return ".NET / C#";
  if (has(/(^|\/)(pyproject\.toml|requirements\.txt|pipfile)$/) || has(/\.py$/)) return "Python";
  if (has(/(^|\/)composer\.json$/) || has(/\.php$/)) return "PHP";
  if (has(/(^|\/)gemfile$/) || has(/\.rb$/)) return "Ruby";
  if (has(/(^|\/)pubspec\.yaml$/) || has(/\.dart$/)) return "Flutter / Dart";
  return "Unsupported project type";
}

const isAnalyzableSourceFile = (path: string) => getIgnoreReason(path) === null;

const getProjectAnalyzedAt = (project: ProjectWorkspace) => {
  if (typeof project.analyzedAt === "number" && Number.isFinite(project.analyzedAt)) return project.analyzedAt;
  const timestamp = project.id.match(/-(\d{13})-[^-]+$/)?.[1];
  return timestamp ? Number(timestamp) : null;
};

const formatAnalysisAge = (analyzedAt: number, now: number) => {
  const elapsedSeconds = Math.max(0, Math.floor((now - analyzedAt) / 1000));
  if (elapsedSeconds < 60) return "just now";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const WORKSPACE_DB_NAME = "component-atlas-workspace";
const WORKSPACE_STORE_NAME = "session";
const LEGACY_WORKSPACE_SESSION_KEY = "current";
const LOCAL_AUTH_KEY = "component-atlas-local-user";
const workspaceSessionKey = (userId: string) => `user:${userId}`;

function openWorkspaceDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(WORKSPACE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WORKSPACE_STORE_NAME)) request.result.createObjectStore(WORKSPACE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readWorkspaceRecord(key: string) {
  const database = await openWorkspaceDatabase();
  return new Promise<StoredWorkspaceSession | null>((resolve, reject) => {
    const request = database.transaction(WORKSPACE_STORE_NAME, "readonly").objectStore(WORKSPACE_STORE_NAME).get(key);
    request.onsuccess = () => { database.close(); resolve((request.result as StoredWorkspaceSession | undefined) ?? null); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

async function writeWorkspaceRecord(key: string, session: StoredWorkspaceSession) {
  const database = await openWorkspaceDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WORKSPACE_STORE_NAME, "readwrite");
    transaction.objectStore(WORKSPACE_STORE_NAME).put(session, key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function deleteWorkspaceRecord(key: string) {
  const database = await openWorkspaceDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(WORKSPACE_STORE_NAME, "readwrite");
    transaction.objectStore(WORKSPACE_STORE_NAME).delete(key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function readWorkspaceSession(userId: string) {
  const userKey = workspaceSessionKey(userId);
  const userSession = await readWorkspaceRecord(userKey);
  if (userSession) return userSession;
  const legacySession = await readWorkspaceRecord(LEGACY_WORKSPACE_SESSION_KEY);
  if (!legacySession) return null;
  const migratedSession = { ...legacySession, ownerId: userId };
  await writeWorkspaceRecord(userKey, migratedSession);
  await deleteWorkspaceRecord(LEGACY_WORKSPACE_SESSION_KEY);
  return migratedSession;
}

const writeWorkspaceSession = (userId: string, session: StoredWorkspaceSession) => writeWorkspaceRecord(workspaceSessionKey(userId), { ...session, ownerId: userId });

function fingerprintSources(sources: Record<string, string>) {
  let hash = 2166136261;
  const input = Object.keys(sources).sort().map((path) => `${path}\0${sources[path]}\0`).join("");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `content:${Object.keys(sources).length}:${(hash >>> 0).toString(36)}`;
}

const kindStyle = (kind: NodeKind) => kind === "Page" ? ["⌁", "amber"] : kind === "Hook" ? ["∪", "purple"] : kind === "Service" ? ["◇", "mint"] : kind === "Utility" ? ["</>", "slate"] : ["▦", "blue"];

const syntaxKeywords = new Set(["abstract", "as", "async", "await", "break", "case", "catch", "class", "const", "continue", "declare", "default", "delete", "do", "else", "enum", "export", "extends", "finally", "for", "from", "function", "get", "if", "implements", "import", "in", "infer", "instanceof", "interface", "keyof", "let", "namespace", "new", "of", "private", "protected", "public", "readonly", "return", "satisfies", "set", "static", "super", "switch", "throw", "try", "type", "typeof", "var", "void", "while", "with", "yield"]);
const syntaxTokenPattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:abstract|as|async|await|break|case|catch|class|const|continue|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|infer|instanceof|interface|keyof|let|namespace|new|of|private|protected|public|readonly|return|satisfies|set|static|super|switch|throw|try|type|typeof|var|void|while|with|yield)\b|\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b|<\/?[A-Za-z][\w.-]*|\b[A-Z][A-Za-z0-9_$]*\b|\b[A-Za-z_$][\w$]*(?=\s*\()|(?<=\.)[A-Za-z_$][\w$]*/g;

const lineRangeLabel = (line: number, endLine = line) => endLine > line ? `Lines ${line}–${endLine}` : `Line ${line}`;

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
      else if (started && character === closer) depth -= 1;
      if (started && depth === 0) return index + 1;
    }
  }
  return line;
}

const HighlightedCode = memo(function HighlightedCode({ source, highlightedLine = 0, highlightedEndLine = highlightedLine }: { source: string; highlightedLine?: number; highlightedEndLine?: number }) {
  return <code className="syntax-code">{source.split("\n").map((line, lineIndex) => {
    const parts: Array<string | ReactElement> = [];
    let cursor = 0;
    let key = 0;
    for (const match of line.matchAll(syntaxTokenPattern)) {
      const token = match[0];
      const offset = match.index ?? 0;
      if (offset > cursor) parts.push(line.slice(cursor, offset));
      let tokenClass = "syntax-property";
      if (token.startsWith("//") || token.startsWith("/*")) tokenClass = "syntax-comment";
      else if (/^[`"']/.test(token)) tokenClass = "syntax-string";
      else if (syntaxKeywords.has(token)) tokenClass = "syntax-keyword";
      else if (/^(true|false|null|undefined)$/.test(token)) tokenClass = "syntax-literal";
      else if (/^\d/.test(token)) tokenClass = "syntax-number";
      else if (token.startsWith("<")) tokenClass = /^[A-Z]/.test(token.replace(/^<\/?/, "")) ? "syntax-component" : "syntax-tag";
      else if (/^[A-Z]/.test(token)) tokenClass = "syntax-type";
      else if (line.slice(offset + token.length).match(/^\s*\(/)) tokenClass = "syntax-function";
      parts.push(<span className={tokenClass} key={`${key++}-${offset}`}>{token}</span>);
      cursor = offset + token.length;
    }
    if (cursor < line.length) parts.push(line.slice(cursor));
    const lineNumber = lineIndex + 1;
    const isHighlighted = highlightedLine > 0 && lineNumber >= highlightedLine && lineNumber <= Math.max(highlightedLine, highlightedEndLine);
    return <span className={`syntax-line ${isHighlighted ? "highlighted" : ""} ${isHighlighted && lineNumber === highlightedLine ? "range-start" : ""} ${isHighlighted && lineNumber === Math.max(highlightedLine, highlightedEndLine) ? "range-end" : ""}`} data-line={lineNumber} key={lineNumber}><i className="syntax-line-number">{lineNumber}</i><span className="syntax-line-content">{parts.length ? parts : " "}</span></span>;
  })}</code>;
});

export function ComponentAtlas({ initialView = "landing" }: { initialView?: "landing" | "workspace" }) {
  const [showWorkspace, setShowWorkspace] = useState(initialView === "workspace");
  const [selected, setSelected] = useState("");
  const [projectNodes, setProjectNodes] = useState<GraphNode[]>([]);
  const [projectEdges, setProjectEdges] = useState<GraphEdge[]>([]);
  const [projectDetails, setProjectDetails] = useState<Record<string, NodeDetail>>({});
  const [activeStep, setActiveStep] = useState(0);
  const [graphMode, setGraphMode] = useState<"graph" | "flow">("graph");
  const [explorerWidth, setExplorerWidth] = useState(300);
  const [inspectorWidth, setInspectorWidth] = useState(390);
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [codeHeight, setCodeHeight] = useState(280);
  const [fileTab, setFileTab] = useState<FileTab>("Files");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("Overview");
  const [activeFile, setActiveFile] = useState("");
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [fileSources, setFileSources] = useState<Record<string, string>>({});
  const [fileQuery, setFileQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [nodeQuery, setNodeQuery] = useState("");
  const [showNodeSearch, setShowNodeSearch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [graphPan, setGraphPan] = useState({ x: 0, y: 0 });
  const [graphViewport, setGraphViewport] = useState({ scrollLeft: 0, scrollTop: 0, clientWidth: 0, clientHeight: 0, scrollWidth: 1, scrollHeight: 1 });
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [menu, setMenu] = useState<"project" | "projectSearch" | "filter" | "fileView" | "more" | "account" | null>(null);
  const [modal, setModal] = useState<"import" | "paste" | "github" | "settings" | "report" | "unsupported" | "duplicate" | "remove" | "analysis" | null>(null);
  const [pasteCode, setPasteCode] = useState("");
  const [pasteDestination, setPasteDestination] = useState<"current" | "new">("new");
  const [pasteConflict, setPasteConflict] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<ProjectWorkspace[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [githubSourceBase, setGithubSourceBase] = useState("");
  const [ignoredFiles, setIgnoredFiles] = useState<IgnoredFile[]>([]);
  const [openIgnoredGroup, setOpenIgnoredGroup] = useState<string | null>(null);
  const [reportIncludedCount, setReportIncludedCount] = useState(0);
  const [reportLabel, setReportLabel] = useState("Imported project");
  const [unsupportedProject, setUnsupportedProject] = useState({ name: "Selected project", type: "Unsupported project type" });
  const [duplicateProject, setDuplicateProject] = useState<ProjectWorkspace | null>(null);
  const [projectToRemove, setProjectToRemove] = useState<ProjectWorkspace | null>(null);
  const [pendingProject, setPendingProject] = useState<ProjectWorkspace | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({ status: "progress", stage: 0, name: "Project", totalFiles: 0, components: 0, imports: 0, error: "" });
  const [analysisIssues, setAnalysisIssues] = useState<AnalysisIssue[]>([]);
  const [workspaceSetupProgress, setWorkspaceSetupProgress] = useState(0);
  const [enabledKinds, setEnabledKinds] = useState<Record<NodeKind, boolean>>({ Page: true, Component: true, Hook: true, Service: true, Utility: true });
  const [showMinimap, setShowMinimap] = useState(true);
  const [toast, setToast] = useState("");
  const [relativeTimeNow, setRelativeTimeNow] = useState(() => Date.now());
  const [highlightedLocation, setHighlightedLocation] = useState<{ file: string; line: number; endLine: number } | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerSearchRef = useRef<HTMLInputElement>(null);
  const fileSearchRef = useRef<HTMLInputElement>(null);
  const nodeSearchRef = useRef<HTMLInputElement>(null);
  const codeTabsRef = useRef<HTMLDivElement>(null);
  const codePreviewRef = useRef<HTMLPreElement>(null);
  const canvasColumnRef = useRef<HTMLElement>(null);
  const graphScrollRef = useRef<HTMLDivElement>(null);
  const graphPanRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number } | null>(null);
  const graphPanFrameRef = useRef<number | null>(null);
  const pendingGraphPanRef = useRef<{ x: number; y: number } | null>(null);
  const skipNextPersistenceRef = useRef(true);
  const analysisRunRef = useRef(0);

  const selectedDetail = projectDetails[selected] ?? emptyDetail;
  const selectedName = selectedDetail.name ?? selected;
  const selectedInsights = {
    props: selectedDetail.insights?.props ?? [],
    hooks: selectedDetail.insights?.hooks ?? [],
    exports: selectedDetail.insights?.exports ?? [],
    diagnostics: selectedDetail.insights?.diagnostics ?? [],
    bundler: selectedDetail.insights?.bundler ?? [],
    framework: selectedDetail.insights?.framework ?? [],
  };
  const activeSource = activeFile ? fileSources[activeFile] ?? "// Source is not available for this file." : "// Select a file from the explorer to view its source.";
  const activeFileCategory = activeFile ? fileCategory(activeFile) : "source";
  const activeIsImage = activeFile ? IMAGE_FILE_PATTERN.test(activeFile) : false;
  const activeIsBinaryAsset = activeFile ? BINARY_ASSET_PATTERN.test(activeFile) : false;
  const activeAnalysisProject = useMemo(() => projects.find((project) => project.id === activeProjectId) ?? null, [activeProjectId, projects]);
  const projectSearchResults = useMemo(() => [...projects].reverse().filter((project) => project.name.toLowerCase().includes(projectQuery.trim().toLowerCase())), [projectQuery, projects]);
  const activeProjectAnalyzedAt = activeAnalysisProject ? getProjectAnalyzedAt(activeAnalysisProject) : null;
  const authInitials = authUser?.displayName.split(/\s+|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CA";
  const notify = useCallback((message: string) => setToast(message), []);
  const requestLandingImport = () => {
    if (authLoading) return;
    if (!authUser) {
      window.location.assign("/login?return_to=%2F%3Fimport%3D1");
      return;
    }
    setModal("import");
  };

  const openPasteDialog = (destination: "current" | "new") => {
    setPasteDestination(destination === "current" && showWorkspace && activeProjectId ? "current" : "new");
    setPasteConflict(null);
    setModal("paste");
  };

  useLayoutEffect(() => {
    document.body.dataset.appRoute = initialView;
    return () => {
      if (document.body.dataset.appRoute === initialView) delete document.body.dataset.appRoute;
    };
  }, [initialView]);

  useLayoutEffect(() => {
    document.body.dataset.appTheme = theme;
  }, [theme]);

  useEffect(() => {
    if (!showWorkspace || !activeProjectAnalyzedAt) return;
    setRelativeTimeNow(Date.now());
    const interval = window.setInterval(() => setRelativeTimeNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, [activeProjectAnalyzedAt, showWorkspace]);

  const updateGraphViewport = useCallback(() => {
    const area = graphScrollRef.current;
    if (!area) return;
    setGraphViewport({
      scrollLeft: area.scrollLeft,
      scrollTop: area.scrollTop,
      clientWidth: area.clientWidth,
      clientHeight: area.clientHeight,
      scrollWidth: Math.max(area.scrollWidth, 1),
      scrollHeight: Math.max(area.scrollHeight, 1),
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => () => {
    if (graphPanFrameRef.current !== null) window.cancelAnimationFrame(graphPanFrameRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() as Promise<{ user: AuthUser | null }> : Promise.resolve({ user: null }))
      .then(({ user }) => {
        if (cancelled) return;
        if (user) { setAuthUser(user); return; }
        try {
          const localUser = window.localStorage.getItem(LOCAL_AUTH_KEY);
          setAuthUser(localUser ? JSON.parse(localUser) as AuthUser : null);
        } catch { setAuthUser(null); }
      })
      .catch(() => {
        if (cancelled) return;
        try {
          const localUser = window.localStorage.getItem(LOCAL_AUTH_KEY);
          setAuthUser(localUser ? JSON.parse(localUser) as AuthUser : null);
        } catch { setAuthUser(null); }
      })
      .finally(() => { if (!cancelled) setAuthLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (initialView !== "landing" || authLoading || !authUser) return;
    const parameters = new URLSearchParams(window.location.search);
    if (parameters.get("import") !== "1") return;
    setModal("import");
    window.history.replaceState({}, "", "/");
  }, [authLoading, authUser, initialView]);

  useEffect(() => {
    if (!sessionReady || showWorkspace) return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".landing-reveal"));
    if (!("IntersectionObserver" in window)) { elements.forEach((element) => element.classList.add("is-visible")); return; }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sessionReady, showWorkspace]);

  useEffect(() => {
    if (!sessionReady || !showWorkspace || !activeProjectId || !projectFiles.length || !Object.keys(fileSources).length) return;
    setProjects((current) => current.map((project) => project.id === activeProjectId ? {
      ...project,
      name: projectName,
      files: projectFiles,
      sources: fileSources,
      nodes: projectNodes,
      edges: projectEdges,
      details: projectDetails,
      githubSourceBase,
      openFiles,
      activeFile,
      selected,
      ignoredFiles,
      reportIncludedCount,
      reportLabel,
    } : project));
  }, [activeFile, activeProjectId, fileSources, githubSourceBase, ignoredFiles, openFiles, projectDetails, projectEdges, projectFiles, projectName, projectNodes, reportIncludedCount, reportLabel, selected, sessionReady, showWorkspace]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const primaryModifier = event.metaKey || event.ctrlKey;

      if (primaryModifier && key === "k") {
        event.preventDefault();
        headerSearchRef.current?.focus();
        return;
      }
      if (primaryModifier && key === "i") {
        event.preventDefault();
        fileInputRef.current?.click();
        return;
      }
      if (event.altKey && event.code === "KeyF") {
        event.preventDefault();
        setFileTab("Files");
        fileSearchRef.current?.focus();
        return;
      }
      if (event.key === "Escape") { setMenu(null); setModal(null); setShowNodeSearch(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => { if (showNodeSearch) nodeSearchRef.current?.focus(); }, [showNodeSearch]);

  useEffect(() => {
    const activeTab = Array.from(codeTabsRef.current?.querySelectorAll<HTMLElement>("[data-code-file]") ?? []).find((tab) => tab.dataset.codeFile === activeFile);
    activeTab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [activeFile, openFiles]);

  useEffect(() => {
    if (!activeFile) return;
    const activeNode = projectNodes.find((node) => node.file === activeFile);
    if (activeNode && activeNode.id !== selected) {
      setSelected(activeNode.id);
      setActiveStep(0);
      setInspectorTab("Overview");
    }
  }, [activeFile, projectNodes, selected]);

  const filteredFiles = useMemo(() => {
    const kindByFile = new Map(projectNodes.map((node) => [node.file, node.kind]));
    return projectFiles.filter((file) => {
    const matchesQuery = file.toLowerCase().includes(fileQuery.toLowerCase());
    const kind = kindByFile.get(file);
    if (fileTab === "Components") return matchesQuery && kind === "Component";
    if (fileTab === "Routes") return matchesQuery && kind === "Page";
    if (fileTab === "Hooks") return matchesQuery && kind === "Hook";
    if (fileTab === "Styles") return matchesQuery && fileCategory(file) === "style";
    if (fileTab === "Assets") return matchesQuery && ["asset", "data"].includes(fileCategory(file));
    return matchesQuery;
    });
  }, [fileQuery, fileTab, projectFiles, projectNodes]);

  const fileTabCounts = useMemo(() => {
    const kindByFile = new Map(projectNodes.map((node) => [node.file, node.kind]));
    return projectFiles.reduce<Record<FileTab, number>>((counts, file) => {
      counts.Files += 1;
      const kind = kindByFile.get(file);
      if (kind === "Component") counts.Components += 1;
      if (kind === "Page") counts.Routes += 1;
      if (kind === "Hook") counts.Hooks += 1;
      if (fileCategory(file) === "style") counts.Styles += 1;
      if (["asset", "data"].includes(fileCategory(file))) counts.Assets += 1;
      return counts;
    }, { Files: 0, Components: 0, Routes: 0, Hooks: 0, Styles: 0, Assets: 0 });
  }, [projectFiles, projectNodes]);

  const ignoredGroups = useMemo(() => Object.entries(ignoredFiles.reduce<Record<string, string[]>>((groups, file) => {
    (groups[file.reason] ??= []).push(file.path);
    return groups;
  }, {})), [ignoredFiles]);

  const graphLayout = useMemo(() => {
    const visible = projectNodes.filter((node) => enabledKinds[node.kind]);
    const columns: Record<NodeKind, GraphNode[]> = { Page: [], Component: [], Hook: [], Service: [], Utility: [] };
    visible.forEach((node) => columns[node.kind].push(node));
    const orderedKinds: NodeKind[] = ["Page", "Component", "Hook", "Service", "Utility"];
    const positions: Record<string, { x: number; y: number }> = {};
    let activeColumn = 0;
    orderedKinds.forEach((kind) => {
      if (!columns[kind].length) return;
      columns[kind].forEach((node, index) => { positions[node.id] = { x: 40 + activeColumn * 240, y: 42 + index * 126 }; });
      activeColumn += 1;
    });
    const maxRows = Math.max(1, ...orderedKinds.map((kind) => columns[kind].length));
    return { nodes: visible, positions, width: Math.max(760, 80 + Math.max(activeColumn, 1) * 240), height: Math.max(420, 90 + maxRows * 126) };
  }, [enabledKinds, projectNodes]);

  useEffect(() => {
    const area = graphScrollRef.current;
    if (!area) return;
    const frame = window.requestAnimationFrame(updateGraphViewport);
    const observer = new ResizeObserver(updateGraphViewport);
    observer.observe(area);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [codeHeight, explorerWidth, graphLayout.height, graphLayout.width, inspectorWidth, updateGraphViewport, zoom]);

  const focusedNodeId = useMemo(() => projectNodes.find((node) => node.file === activeFile)?.id ?? "", [activeFile, projectNodes]);

  const visibleEdges = useMemo(() => projectEdges.filter((edge) => focusedNodeId && (edge.from === focusedNodeId || edge.to === focusedNodeId)).flatMap((edge) => {
    const from = graphLayout.positions[edge.from];
    const to = graphLayout.positions[edge.to];
    if (!from || !to) return [];
    const fromCenter = { x: from.x + 90, y: from.y + 40 };
    const toCenter = { x: to.x + 90, y: to.y + 40 };
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    const safeDx = Math.abs(dx) || .001;
    const safeDy = Math.abs(dy) || .001;
    const fromScale = Math.min(90 / safeDx, 40 / safeDy);
    const toScale = Math.min(90 / safeDx, 40 / safeDy);
    const start = { x: fromCenter.x + dx * fromScale, y: fromCenter.y + dy * fromScale };
    const end = { x: toCenter.x - dx * toScale, y: toCenter.y - dy * toScale };
    const lineDx = end.x - start.x;
    const lineDy = end.y - start.y;
    return [{ ...edge, x: start.x, y: start.y, width: Math.hypot(lineDx, lineDy), angle: Math.atan2(lineDy, lineDx) * 180 / Math.PI }];
  }), [focusedNodeId, graphLayout, projectEdges]);

  const connectedNodeIds = useMemo(() => new Set([focusedNodeId, ...visibleEdges.flatMap((edge) => [edge.from, edge.to])].filter(Boolean)), [focusedNodeId, visibleEdges]);

  const minimapViewport = useMemo(() => {
    const contentWidth = Math.max(1, graphLayout.width * zoom);
    const contentHeight = Math.max(1, graphLayout.height * zoom);
    const width = Math.min(100, graphViewport.clientWidth / contentWidth * 100);
    const height = Math.min(100, graphViewport.clientHeight / contentHeight * 100);
    return {
      left: Math.min(100 - width, Math.max(0, -graphPan.x / contentWidth * 100)),
      top: Math.min(100 - height, Math.max(0, -graphPan.y / contentHeight * 100)),
      width,
      height,
    };
  }, [graphLayout.height, graphLayout.width, graphPan.x, graphPan.y, graphViewport.clientHeight, graphViewport.clientWidth, zoom]);

  const navigateFromMinimap = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const area = graphScrollRef.current;
    if (!area) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const xRatio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const yRatio = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
    setGraphPan({
      x: area.clientWidth / 2 - xRatio * graphLayout.width * zoom,
      y: area.clientHeight / 2 - yRatio * graphLayout.height * zoom,
    });
  };

  const beginGraphPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest(".graph-node"))) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    graphPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: graphPan.x,
      panY: graphPan.y,
    };
    event.currentTarget.classList.add("is-panning");
  };

  const moveGraphPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = graphPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    event.preventDefault();
    pendingGraphPanRef.current = { x: pan.panX + event.clientX - pan.startX, y: pan.panY + event.clientY - pan.startY };
    if (graphPanFrameRef.current !== null) return;
    graphPanFrameRef.current = window.requestAnimationFrame(() => {
      if (pendingGraphPanRef.current) setGraphPan(pendingGraphPanRef.current);
      pendingGraphPanRef.current = null;
      graphPanFrameRef.current = null;
    });
  };

  const endGraphPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (graphPanRef.current?.pointerId !== event.pointerId) return;
    if (graphPanFrameRef.current !== null) window.cancelAnimationFrame(graphPanFrameRef.current);
    if (pendingGraphPanRef.current) setGraphPan(pendingGraphPanRef.current);
    graphPanFrameRef.current = null;
    pendingGraphPanRef.current = null;
    graphPanRef.current = null;
    event.currentTarget.classList.remove("is-panning");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleGraphWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;
      const nextZoom = Math.min(2.5, Math.max(.35, zoom * Math.exp(-event.deltaY * .01)));
      const ratio = nextZoom / zoom;
      setGraphPan((currentPan) => ({
        x: pointerX - (pointerX - currentPan.x) * ratio,
        y: pointerY - (pointerY - currentPan.y) * ratio,
      }));
      setZoom(nextZoom);
      return;
    }
    setGraphPan((currentPan) => ({ x: currentPan.x - event.deltaX, y: currentPan.y - event.deltaY }));
  };

  const beginResize = useCallback((area: "explorer" | "inspector" | "code", event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startExplorer = explorerWidth;
    const startInspector = inspectorWidth;
    const startCode = codeHeight;
    let resizeFrame: number | null = null;
    let pendingPosition = { x: startX, y: startY };
    const applyResize = () => {
      if (area === "explorer") setExplorerWidth(Math.min(460, Math.max(250, startExplorer + pendingPosition.x - startX)));
      if (area === "inspector") setInspectorWidth(Math.min(560, Math.max(350, startInspector - pendingPosition.x + startX)));
      if (area === "code") {
        const columnHeight = canvasColumnRef.current?.clientHeight ?? window.innerHeight - 50;
        const availableCanvasHeight = Math.max(360, columnHeight - 56);
        const maximumCodeHeight = Math.floor(availableCanvasHeight * .8);
        setCodeHeight(Math.min(maximumCodeHeight, Math.max(180, startCode - pendingPosition.y + startY)));
      }
      resizeFrame = null;
    };
    document.body.classList.add("is-resizing");
    const onMove = (moveEvent: PointerEvent) => {
      pendingPosition = { x: moveEvent.clientX, y: moveEvent.clientY };
      if (resizeFrame === null) resizeFrame = window.requestAnimationFrame(applyResize);
    };
    const onUp = () => {
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      applyResize();
      document.body.classList.remove("is-resizing");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [codeHeight, explorerWidth, inspectorWidth]);

  const openCodeFile = useCallback((file: string) => {
    setActiveFile(file);
    setOpenFiles((current) => current.includes(file) ? current : [...current, file]);
  }, []);

  const closeCodeFile = (file: string) => {
    const closingIndex = openFiles.indexOf(file);
    const remaining = openFiles.filter((openFile) => openFile !== file);
    setOpenFiles(remaining);
    if (activeFile === file) setActiveFile(remaining[Math.min(closingIndex, remaining.length - 1)] ?? "");
  };

  const selectNode = (name: string) => {
    setSelected(name);
    setActiveStep(0);
    setInspectorTab("Overview");
    const detail = projectDetails[name];
    const graphNode = projectNodes.find((node) => node.id === name);
    if (detail) openCodeFile(graphNode?.file ?? detail.file.replace(/^src\//, ""));
  };

  const activateProject = (project: ProjectWorkspace) => {
    setActiveProjectId(project.id);
    setProjectName(project.name);
    setProjectFiles(project.files);
    setFileSources(project.sources);
    setProjectNodes(project.nodes);
    setProjectEdges(project.edges);
    setProjectDetails(project.details);
    setGithubSourceBase(project.githubSourceBase);
    setOpenFiles(project.openFiles);
    setActiveFile(project.activeFile);
    setSelected(project.selected);
    setIgnoredFiles(project.ignoredFiles);
    setReportIncludedCount(project.reportIncludedCount);
    setReportLabel(project.reportLabel);
    setActiveStep(0);
    setGraphPan({ x: 0, y: 0 });
    setZoom(1);
    setInspectorTab("Overview");
    setFileTab("Files");
    setMenu(null);
  };

  const requestProjectRemoval = (project: ProjectWorkspace) => {
    setProjectToRemove(project);
    setMenu(null);
    setModal("remove");
  };

  const dismissProjectRemoval = () => {
    setProjectToRemove(null);
    setModal(null);
  };

  const clearActiveProject = () => {
    setActiveProjectId("");
    setProjectName("");
    setProjectFiles([]);
    setFileSources({});
    setProjectNodes([]);
    setProjectEdges([]);
    setProjectDetails({});
    setGithubSourceBase("");
    setOpenFiles([]);
    setActiveFile("");
    setSelected("");
    setIgnoredFiles([]);
    setReportIncludedCount(0);
    setReportLabel("Imported project");
    setActiveStep(0);
    setGraphPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const confirmProjectRemoval = async () => {
    if (!projectToRemove || !authUser) return;
    const removedProject = projectToRemove;
    const remainingProjects = projects.filter((project) => project.id !== removedProject.id);
    const nextProject = removedProject.id === activeProjectId ? remainingProjects.at(-1) ?? null : activeAnalysisProject;
    setProjects(remainingProjects);
    setProjectToRemove(null);
    setModal(null);
    if (removedProject.id === activeProjectId) {
      if (nextProject) activateProject(nextProject);
      else clearActiveProject();
    }
    await writeWorkspaceSession(authUser.userId, {
      projects: remainingProjects,
      activeProjectId: nextProject?.id ?? "",
      showWorkspace: true,
      showReport: false,
      theme,
    });
    notify(`${removedProject.name} removed`);
  };

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    skipNextPersistenceRef.current = true;
    setSessionReady(false);
    if (!authUser) {
      setProjects([]);
      setActiveProjectId("");
      setShowWorkspace(false);
      setSessionReady(true);
      if (initialView === "workspace") window.location.replace("/login?return_to=%2Fworkspace");
      return () => { cancelled = true; };
    }
    readWorkspaceSession(authUser.userId)
      .then((session) => {
        if (cancelled) return;
        if (!session) {
          setProjects([]);
          setActiveProjectId("");
          setShowWorkspace(initialView === "workspace");
          return;
        }
        setTheme(session.theme ?? "dark");
        setProjects(session.projects ?? []);
        const project = session.projects?.find((item) => item.id === session.activeProjectId) ?? session.projects?.at(-1);
        if (project) {
          if (initialView === "workspace") activateProject(project);
          else setActiveProjectId(project.id);
          setShowWorkspace(initialView === "workspace");
          if (initialView === "workspace" && session.showReport) setModal("report");
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setSessionReady(true); });
    return () => { cancelled = true; };
  }, [authLoading, authUser, initialView]);

  useEffect(() => {
    if (!sessionReady || !authUser) return;
    if (skipNextPersistenceRef.current) {
      skipNextPersistenceRef.current = false;
      return;
    }
    const timeout = window.setTimeout(() => {
      void writeWorkspaceSession(authUser.userId, { projects, activeProjectId, showWorkspace, showReport: modal === "report", theme }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [activeProjectId, authUser, modal, projects, sessionReady, showWorkspace, theme]);

  const registerProject = (project: Omit<ProjectWorkspace, "id">) => {
    const workspace = { ...project, analyzedAt: project.analyzedAt ?? Date.now(), id: `${project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    setProjects((current) => [...current, workspace]);
    activateProject(workspace);
    setShowWorkspace(true);
  };

  const showDuplicateProject = (project: ProjectWorkspace) => {
    analysisRunRef.current += 1;
    setPendingProject(null);
    setDuplicateProject(project);
    setModal("duplicate");
  };

  const chooseAnotherProject = () => {
    setDuplicateProject(null);
    setModal(showWorkspace ? null : "import");
  };

  const dismissDuplicateProject = () => {
    setDuplicateProject(null);
    setModal(null);
  };

  const getNumberedProjectName = (name: string) => {
    const baseName = name.replace(/\s+#\d+$/, "");
    const usedNumbers = projects
      .filter((project) => project.name === baseName || project.name.startsWith(`${baseName} #`))
      .map((project) => project.name.match(/ #(\d+)$/)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(Number);
    return `${baseName} #${Math.max(0, ...usedNumbers) + 1}`;
  };

  const openDuplicateProject = async () => {
    if (!duplicateProject || !authUser) return;
    const sourceProject = duplicateProject;
    const numberedName = getNumberedProjectName(sourceProject.name);
    const project: ProjectWorkspace = {
      ...sourceProject,
      id: `${numberedName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      analyzedAt: Date.now(),
      name: numberedName,
      reportLabel: numberedName,
      openFiles: [...sourceProject.openFiles],
      files: [...sourceProject.files],
      sources: { ...sourceProject.sources },
      nodes: sourceProject.nodes.map((node) => ({ ...node })),
      edges: sourceProject.edges.map((edge) => ({ ...edge })),
      details: { ...sourceProject.details },
      ignoredFiles: sourceProject.ignoredFiles.map((file) => ({ ...file })),
    };
    if (showWorkspace) {
      const nextProjects = [...projects, project];
      setDuplicateProject(null);
      setProjects(nextProjects);
      activateProject(project);
      setModal(null);
      notify(`Opened duplicate as ${numberedName}`);
      await writeWorkspaceSession(authUser.userId, {
        projects: nextProjects,
        activeProjectId: project.id,
        showWorkspace: true,
        showReport: false,
        theme,
      });
      return;
    }
    const runId = ++analysisRunRef.current;
    setDuplicateProject(null);
    setAnalysisProgress({ status: "setup", stage: 5, name: numberedName, totalFiles: project.files.length, components: project.nodes.length, imports: project.edges.length, error: "" });
    setWorkspaceSetupProgress(8);
    setModal("analysis");
    for (const progress of [30, 58, 82, 100]) {
      await pauseAnalysis(750);
      if (analysisRunRef.current !== runId) return;
      setWorkspaceSetupProgress(progress);
    }
    await pauseAnalysis(450);
    if (analysisRunRef.current !== runId) return;
    const nextProjects = [...projects, project];
    await writeWorkspaceSession(authUser.userId, { projects: nextProjects, activeProjectId: project.id, showWorkspace: true, showReport: false, theme });
    window.location.assign("/workspace");
  };

  const pauseAnalysis = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  const openSavedWorkspace = async () => {
    if (!authUser) return;
    const project = projects.find((item) => item.id === activeProjectId) ?? projects.at(-1);
    const runId = ++analysisRunRef.current;
    setAnalysisProgress({
      status: "setup",
      stage: 5,
      name: project?.name ?? "Your workspace",
      totalFiles: project?.files.length ?? 0,
      components: project?.nodes.length ?? 0,
      imports: project?.edges.length ?? 0,
      error: "",
    });
    setWorkspaceSetupProgress(8);
    setModal("analysis");
    for (const progress of [30, 58, 82, 100]) {
      await pauseAnalysis(750);
      if (analysisRunRef.current !== runId) return;
      setWorkspaceSetupProgress(progress);
    }
    await pauseAnalysis(450);
    if (analysisRunRef.current !== runId) return;
    await writeWorkspaceSession(authUser.userId, { projects, activeProjectId: project?.id ?? activeProjectId, showWorkspace: true, showReport: false, theme });
    window.location.assign("/workspace");
  };

  const startAnalysis = (name: string, totalFiles: number) => {
    const runId = ++analysisRunRef.current;
    setPendingProject(null);
    setAnalysisIssues([]);
    setAnalysisProgress({ status: "progress", stage: 0, name, totalFiles, components: 0, imports: 0, error: "" });
    setModal("analysis");
    return runId;
  };

  const finishProjectAnalysis = async (project: Omit<ProjectWorkspace, "id" | "nodes" | "edges" | "details">, runId: number) => {
    if (analysisRunRef.current !== runId) return;
    setAnalysisProgress((current) => ({ ...current, stage: 1 }));
    await pauseAnalysis(280);
    if (analysisRunRef.current !== runId) return;
    const analysis = await analyzeProjectSources(project.sources, (progress) => {
      if (analysisRunRef.current !== runId) return;
      setAnalysisProgress((current) => ({
        ...current,
        stage: Math.max(current.stage, progress.stage),
        components: progress.components ?? current.components,
        imports: progress.imports ?? current.imports,
      }));
    });
    const issues = analysis.issues;
    const componentCount = analysis.nodes.filter((node) => node.kind === "Component" || node.kind === "Page").length;
    setAnalysisProgress((current) => ({ ...current, stage: 4, components: componentCount, imports: analysis.edges.length }));
    await pauseAnalysis(220);
    if (analysisRunRef.current !== runId) return;
    const workspace: ProjectWorkspace = { ...project, id: `${project.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, analyzedAt: Date.now(), nodes: analysis.nodes, edges: analysis.edges, details: analysis.details };
    setPendingProject(workspace);
    setAnalysisIssues(issues);
    setAnalysisProgress((current) => ({ ...current, status: issues.length ? "issues" : "complete", stage: 5 }));
  };

  const failProjectAnalysis = (error: unknown, runId: number) => {
    if (analysisRunRef.current !== runId) return;
    setPendingProject(null);
    setAnalysisProgress((current) => ({ ...current, status: "error", error: error instanceof Error ? error.message : "The project could not be analyzed. Please try another project." }));
    setModal("analysis");
  };

  const cancelProjectAnalysis = () => {
    analysisRunRef.current += 1;
    setPendingProject(null);
    setAnalysisIssues([]);
    setWorkspaceSetupProgress(0);
    setModal(null);
  };

  const openAnalyzedProject = async (location?: { file: string; line: number }) => {
    if (!pendingProject || !authUser) return;
    const canOpenLocation = Boolean(location && pendingProject.files.includes(location.file));
    const project = canOpenLocation && location ? {
      ...pendingProject,
      activeFile: location.file,
      selected: pendingProject.nodes.some((node) => node.file === location.file) ? location.file : pendingProject.selected,
      openFiles: Array.from(new Set([...pendingProject.openFiles, location.file])),
    } : pendingProject;
    if (canOpenLocation && location) setHighlightedLocation({ ...location, endLine: location.line });
    if (showWorkspace) {
      const nextProjects = [...projects, project];
      setProjects(nextProjects);
      activateProject(project);
      setPendingProject(null);
      setWorkspaceSetupProgress(0);
      setModal(project.ignoredFiles.length ? "report" : null);
      notify(`${project.reportIncludedCount} source files analyzed`);
      await writeWorkspaceSession(authUser.userId, {
        projects: nextProjects,
        activeProjectId: project.id,
        showWorkspace: true,
        showReport: project.ignoredFiles.length > 0,
        theme,
      });
      return;
    }
    const runId = analysisRunRef.current;
    setWorkspaceSetupProgress(8);
    setAnalysisProgress((current) => ({ ...current, status: "setup" }));
    for (const progress of [30, 58, 82, 100]) {
      await pauseAnalysis(750);
      if (analysisRunRef.current !== runId) return;
      setWorkspaceSetupProgress(progress);
    }
    await pauseAnalysis(450);
    if (analysisRunRef.current !== runId) return;
    const nextProjects = [...projects, project];
    if (canOpenLocation && location) window.sessionStorage.setItem("component-atlas-source-location", JSON.stringify(location));
    await writeWorkspaceSession(authUser.userId, { projects: nextProjects, activeProjectId: project.id, showWorkspace: true, showReport: project.ignoredFiles.length > 0, theme });
    window.location.assign("/workspace");
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    if (!picked.length) return;
    const classifiedEntries = picked.map((file) => {
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      return { file, path, reason: getIgnoreReason(path, file.size) };
    });
    const includedEntries = classifiedEntries.filter((entry) => entry.reason === null);
    const analysisConfigEntries = classifiedEntries.filter((entry) => isAnalyzerConfigFile(entry.path));
    const ignored = classifiedEntries.filter((entry) => entry.reason !== null).map((entry) => ({ path: entry.path, reason: entry.reason as string }));
    const sourceEntries = includedEntries.filter((entry) => SOURCE_FILE_PATTERN.test(entry.path));
    if (!sourceEntries.length) {
      const allPaths = classifiedEntries.map((entry) => entry.path);
      const root = allPaths[0]?.includes("/") ? allPaths[0].split("/")[0] : "Selected project";
      setUnsupportedProject({ name: root, type: detectUnsupportedStack(allPaths) });
      setModal("unsupported");
      event.target.value = "";
      return;
    }
    const sourceFiles = sourceEntries.map((entry) => entry.file);
    const rawPaths = includedEntries.map((entry) => entry.path);
    const root = rawPaths[0]?.includes("/") ? rawPaths[0].split("/")[0] : "";
    const paths = rawPaths.map((path) => root && path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path);
    const name = root || sourceFiles[0]?.name.replace(/\.[^.]+$/, "") || `Project ${projects.length + 1}`;
    event.target.value = "";
    const runId = startAnalysis(name, sourceFiles.length);
    try {
      await pauseAnalysis(220);
      const loadedSourceEntries = await Promise.all(includedEntries.map(async (entry, index) => [paths[index], BINARY_ASSET_PATTERN.test(entry.path) ? await readBinaryAsset(entry.file) : await entry.file.text()] as const));
      const loadedConfigEntries = await Promise.all(analysisConfigEntries.map(async (entry) => {
        const configPath = root && entry.path.startsWith(`${root}/`) ? entry.path.slice(root.length + 1) : entry.path;
        return [configPath, await entry.file.text()] as const;
      }));
      const loadedSources = Object.fromEntries([...loadedSourceEntries, ...loadedConfigEntries]);
      const sourceKey = fingerprintSources(loadedSources);
      const duplicate = projects.find((project) => project.sourceKey === sourceKey);
      if (duplicate) { showDuplicateProject(duplicate); return; }
      await finishProjectAnalysis({
        sourceKey,
        name,
        files: paths,
        sources: loadedSources,
        githubSourceBase: "",
        openFiles: paths.find((path) => SOURCE_FILE_PATTERN.test(path)) ? [paths.find((path) => SOURCE_FILE_PATTERN.test(path))!] : [],
        activeFile: paths.find((path) => SOURCE_FILE_PATTERN.test(path)) ?? "",
        selected: paths.find((path) => SOURCE_FILE_PATTERN.test(path)) ?? "",
        ignoredFiles: ignored,
        reportIncludedCount: includedEntries.length,
        reportLabel: name,
      }, runId);
    } catch (error) {
      failProjectAnalysis(error, runId);
    }
  };

  const analyzePaste = async (conflictAction: "prompt" | "replace" = "prompt") => {
    if (!pasteCode.trim()) { notify("Paste some React or TypeScript code first"); return; }
    const named = pasteCode.match(/(?:function|class|const)\s+([A-Z][A-Za-z0-9_]*)/)?.[1] ?? "PastedComponent";
    let file = `components/${named}.tsx`;
    const addToCurrentProject = pasteDestination === "current" && showWorkspace && Boolean(activeProjectId);
    if (addToCurrentProject && fileSources[file] !== undefined && conflictAction === "prompt") {
      setPasteConflict(file);
      return;
    }
    const nextSources = addToCurrentProject ? { ...fileSources, [file]: pasteCode } : { [file]: pasteCode };
    if (addToCurrentProject) {
      const analysis = await analyzeProjectSources(nextSources);
      setProjectFiles((current) => Array.from(new Set([...current, file])));
      setFileSources(nextSources);
      setProjectNodes(analysis.nodes);
      setProjectEdges(analysis.edges);
      setProjectDetails(analysis.details);
      setSelected(file);
      openCodeFile(file);
      setPasteCode("");
      setPasteConflict(null);
      setModal(null);
      notify(`${file.split("/").at(-1)} ${conflictAction === "replace" ? "replaced" : "added"} and analyzed`);
      return;
    }
    const sourceKey = fingerprintSources(nextSources);
    const duplicate = projects.find((project) => project.sourceKey === sourceKey);
    if (duplicate) { setPasteCode(""); showDuplicateProject(duplicate); return; }
    const runId = startAnalysis(named, 1);
    try {
      await pauseAnalysis(220);
      await finishProjectAnalysis({
        sourceKey,
        name: named,
        files: [file],
        sources: nextSources,
        githubSourceBase: "",
        openFiles: [file],
        activeFile: file,
        selected: file,
        ignoredFiles: [],
        reportIncludedCount: 1,
        reportLabel: `${named}.tsx`,
      }, runId);
    } catch (error) {
      failProjectAnalysis(error, runId);
    }
    setPasteCode("");
    setPasteConflict(null);
  };

  const importGithub = async () => {
    const match = githubUrl.trim().match(/github\.com\/([^/]+)\/([^/#]+)/i);
    if (!match) { notify("Enter a valid public GitHub repository URL"); return; }
    const [, owner, rawRepo] = match;
    const repo = rawRepo.replace(/\.git$/, "");
    const sourceKey = `github:${owner.toLowerCase()}/${repo.toLowerCase()}`;
    const duplicate = projects.find((project) => project.sourceKey === sourceKey);
    if (duplicate) { setGithubUrl(""); showDuplicateProject(duplicate); return; }
    const runId = startAnalysis(repo, 0);
    try {
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!repoResponse.ok) throw new Error("Repository could not be read");
      const repoData = await repoResponse.json() as { default_branch?: string };
      const branch = repoData.default_branch ?? "main";
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
      if (!response.ok) throw new Error("Repository could not be read");
      const data = await response.json() as { tree?: Array<{ path: string; type: string; size?: number }> };
      const repositoryFiles = (data.tree ?? []).filter((item) => item.type === "blob");
      const classifiedFiles = repositoryFiles.map((item) => ({ path: item.path, size: item.size ?? 0, reason: getIgnoreReason(item.path, item.size ?? 0) }));
      const includedCandidates = classifiedFiles.filter((file) => file.reason === null).map(({ path, size }) => ({ path, size }));
      const sourceCandidates = includedCandidates.filter((file) => SOURCE_FILE_PATTERN.test(file.path));
      const supportingCandidates = includedCandidates.filter((file) => !SOURCE_FILE_PATTERN.test(file.path));
      const sourceFiles = selectGithubSourceFiles(sourceCandidates);
      const selectedSourceFiles = new Set(sourceFiles);
      const analysisConfigFiles = classifiedFiles.filter((file) => isAnalyzerConfigFile(file.path)).map((file) => file.path).slice(0, 10);
      const ignored = classifiedFiles.filter((file) => file.reason !== null).map((file) => ({ path: file.path, reason: file.reason as string }));
      sourceCandidates.filter((file) => !selectedSourceFiles.has(file.path)).forEach((file) => ignored.push({ path: file.path, reason: "Source analysis budget — lower-priority source was omitted after prioritizing application directories and staying within the browser memory budget." }));
      if (!sourceFiles.length) {
        analysisRunRef.current += 1;
        setUnsupportedProject({ name: repo, type: detectUnsupportedStack(repositoryFiles.map((file) => file.path)) });
        setGithubUrl("");
        setModal("unsupported");
        return;
      }
      const rawBase = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`;
      const loadedSources: Record<string, string> = {};
      setAnalysisProgress((current) => ({ ...current, totalFiles: sourceFiles.length }));
      const initialFilesToLoad = [...sourceFiles, ...analysisConfigFiles];
      for (let index = 0; index < initialFilesToLoad.length; index += 20) {
        const batch = initialFilesToLoad.slice(index, index + 20);
        const loaded = await Promise.all(batch.map(async (file) => {
          const assetUrl = `${rawBase}${file.split("/").map(encodeURIComponent).join("/")}`;
          const sourceResponse = await fetch(assetUrl);
          if (!sourceResponse.ok) throw new Error(`Could not read ${file}`);
          return [file, await sourceResponse.text()] as const;
        }));
        loaded.forEach(([file, source]) => { loadedSources[file] = source; });
      }
      const referencedSupporting = referencedSupportingFiles(loadedSources, supportingCandidates);
      const supportingFiles = selectGithubSupportingFiles(supportingCandidates, referencedSupporting);
      const selectedSupportingFiles = new Set(supportingFiles);
      supportingCandidates.filter((file) => !selectedSupportingFiles.has(file.path)).forEach((file) => ignored.push({ path: file.path, reason: "Supporting-file budget — referenced styles and assets were prioritized before lower-priority resources to keep the workspace responsive." }));
      for (let index = 0; index < supportingFiles.length; index += 20) {
        const batch = supportingFiles.slice(index, index + 20);
        const loaded = await Promise.all(batch.map(async (file) => {
          const assetUrl = `${rawBase}${file.split("/").map(encodeURIComponent).join("/")}`;
          if (BINARY_ASSET_PATTERN.test(file)) return [file, assetUrl] as const;
          const sourceResponse = await fetch(assetUrl);
          if (!sourceResponse.ok) throw new Error(`Could not read ${file}`);
          return [file, await sourceResponse.text()] as const;
        }));
        loaded.forEach(([file, source]) => { loadedSources[file] = source; });
      }
      const includedFiles = [...sourceFiles, ...supportingFiles];
      setAnalysisProgress((current) => ({ ...current, totalFiles: includedFiles.length }));
      await finishProjectAnalysis({
        sourceKey,
        name: repo,
        files: includedFiles,
        sources: loadedSources,
        githubSourceBase: rawBase,
        openFiles: sourceFiles[0] ? [sourceFiles[0]] : [],
        activeFile: sourceFiles[0] ?? "",
        selected: sourceFiles[0] ?? "",
        ignoredFiles: ignored,
        reportIncludedCount: includedFiles.length,
        reportLabel: repo,
      }, runId);
      setGithubUrl("");
    } catch (error) {
      failProjectAnalysis(error, runId);
    }
  };

  const openProjectFile = useCallback(async (file: string) => {
    openCodeFile(file);
    const graphNode = projectNodes.find((node) => node.file === file);
    if (graphNode) {
      const changedSelection = graphNode.id !== selected;
      setSelected(graphNode.id);
      if (changedSelection) setActiveStep(0);
      setInspectorTab("Overview");
    }
    if (githubSourceBase && (!fileSources[file] || fileSources[file].includes("Source will load when this file is opened"))) {
      setFileSources((current) => ({ ...current, [file]: "// Loading source…" }));
      try {
        const response = await fetch(`${githubSourceBase}${file.split("/").map(encodeURIComponent).join("/")}`);
        if (!response.ok) throw new Error();
        const source = await response.text();
        setFileSources((current) => ({ ...current, [file]: source }));
        const nextSources = { ...fileSources, [file]: source };
        const analysis = await analyzeProjectSources(nextSources);
        setProjectNodes(analysis.nodes);
        setProjectEdges(analysis.edges);
        setProjectDetails(analysis.details);
      } catch {
        setFileSources((current) => ({ ...current, [file]: "// This file could not be loaded from GitHub." }));
      }
    }
  }, [fileSources, githubSourceBase, openCodeFile, projectNodes, selected]);

  const jumpToCodeLocation = useCallback((file: string, line: number, endLine = line) => {
    const safeLine = Math.max(1, line);
    const safeEndLine = Math.max(safeLine, endLine);
    void openProjectFile(file);
    setHighlightedLocation({ file, line: safeLine, endLine: safeEndLine });
    notify(`Opened ${file.split("/").at(-1) ?? file} at ${lineRangeLabel(safeLine, safeEndLine).toLowerCase()}`);
  }, [notify, openProjectFile]);

  useEffect(() => {
    if (!highlightedLocation || highlightedLocation.file !== activeFile) return;
    const frame = window.requestAnimationFrame(() => {
      const line = codePreviewRef.current?.querySelector<HTMLElement>(`[data-line="${highlightedLocation.line}"]`);
      line?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeFile, activeSource, highlightedLocation]);

  useEffect(() => {
    if (!showWorkspace || !sessionReady) return;
    const storedLocation = window.sessionStorage.getItem("component-atlas-source-location");
    if (!storedLocation) return;
    window.sessionStorage.removeItem("component-atlas-source-location");
    try {
      const location = JSON.parse(storedLocation) as { file?: string; line?: number; endLine?: number };
      if (location.file && typeof location.line === "number") { const line = Math.max(1, location.line); setHighlightedLocation({ file: location.file, line, endLine: Math.max(line, location.endLine ?? line) }); }
    } catch { /* Ignore malformed navigation state. */ }
  }, [sessionReady, showWorkspace]);

  const fileTreeRows = useMemo(() => filteredFiles.map((file) => {
    const extension = sourceExtension(file);
    return <button className={`${file === activeFile ? "active-file " : ""}file-type-${extension} file-category-${fileCategory(file)}`} key={file} title={`${file} · ${extension.toUpperCase()} ${fileCategory(file)}`} onClick={() => openProjectFile(file)}>{fileIcon(file)}<span className="file-name">{file}</span><em className="file-extension">{extension}</em></button>;
  }), [activeFile, filteredFiles, openProjectFile]);

  const findNode = (value: string) => {
    setNodeQuery(value);
    const match = projectNodes.find((node) => node.name.toLowerCase().includes(value.toLowerCase()) || node.file.toLowerCase().includes(value.toLowerCase()));
    if (value && match) selectNode(match.id);
  };

  const analysisSteps = [
    ["Reading files", analysisProgress.totalFiles ? `${analysisProgress.totalFiles} files` : "Reading repository…"],
    ["Detecting components", analysisProgress.components ? `${analysisProgress.components} found` : "Scanning source…"],
    ["Resolving imports", analysisProgress.imports ? `${analysisProgress.imports} imports` : "Checking dependencies…"],
    ["Mapping data flow", "Tracing props and state…"],
    ["Building graph", analysisProgress.status === "complete" || analysisProgress.status === "issues" ? "Ready" : "Waiting"],
  ];
  const analysisPercent = analysisProgress.status === "complete" || analysisProgress.status === "issues" ? 100 : Math.min(92, 12 + analysisProgress.stage * 20);
  const setupStage = workspaceSetupProgress < 38 ? 0 : workspaceSetupProgress < 70 ? 1 : 2;
  const setupSteps = ["Positioning the component graph", "Preparing the flow inspector", "Opening source files and tabs"];
  const analysisContent = modal === "analysis" ? <div className="analysis-dialog">
    <header><img className="logo" src="/component-atlas-logo.png" alt="" /><strong>Component Atlas</strong></header>
    {analysisProgress.status === "setup" ? <div className="workspace-setup-state"><span className="workspace-setup-mark"><img src="/component-atlas-logo.png" alt="" /></span><div className="analysis-kicker">OPENING WORKSPACE</div><h2>Setting up your environment</h2><p>{analysisProgress.name} · Preparing your interactive graph</p><div className="workspace-setup-progress"><i style={{ width: `${workspaceSetupProgress}%` }} /></div><strong className="workspace-setup-percent">{workspaceSetupProgress}%</strong><ol>{setupSteps.map((step, index) => <li className={index < setupStage || workspaceSetupProgress === 100 ? "complete" : index === setupStage ? "active" : ""} key={step}><span>{index < setupStage || workspaceSetupProgress === 100 ? <Check aria-hidden="true" /> : index === setupStage ? <i /> : null}</span><b>{step}</b><small>{index < setupStage || workspaceSetupProgress === 100 ? "Ready" : index === setupStage ? "Working…" : "Waiting"}</small></li>)}</ol><button className="analysis-cancel" onClick={cancelProjectAnalysis}>Cancel</button></div> : analysisProgress.status === "error" ? <div className="analysis-error-state"><span className="analysis-error-icon">!</span><div className="analysis-kicker error-kicker">ANALYSIS FAILED</div><h2>We couldn&apos;t map this project</h2><p>{analysisProgress.error}</p><div className="analysis-error-help"><b>Your current workspace is safe.</b><span>Check that the project contains readable React, JavaScript, or TypeScript source files, then try again.</span></div><button className="analysis-primary" onClick={cancelProjectAnalysis}>Choose another project</button></div> : analysisProgress.status === "issues" ? <div className="analysis-issues-state"><span className="analysis-issues-icon">△</span><div className="analysis-kicker issues-kicker">ANALYSIS INCOMPLETE</div><h2>We found {analysisIssues.length} issue{analysisIssues.length === 1 ? "" : "s"}</h2><p>Most of the project was mapped. Select an issue to open its exact source line.</p><div className="analysis-issue-list">{analysisIssues.map((issue, index) => <button className={`analysis-issue-entry analysis-issue-${issue.severity ?? "error"}`} key={`${issue.file}-${issue.line}-${index}`} onClick={() => void openAnalyzedProject({ file: issue.file, line: issue.line })}><i>{issue.source === "eslint" ? "ES" : issue.title === "Unresolved import" ? "△" : "</>"}</i><span><b>{issue.title}{issue.ruleId ? <em>{issue.ruleId}</em> : null}</b><small>{issue.file} · Line {issue.line}{issue.column ? `:${issue.column}` : ""}</small></span><code>{issue.detail}</code></button>)}</div><div className="analysis-issue-actions"><button className="analysis-secondary" onClick={cancelProjectAnalysis}>Choose another project</button><button className="analysis-primary" onClick={() => void openAnalyzedProject()}>Open partial graph</button></div></div> : <div className="analysis-progress-state">
      <span className={`analysis-mark ${analysisProgress.status === "complete" ? "complete" : ""}`}><img src="/component-atlas-logo.png" alt="" /></span>
      <div className="analysis-kicker">{analysisProgress.status === "complete" ? "ANALYSIS COMPLETE" : "ANALYZING PROJECT"}</div>
      <h2>{analysisProgress.status === "complete" ? "Your component map is ready" : "Building your component map"}</h2>
      <p>{analysisProgress.name} · {analysisProgress.totalFiles || "…"} files analyzed</p>
      <div className="analysis-progress-bar"><i style={{ width: `${analysisPercent}%` }} /></div>
      <ol>{analysisSteps.map(([label, detail], index) => { const complete = analysisProgress.status === "complete" || index < analysisProgress.stage; const active = analysisProgress.status === "progress" && index === analysisProgress.stage; return <li className={active ? "active" : complete ? "complete" : ""} key={label}><span>{complete ? "✓" : active ? "●" : ""}</span><b>{label}</b><small>{detail}</small></li>; })}</ol>
      <div className="analysis-actions"><button className="analysis-primary" disabled={analysisProgress.status !== "complete"} onClick={() => void openAnalyzedProject()}>Open workspace <span>›</span></button><button className="analysis-cancel" onClick={cancelProjectAnalysis}>{analysisProgress.status === "complete" ? "Not now" : "Cancel"}</button></div>
    </div>}
  </div> : null;
  const duplicateContent = modal === "duplicate" && duplicateProject ? <div className="duplicate-project-state">
    <span className="duplicate-project-icon"><Copy aria-hidden="true" /></span>
    <div className="duplicate-project-kicker">PROJECT ALREADY ADDED</div>
    <h2>This project is already in Component Atlas</h2>
    <p><strong>{duplicateProject.name}</strong> matches a project you previously imported. You can choose a different project or open another numbered copy.</p>
    <div className="duplicate-project-preview"><span>Existing project</span><b>{duplicateProject.name}</b><small>{duplicateProject.files.length} source files</small></div>
    <p className="duplicate-project-note">Opening anyway will add it as <strong>{getNumberedProjectName(duplicateProject.name)}</strong>.</p>
    <div className="duplicate-project-actions"><button className="analysis-secondary" onClick={chooseAnotherProject}>Choose another project</button><button className="analysis-primary" onClick={openDuplicateProject}>Open anyway</button></div>
  </div> : null;
  const pasteContent = modal === "paste" ? <div className="paste-dialog">
    <h2>Paste source code</h2>
    <p>{pasteDestination === "current" && showWorkspace ? `Add a React or TypeScript component to ${projectName}.` : "Create a new project from a React or TypeScript component."}</p>
    {showWorkspace && activeProjectId && <div className="paste-destination" role="group" aria-label="Choose where pasted code should be saved">
      <button className={pasteDestination === "current" ? "active" : ""} aria-pressed={pasteDestination === "current"} onClick={() => { setPasteDestination("current"); setPasteConflict(null); }}><Boxes aria-hidden="true" /><span><b>Add to current project</b><small>{projectName}</small></span></button>
      <button className={pasteDestination === "new" ? "active" : ""} aria-pressed={pasteDestination === "new"} onClick={() => { setPasteDestination("new"); setPasteConflict(null); }}><FilePlus2 aria-hidden="true" /><span><b>Create a new project</b><small>Keep this code separate</small></span></button>
    </div>}
    <textarea value={pasteCode} onChange={(event) => { setPasteCode(event.target.value); setPasteConflict(null); }} placeholder="export function MyComponent() { ... }" />
    {pasteConflict ? <div className="paste-conflict" role="alert"><strong>Duplicate file detected</strong><p><b>{pasteConflict}</b> already exists in this project. Adding this code will replace the existing file. Do you still want to continue?</p><div><button onClick={() => { setPasteConflict(null); setPasteCode(""); setModal(null); }}>Cancel</button><button className="danger" onClick={() => void analyzePaste("replace")}>Replace file</button></div></div> : <button className="primary-action" onClick={() => void analyzePaste()}>{pasteDestination === "current" && showWorkspace ? "Add and analyze code" : "Create and analyze project"}</button>}
  </div> : null;

  if (!sessionReady) return <main key="session-restore" data-app-view="session-restore" className={`session-restore-page ${theme === "light" ? "light-theme" : ""}`}><img src="/component-atlas-logo.png" alt="" /><span /><h1>Restoring your workspace</h1><p>Loading your saved projects and last open view…</p></main>;

  if (modal === "analysis" && analysisProgress.status === "setup") return (
    <main key="workspace-setup" data-app-view="workspace-setup" className={`workspace-setup-page ${theme === "light" ? "light-theme" : ""}`}>
      <header className="setup-page-header">
        <div><img className="logo" src="/component-atlas-logo.png" alt="" /><strong>Component Atlas</strong></div>
        <span>Workspace setup</span>
      </header>
      <section className="setup-page-main" aria-live="polite">
        <div className="setup-page-visual" aria-hidden="true">
          <span><img src="/component-atlas-logo.png" alt="" /></span>
          <i className="setup-orbit setup-orbit-one" />
          <i className="setup-orbit setup-orbit-two" />
          <i className="setup-orbit setup-orbit-three" />
        </div>
        <div className="analysis-kicker">OPENING WORKSPACE</div>
        <h1>Setting up your environment</h1>
        <p><strong>{analysisProgress.name}</strong> is ready. Component Atlas is preparing the interactive tools for your project.</p>
        <div className="setup-page-progress" role="progressbar" aria-label="Workspace setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={workspaceSetupProgress}>
          <i style={{ width: `${workspaceSetupProgress}%` }} />
        </div>
        <div className="setup-page-progress-meta"><span>Preparing workspace</span><strong>{workspaceSetupProgress}%</strong></div>
        <ol className="setup-page-steps">
          {setupSteps.map((step, index) => <li className={index < setupStage || workspaceSetupProgress === 100 ? "complete" : index === setupStage ? "active" : ""} key={step}><span>{index < setupStage || workspaceSetupProgress === 100 ? <Check aria-hidden="true" /> : index === setupStage ? <i /> : null}</span><div><b>{step}</b><small>{index < setupStage || workspaceSetupProgress === 100 ? "Ready" : index === setupStage ? "In progress" : "Waiting"}</small></div></li>)}
        </ol>
        <button className="setup-page-cancel" onClick={cancelProjectAnalysis}>Cancel setup</button>
      </section>
      <footer className="setup-page-footer"><ShieldCheck aria-hidden="true" /> Your source remains private and is never executed.</footer>
    </main>
  );

  if (!showWorkspace) return (
    <main key="landing" data-app-view="landing" className={`landing-shell ${theme === "light" ? "landing-light" : ""}`} onClick={() => menu && setMenu(null)}>
      <nav className="landing-nav">
        <a className="landing-brand" href="#top"><img className="logo" src="/component-atlas-logo.png" alt="" /><strong>Component Atlas</strong></a>
        <div className="landing-nav-links"><a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#security">Security</a><button className="landing-theme-toggle" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button>{authUser && <button className="landing-dashboard-link" onClick={openSavedWorkspace}><Monitor aria-hidden="true" /> Open dashboard</button>}<button disabled={authLoading} title={authUser ? "Import a React project" : "Sign in to upload a project"} onClick={requestLandingImport}>{authUser ? <>Import a project <ArrowRight aria-hidden="true" /></> : <><LogIn aria-hidden="true" /> Sign in to upload</>}</button>{!authLoading && (authUser ? <div className="menu-wrap landing-account"><button className="landing-profile" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded={menu === "account"} onClick={(event) => { event.stopPropagation(); setMenu(menu === "account" ? null : "account"); }}>{authInitials}</button>{menu === "account" && <div className="popover account-menu landing-account-menu" role="menu" onClick={(event) => event.stopPropagation()}><strong>{authUser.displayName}</strong><span>{authUser.email}</span><a href="/login?signout=1&return_to=%2F"><LogOut aria-hidden="true" /> Log out</a></div>}</div> : <a className="landing-login" href="/login?return_to=%2F"><LogIn aria-hidden="true" /> Sign in</a>)}</div>
      </nav>

      <input ref={fileInputRef} className="hidden-input" type="file" multiple onChange={handleFiles} {...({ webkitdirectory: "" } as { webkitdirectory: string })} />

      <section className="landing-hero landing-reveal" id="top">
        <div className="hero-copy">
          <div className="hero-eyebrow"><i /> Static analysis for React</div>
          <h1><strong>Understand any<br />codebase.</strong><span>Before you touch<br />a line.</span></h1>
          <p>Upload a React project and get an interactive map of its components, data flow, state, routes, and execution paths—without running the code.</p>
          <div className="hero-actions">
            <button className="hero-upload" disabled={authLoading} title={authUser ? "Upload your React project" : "Sign in to upload a project"} onClick={requestLandingImport}>{authUser ? <><Upload className="upload-icon" aria-hidden="true" /> Upload your project <ArrowRight className="button-arrow" aria-hidden="true" /></> : <><LogIn className="upload-icon" aria-hidden="true" /> Sign in to upload <ArrowRight className="button-arrow" aria-hidden="true" /></>}</button>
            <a className="hero-tour" href="#product"><span><Play aria-hidden="true" /></span> See how it works</a>
          </div>
          <div className="hero-support"><span><Check aria-hidden="true" /> Your source stays private</span><span><Check aria-hidden="true" /> No code execution</span><span><Check aria-hidden="true" /> React &amp; TypeScript</span></div>
        </div>
        <div className="hero-product" aria-label="Preview of the Component Atlas analysis workspace">
          <div className="hero-product-glow" />
          <div className="hero-shot">
            <div className="hero-shot-top"><strong><img src="/component-atlas-logo.png" alt="" /> Component Atlas</strong><em>acme-dashboard</em><small>● Analysis complete</small></div>
            <div className="hero-shot-body">
              <aside><h3>PROJECT EXPLORER</h3><p>▱ src</p><ul><li className="active">⌁ Dashboard.tsx</li><li>▦ Header.tsx</li><li>▦ ActivityFeed.tsx</li><li>↪ useActivity.ts</li><li>⬡ activityApi.ts</li></ul></aside>
              <section><header><b>Component graph</b><small>7 nodes · 8 relationships</small></header><div className="hero-shot-graph"><i className="shot-edge shot-edge-a" /><i className="shot-edge shot-edge-b" /><i className="shot-edge shot-edge-c" /><i className="shot-edge shot-edge-d" /><div className="shot-node shot-node-a"><b>Dashboard</b><small>pages/Dashboard.tsx</small></div><div className="shot-node shot-node-b"><b>Header</b><small>components/Header.tsx</small></div><div className="shot-node shot-node-c"><b>ActivityFeed</b><small>components/ActivityFeed.tsx</small></div><div className="shot-node shot-node-d"><b>useActivity</b><small>hooks/useActivity.ts</small></div><div className="shot-node shot-node-e"><b>activityApi</b><small>services/activityApi.ts</small></div></div><pre><code><i>useEffect</i>{'(() => activityApi.fetchActivity(), []);'}</code></pre></section>
              <aside className="hero-shot-inspector"><h3>FLOW INSPECTOR</h3><h4>Dashboard</h4><small>pages/Dashboard.tsx</small><div><b>Props <em>3</em></b><b>Hooks <em>2</em></b></div><h5>HOW IT WORKS</h5><ol><li>1&nbsp; Route opens</li><li>2&nbsp; State initializes</li><li className="active">3&nbsp; API request data</li><li>4&nbsp; Response updates state</li></ol></aside>
            </div>
          </div>
          <span className="hero-shot-chip chip-private">✓&nbsp; Static analysis only</span>
          <span className="hero-shot-chip chip-flow">⌁ <b>Data flow traced</b><small>Dashboard → ActivityFeed</small></span>
        </div>
      </section>

      <section className="landing-capability-strip landing-reveal"><small>Maps the things that usually<br />take hours to find</small><span><Boxes aria-hidden="true" /> Components &amp; props</span><span><Workflow aria-hidden="true" /> Data flow</span><span><Activity aria-hidden="true" /> State &amp; effects</span><span><Route aria-hidden="true" /> Routes</span><span><Database aria-hidden="true" /> API calls</span></section>

      <section className="landing-preview-section landing-reveal" id="product">
        <div className="landing-section-copy"><span>SEE THE WHOLE SYSTEM</span><h2>From file tree to execution flow</h2><p>Atlas turns source code into a navigable model. Select any component to see where its data comes from and what happens next.</p></div>
        <div className="preview-switchers"><article><i><Network aria-hidden="true" /></i><span><b>Component graph</b><small>See every relationship</small></span></article><article><i><Workflow aria-hidden="true" /></i><span><b>Execution flow</b><small>Follow behavior step by step</small></span></article><article><i><Code2 aria-hidden="true" /></i><span><b>Connected source</b><small>Jump directly to the code</small></span></article></div>
        <div className="landing-product-frame" role="img" aria-label="Component Atlas workspace preview showing a file explorer, component graph, source code, and flow inspector">
          <div className="demo-topbar"><div><i /><i /><i /></div><strong><img src="/component-atlas-logo.png" alt="" /> Component Atlas</strong><em>acme-dashboard⌄</em><small>● Analysis complete</small><b>Search project&nbsp;&nbsp; ⌘ K</b></div>
          <div className="demo-workspace">
            <aside className="demo-explorer"><h3>PROJECT EXPLORER</h3><button>↥ Import project</button><label>⌕ Search files...</label><p>⌄ ▱ <b>src</b></p><ul><li>└─ App.tsx</li><li className="demo-active">└─ Dashboard.tsx</li><li>└─ Header.tsx</li><li>└─ ActivityFeed.tsx</li><li>└─ useActivity.ts</li></ul></aside>
            <div className="demo-center"><div className="demo-toolbar"><b>◇ Component graph</b><span>7 nodes · 8 relationships</span><i>Find node&nbsp;&nbsp; Filter</i></div><div className="demo-graph"><i className="demo-edge edge-a" /><i className="demo-edge edge-b" /><i className="demo-edge edge-c" /><div className="demo-node node-a"><b>Dashboard</b><small>pages/Dashboard.tsx</small></div><div className="demo-node node-b"><b>Header</b><small>components/Header.tsx</small></div><div className="demo-node node-c"><b>ActivityFeed</b><small>components/ActivityFeed.tsx</small></div><div className="demo-node node-d"><b>useActivity</b><small>hooks/useActivity.ts</small></div><div className="demo-legend">━ Import / render&nbsp;&nbsp; <span>━ Data flow</span>&nbsp;&nbsp; ┄ Callback</div></div><div className="demo-code"><div><b>Dashboard.tsx</b><span>useActivity.ts</span><em>Source preview</em></div><pre><code><i>import</i> {'{ Header }'} <i>from</i> <q>&quot;../components/Header&quot;</q>;{`\n`}<i>export function</i> <strong>Dashboard</strong>() {'{'}{`\n  `}<i>const</i> {'{ activities }'} = <strong>useActivity</strong>();{`\n  `}<i>return</i> &lt;<strong>ActivityFeed</strong> items={'{activities}'} /&gt;;{`\n`}{'}'}</code></pre></div></div>
            <aside className="demo-inspector"><h3>FLOW INSPECTOR</h3><div className="demo-file-title"><i>⌁</i><span><b>Dashboard</b><small>pages/Dashboard.tsx</small></span></div><nav>Overview&nbsp;&nbsp; Relations&nbsp;&nbsp; Source</nav><div className="demo-metrics"><span>Props <b>3</b></span><span>State <b>1</b></span><span>Effects <b>2</b></span><span>Events <b>2</b></span></div><h4>HOW THIS FILE WORKS</h4><ol><li><b>1</b> Dashboard renders</li><li className="demo-step"><b>2</b> useActivity loads data</li><li><b>3</b> ActivityFeed receives items</li></ol></aside>
          </div>
        </div>
      </section>

      <section className="landing-steps landing-reveal" id="how-it-works">
        <div className="landing-steps-heading"><span>ZERO SETUP</span><h2>A map in three steps</h2></div>
        <div className="landing-step-grid">
          <article><em>01</em><i><Upload aria-hidden="true" /></i><h3>Upload your project</h3><p>Choose a local React folder, paste TypeScript source, or import a public repository. No repository connection required.</p></article>
          <article><em>02</em><i><Search aria-hidden="true" /></i><h3>Atlas reads the source</h3><p>Static analysis resolves imports, props, hooks, routes, events, and API dependencies.</p></article>
          <article><em>03</em><i><Network aria-hidden="true" /></i><h3>Explore the system</h3><p>Navigate the graph, follow execution steps, and jump directly to the exact lines that matter.</p></article>
        </div>
      </section>

      <section className="landing-private landing-reveal" id="security"><span className="private-check"><ShieldCheck aria-hidden="true" /></span><div className="private-copy"><span>BUILT FOR PRIVATE CODE</span><h2>Understand the project, without running it.</h2><p>Component Atlas uses static analysis. It never executes your application, calls its APIs, or installs project dependencies.</p></div><ul><li><Check aria-hidden="true" /> No runtime execution</li><li><Check aria-hidden="true" /> No dependency installation</li><li><Check aria-hidden="true" /> Source stays in your workspace</li></ul></section>

      <section className="landing-final-cta landing-reveal"><span>READY WHEN YOU ARE</span><h2>Make the unfamiliar feel obvious.</h2><p>Upload your React project and get a clear map in minutes.</p><button disabled={authLoading} title={authUser ? "Upload your React project" : "Sign in to upload a project"} onClick={requestLandingImport}>{authUser ? <><Upload className="upload-icon" aria-hidden="true" /> Upload your project <ArrowRight aria-hidden="true" /></> : <><LogIn className="upload-icon" aria-hidden="true" /> Sign in to upload <ArrowRight aria-hidden="true" /></>}</button></section>
      <footer className="landing-footer landing-reveal"><a className="landing-brand" href="#top"><img className="logo" src="/component-atlas-logo.png" alt="" /><strong>Component Atlas</strong></a><p>Visual understanding for modern React projects.</p></footer>

      {(modal === "import" || modal === "paste" || modal === "github" || modal === "unsupported" || modal === "duplicate" || modal === "analysis") && <div className="modal-backdrop" role="presentation" onMouseDown={() => modal === "duplicate" ? dismissDuplicateProject() : modal !== "analysis" && setModal(null)}><section className={`modal-card ${modal === "import" ? "import-modal" : ""} ${modal === "duplicate" ? "duplicate-modal" : ""} ${modal === "analysis" ? "analysis-modal" : ""}`} role="dialog" aria-modal="true" aria-label={`${modal} dialog`} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close dialog" onClick={modal === "analysis" ? cancelProjectAnalysis : modal === "duplicate" ? dismissDuplicateProject : () => setModal(null)}>×</button>
        {modal === "import" && <div className="import-dialog"><header><img className="logo" src="/component-atlas-logo.png" alt="" /><strong>Component Atlas</strong></header><div className="import-dialog-body"><div className="import-visual" aria-hidden="true"><i><Boxes /></i><i><Code2 /></i><i><Workflow /></i></div><span className="import-kicker">START EXPLORING</span><h2>Map a React codebase</h2><p>Import a local project, paste source code, or connect a public repository. Atlas analyzes it statically—your code is never executed.</p><div className="import-choices"><button onClick={() => fileInputRef.current?.click()}><i><FolderOpen aria-hidden="true" /></i><span><b>Upload folder</b><small>Select a React project from your device</small></span><ArrowRight aria-hidden="true" /></button><button onClick={() => openPasteDialog("new")}><i><Code2 aria-hidden="true" /></i><span><b>Paste code</b><small>Create a new project from a component or small code sample</small></span><ArrowRight aria-hidden="true" /></button><button onClick={() => setModal("github")}><i><GitFork aria-hidden="true" /></i><span><b>Import repository</b><small>Connect a public GitHub repository</small></span><ArrowRight aria-hidden="true" /></button></div><small className="import-privacy"><Check aria-hidden="true" /> Static analysis only · Runs securely in your workspace</small></div></div>}
        {pasteContent}
        {modal === "github" && <><h2>Import from GitHub</h2><p>Enter a public React repository URL. Component Atlas will load its JavaScript and TypeScript source tree.</p><input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/owner/repository" /><button className="primary-action" onClick={importGithub}>Import repository</button></>}
        {modal === "unsupported" && <div className="unsupported-project"><span className="unsupported-icon">!</span><h2>Project type not supported yet</h2><p><strong>{unsupportedProject.name}</strong> appears to be a <b>{unsupportedProject.type}</b> project. Component Atlas currently analyzes React projects written in JavaScript or TypeScript.</p><div className="supported-formats"><b>Supported project files</b><span>.js</span><span>.jsx</span><span>.ts</span><span>.tsx</span></div><button className="primary-action" onClick={() => setModal(null)}>Choose another project</button></div>}
        {duplicateContent}
        {analysisContent}
      </section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );

  return (
    <main key="workspace" data-app-view="workspace" className={`app-shell ${theme === "light" ? "light-theme" : ""}`} onClick={() => menu && setMenu(null)}>
      <section className="mobile-dashboard-blocker" role="status">
        <div className="mobile-blocker-brand"><img className="logo" src="/component-atlas-logo.png" alt="" /><strong>Component Atlas</strong></div>
        <span className="mobile-blocker-icon"><Monitor aria-hidden="true" /></span>
        <div className="analysis-kicker">DESKTOP WORKSPACE</div>
        <h1>Please open Component Atlas on a desktop</h1>
        <p>The interactive graph, source viewer, and resizable inspector need a larger screen for the best experience.</p>
        <button onClick={() => window.location.assign("/")}>Back to home</button>
        <small>Your imported project will remain available during this session.</small>
      </section>
      <header className="app-header">
        <div className="product"><img className="logo" src="/component-atlas-logo.png" alt="" /><strong>Component Atlas</strong></div>
        <button className="dashboard-home control-button" title="Back to Component Atlas home" onClick={() => window.location.assign("/")}><Home aria-hidden="true" /> Back to home</button>
        <div className="menu-wrap"><button className="project control-button" aria-haspopup="menu" aria-expanded={menu === "project"} onClick={(event) => { event.stopPropagation(); setMenu(menu === "project" ? null : "project"); }}><Boxes aria-hidden="true" /><b>{projectName}</b><ChevronDown aria-hidden="true" /></button>{menu === "project" && <div className="popover project-menu" role="menu" onClick={(event) => event.stopPropagation()}><strong>Projects · Newest first</strong>{projects.length ? [...projects].reverse().map((project) => <div className={`project-menu-item ${project.id === activeProjectId ? "active-project" : ""}`} role="none" key={project.id}><button className="project-menu-open" role="menuitem" onClick={() => activateProject(project)}><span className="project-menu-name"><i>{project.id === activeProjectId ? <Check aria-hidden="true" /> : <Boxes aria-hidden="true" />}</i>{project.name}</span><small>{project.files.length} source files</small></button><button className="project-menu-remove" role="menuitem" aria-label={`Remove ${project.name}`} title={`Remove ${project.name}`} onClick={() => requestProjectRemoval(project)}><Trash2 aria-hidden="true" /></button></div>) : <p>No imported projects yet</p>}</div>}</div>
        <span className="react-badge"><Atom aria-hidden="true" /> React</span>
        {activeAnalysisProject && activeAnalysisProject.files.length > 0 && activeProjectAnalyzedAt && <span className="analysis" title={`Analyzed ${new Date(activeProjectAnalyzedAt).toLocaleString()}`}><i /><b>{activeAnalysisProject.name}</b> analyzed <small>{formatAnalysisAge(activeProjectAnalyzedAt, relativeTimeNow)}</small></span>}
        <div className="header-spacer" />
        <div className="search-wrap" onClick={(event) => event.stopPropagation()}>
          <label className="search" title="Search saved projects (Command K on Mac, Control K on Windows/Linux)"><Search aria-hidden="true" /><input ref={headerSearchRef} aria-label="Search saved projects" value={projectQuery} onFocus={() => setMenu("projectSearch")} onChange={(event) => { setProjectQuery(event.target.value); setMenu("projectSearch"); }} onKeyDown={(event) => { if (event.key === "Enter" && projectSearchResults[0]) { activateProject(projectSearchResults[0]); setProjectQuery(""); } }} placeholder="Search projects" /><kbd>⌘ K / Ctrl K</kbd></label>
          {menu === "projectSearch" && <div className="popover project-search-menu" role="listbox" aria-label="Matching projects"><strong>{projectQuery.trim() ? "Matching projects" : "Recent projects"}</strong>{projectSearchResults.length ? projectSearchResults.map((project) => <button className={project.id === activeProjectId ? "active-project" : ""} role="option" aria-selected={project.id === activeProjectId} key={project.id} onClick={() => { activateProject(project); setProjectQuery(""); }}><span><i>{project.id === activeProjectId ? <Check aria-hidden="true" /> : <Boxes aria-hidden="true" />}</i><b>{project.name}</b></span><small>{project.files.length} source files</small></button>) : <p>{projects.length ? "No project names match your search." : "No saved projects yet."}</p>}</div>}
        </div>
        <button className="icon-button" aria-label="Toggle theme" title="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button>
        <button className="icon-button" aria-label="Open settings" title="Settings" onClick={() => setModal("settings")}><Settings aria-hidden="true" /></button>
        {authLoading ? <span className="avatar">…</span> : authUser ? <div className="menu-wrap"><button className="avatar account-avatar" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded={menu === "account"} onClick={(event) => { event.stopPropagation(); setMenu(menu === "account" ? null : "account"); }}>{authInitials}</button>{menu === "account" && <div className="popover account-menu" role="menu" onClick={(event) => event.stopPropagation()}><strong>{authUser.displayName}</strong><span>{authUser.email}</span><a href="/login?signout=1&return_to=%2F"><LogOut aria-hidden="true" /> Log out</a></div>}</div> : <a className="header-sign-in" href="/login?return_to=%2F"><LogIn aria-hidden="true" /> Sign in</a>}
      </header>

      <section className="studio" style={{ gridTemplateColumns: `${explorerCollapsed ? 48 : explorerWidth}px minmax(620px, 1fr) ${inspectorCollapsed ? 48 : inspectorWidth}px` }}>
        <aside className={`explorer ${explorerCollapsed ? "panel-collapsed" : ""}`}>
          <div className="section-label"><span className="panel-title">PROJECT EXPLORER</span><button className="panel-toggle" type="button" aria-label={explorerCollapsed ? "Expand project explorer" : "Collapse project explorer"} title={explorerCollapsed ? "Expand project explorer" : "Collapse project explorer"} aria-expanded={!explorerCollapsed} onClick={() => setExplorerCollapsed((current) => !current)}>{explorerCollapsed ? <PanelRight aria-hidden="true" /> : <PanelLeft aria-hidden="true" />}</button></div>
          <button className="import-button" title="Import project (Command I on Mac, Control I on Windows/Linux)" onClick={() => fileInputRef.current?.click()}><Upload aria-hidden="true" /><b>Import project</b><span>⌘ I / Ctrl I</span></button>
          <input ref={fileInputRef} className="hidden-input" type="file" multiple onChange={handleFiles} {...({ webkitdirectory: "" } as { webkitdirectory: string })} />
          <div className="import-options">
            <button onClick={() => fileInputRef.current?.click()}><FolderOpen aria-hidden="true" /><small>Upload folder</small></button>
            <button onClick={() => openPasteDialog("current")}><Code2 aria-hidden="true" /><small>Paste code</small></button>
            <button onClick={() => setModal("github")}><GitFork aria-hidden="true" /><small>GitHub</small></button>
          </div>
          <div className="support-notice"><b>React projects only</b><span>Source, styles, data and small assets</span></div>
          <label className="file-search" title="Focus file search (Option F on Mac, Alt F on Windows/Linux)"><Search aria-hidden="true" /><input ref={fileSearchRef} value={fileQuery} onChange={(event) => setFileQuery(event.target.value)} placeholder="Search files…" /><kbd>⌥ F / Alt F</kbd></label>
          <div className="file-view-selector menu-wrap" onClick={(event) => event.stopPropagation()}><button className={menu === "fileView" ? "active" : ""} aria-haspopup="menu" aria-expanded={menu === "fileView"} onClick={() => setMenu(menu === "fileView" ? null : "fileView")}><span>{fileTabIcon(fileTab)}<b>{fileTab}</b></span><em>{fileTabCounts[fileTab]}</em><ChevronDown aria-hidden="true" /></button>{menu === "fileView" && <div className="popover file-view-menu" role="menu" aria-label="Choose project file category">{FILE_TABS.map((tab) => <button className={fileTab === tab ? "selected" : ""} role="menuitemradio" aria-checked={fileTab === tab} key={tab} onClick={() => { setFileTab(tab); setMenu(null); }}><span>{fileTabIcon(tab)}<b>{tab}</b></span><small>{fileTabCounts[tab]}</small>{fileTab === tab ? <Check aria-hidden="true" /> : null}</button>)}</div>}</div>
          <div className="file-tree"><div className="folder"><ChevronDown aria-hidden="true" /><FolderOpen aria-hidden="true" /><b>Project</b><span>{filteredFiles.length}</span></div>{fileTreeRows}{!filteredFiles.length && <p className="empty-state">No matching files</p>}</div>
          <div className="explorer-footer"><i /> {projectFiles.length} files available <button aria-label="Explorer options" onClick={() => notify("Explorer is up to date")}><Ellipsis aria-hidden="true" /></button></div>
          <div className="resize-handle resize-right" role="separator" aria-label="Resize project explorer" aria-orientation="vertical" onPointerDown={(event) => beginResize("explorer", event)} />
        </aside>

        <section className="canvas-column" ref={canvasColumnRef} style={{ gridTemplateRows: `56px minmax(0, 1fr) ${codeHeight}px` }}>
          <div className="canvas-toolbar">
            <button className={graphMode === "graph" ? "active" : ""} onClick={() => setGraphMode("graph")}><Network aria-hidden="true" /> Component graph</button>
            <button className={graphMode === "flow" ? "active" : ""} onClick={() => setGraphMode("flow")}><Workflow aria-hidden="true" /> Execution flow</button>
            <small>{graphLayout.nodes.length} nodes · {visibleEdges.length} direct relationships</small><span />
            {showNodeSearch ? <input ref={nodeSearchRef} className="node-search" value={nodeQuery} onChange={(event) => findNode(event.target.value)} onBlur={() => !nodeQuery && setShowNodeSearch(false)} placeholder="Type a node name…" /> : <button onClick={() => setShowNodeSearch(true)}><Search aria-hidden="true" /> Find node</button>}
            <div className="menu-wrap">
              <button className={`filter-trigger ${menu === "filter" ? "active" : ""}`} aria-haspopup="menu" aria-expanded={menu === "filter"} onClick={(event) => { event.stopPropagation(); setMenu(menu === "filter" ? null : "filter"); }}><Filter aria-hidden="true" /> Filter <span className="filter-count">{Object.values(enabledKinds).filter(Boolean).length}</span></button>
              {menu === "filter" && <div className="popover filter-menu" role="menu" aria-label="Graph node filters" onClick={(event) => event.stopPropagation()}>
                <div className="filter-menu-header"><div><b>Graph filters</b><small>Choose which nodes appear</small></div><span>{Object.values(enabledKinds).filter(Boolean).length} of 5</span></div>
                <div className="filter-options">{(Object.keys(enabledKinds) as NodeKind[]).map((kind) => <label className={enabledKinds[kind] ? "is-checked" : ""} key={kind}>
                  <input className="filter-checkbox" type="checkbox" checked={enabledKinds[kind]} onChange={() => setEnabledKinds((current) => ({ ...current, [kind]: !current[kind] }))} />
                  <span className="filter-check" aria-hidden="true">{enabledKinds[kind] && <Check />}</span>
                  <span className={`filter-kind-icon filter-kind-${kind.toLowerCase()}`}>{nodeKindIcon(kind)}</span>
                  <span className="filter-copy"><b>{kind}s</b><small>{nodeKindDescription[kind]}</small></span>
                </label>)}</div>
                <button className="filter-reset" onClick={() => setEnabledKinds({ Page: true, Component: true, Hook: true, Service: true, Utility: true })}><RotateCcw aria-hidden="true" /> Show all node types</button>
              </div>}
            </div>
            <div className="menu-wrap"><button className="toolbar-icon-button" aria-label="More graph options" onClick={(event) => { event.stopPropagation(); setMenu(menu === "more" ? null : "more"); }}><Ellipsis aria-hidden="true" /></button>{menu === "more" && <div className="popover more-menu" onClick={(event) => event.stopPropagation()}><button onClick={() => { setZoom(1); setGraphPan({ x: 0, y: 0 }); if (projectNodes[0]) setSelected(projectNodes[0].id); setMenu(null); notify("Graph position and zoom reset"); }}>Reset graph view</button><button onClick={() => { setShowMinimap(!showMinimap); setMenu(null); }}>Toggle minimap</button></div>}</div>
          </div>
          <div className={`graph-canvas ${graphMode === "flow" ? "flow-mode" : ""} ${focusedNodeId ? "focused-graph" : ""}`}>
            <div className="graph-grid" />
            <div className="graph-scroll-area" ref={graphScrollRef} aria-label="Infinite draggable component graph canvas" onWheel={handleGraphWheel} onPointerDown={beginGraphPan} onPointerMove={moveGraphPan} onPointerUp={endGraphPan} onPointerCancel={endGraphPan}>
              <div className="graph-scene dynamic-graph" style={{ width: `${graphLayout.width}px`, height: `${graphLayout.height}px`, transform: `translate(${graphPan.x}px, ${graphPan.y}px) scale(${zoom})` }}>
                {visibleEdges.map((edge) => <div className={`dynamic-edge ${edge.dashed ? "dashed" : ""}`} key={`${edge.from}-${edge.to}`} style={{ left: edge.x, top: edge.y, width: edge.width, transform: `rotate(${edge.angle}deg)` }} />)}
                {graphLayout.nodes.map((node) => <button key={node.id} onClick={() => selectNode(node.id)} style={{ left: graphLayout.positions[node.id].x, top: graphLayout.positions[node.id].y }} className={`graph-node ${selected === node.id ? "selected" : ""} ${focusedNodeId && !connectedNodeIds.has(node.id) ? "unrelated" : ""}`}><span className={`node-icon ${node.tone}`}>{nodeKindIcon(node.kind)}</span><b>{node.name}</b><small>{node.file}</small><em>{node.meta}</em></button>)}
              </div>
            </div>
            <div className="zoom-controls"><button aria-label="Zoom out" title="Zoom out" onClick={() => setZoom((value) => Math.max(.35, +(value - .1).toFixed(2)))}><Minus aria-hidden="true" /></button><small>{Math.round(zoom * 100)}%</small><button aria-label="Zoom in" title="Zoom in" onClick={() => setZoom((value) => Math.min(2.5, +(value + .1).toFixed(2)))}><Plus aria-hidden="true" /></button><button className="fit-view" aria-label="Fit graph to canvas" title="Fit the entire graph inside the canvas" onClick={() => { setZoom(graphLayout.width > 1200 ? .7 : 1); setGraphPan({ x: 0, y: 0 }); }}><Maximize2 aria-hidden="true" /> Fit graph</button><button className="reset-view" aria-label="Reset graph position and zoom" title="Return the canvas to its original position" onClick={() => { setZoom(1); setGraphPan({ x: 0, y: 0 }); if (projectNodes[0]) setSelected(projectNodes[0].id); notify("Graph position and zoom reset"); }}><RotateCcw aria-hidden="true" /> Reset view</button></div>
            <div className="graph-legend"><span>━ Import / render</span><span className="mint-text">━ Data flow</span><span className="purple-text">┄ Callback</span><span>┈ API</span></div>
            {showMinimap && <button className="minimap" aria-label="Navigate component graph" title="Click or drag to navigate the graph" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); navigateFromMinimap(event); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) navigateFromMinimap(event); }}>
              {graphLayout.nodes.map((node) => <span className={`minimap-node ${node.tone}`} key={node.id} style={{ left: `${graphLayout.positions[node.id].x / graphLayout.width * 100}%`, top: `${graphLayout.positions[node.id].y / graphLayout.height * 100}%` }} />)}
              <span className="minimap-viewport" style={{ left: `${minimapViewport.left}%`, top: `${minimapViewport.top}%`, width: `${minimapViewport.width}%`, height: `${minimapViewport.height}%` }} />
            </button>}
          </div>
          <div className="code-preview"><div className="resize-handle resize-top" role="separator" aria-label="Resize code panel" aria-orientation="horizontal" onPointerDown={(event) => beginResize("code", event)} /><div className="code-tabs"><div className="code-tab-strip" ref={codeTabsRef} role="tablist" aria-label="Open project files">{openFiles.map((file) => { const issueCount = projectDetails[file]?.insights?.diagnostics?.length ?? 0; return <div className={`code-tab ${activeFile === file ? "active" : ""}`} data-code-file={file} key={file}><button className="code-tab-select" role="tab" aria-selected={activeFile === file} title={file} onClick={() => openProjectFile(file)}>{fileIcon(file)} <span>{file.split("/").at(-1)}</span>{issueCount > 0 ? <i className="code-tab-issues" title={`${issueCount} analysis issue${issueCount === 1 ? "" : "s"}`}>{issueCount}</i> : activeFile === file ? <i>●</i> : null}</button><button className="code-tab-close" aria-label={`Close ${file.split("/").at(-1)}`} title="Close tab" onClick={() => closeCodeFile(file)}><X aria-hidden="true" /></button></div>; })}</div></div>{activeIsImage ? <div className="asset-preview"><img src={activeSource} alt={`Preview of ${activeFile}`} /><span><b>{activeFile.split("/").at(-1)}</b><small>{sourceExtension(activeFile).toUpperCase()} image asset</small></span></div> : activeIsBinaryAsset ? <div className="asset-preview binary-asset-preview">{fileIcon(activeFile)}<span><b>{activeFile.split("/").at(-1)}</b><small>{sourceExtension(activeFile).toUpperCase()} binary asset · Preview unavailable</small></span></div> : <pre ref={codePreviewRef} data-file-category={activeFileCategory}><HighlightedCode source={activeSource} highlightedLine={highlightedLocation?.file === activeFile ? highlightedLocation.line : 0} highlightedEndLine={highlightedLocation?.file === activeFile ? highlightedLocation.endLine : 0} /></pre>}</div>
        </section>

        <aside className={`inspector ${inspectorCollapsed ? "panel-collapsed" : ""}`}>
          <div className="resize-handle resize-left" role="separator" aria-label="Resize flow inspector" aria-orientation="vertical" onPointerDown={(event) => beginResize("inspector", event)} />
          <div className="section-label"><span className="panel-title">FLOW INSPECTOR</span><mark>Selected</mark><button className="panel-toggle" type="button" aria-label={inspectorCollapsed ? "Expand flow inspector" : "Collapse flow inspector"} title={inspectorCollapsed ? "Expand flow inspector" : "Collapse flow inspector"} aria-expanded={!inspectorCollapsed} onClick={() => setInspectorCollapsed((current) => !current)}>{inspectorCollapsed ? <PanelLeft aria-hidden="true" /> : <PanelRight aria-hidden="true" />}</button></div>
          <div className="component-title"><span className={`node-icon ${kindStyle(selectedDetail.type)[1]}`}>{nodeKindIcon(selectedDetail.type)}</span><div><h2>{selectedName} <small>{selectedDetail.type}</small></h2><p>{selectedDetail.file}</p></div></div>
          <div className="inspector-tabs">{(["Overview", "Relations", "Source"] as InspectorTab[]).map((tab) => <button className={inspectorTab === tab ? "active" : ""} key={tab} onClick={() => setInspectorTab(tab)}>{tab}</button>)}</div>
          {inspectorTab === "Overview" && <><div className="metric-grid">{selectedDetail.metrics.map((metric) => { const [number = "0"] = metric.match(/\d+/) ?? []; return <div key={metric}>{metric.replace(number, "")} <b>{number}</b><small>{metric}</small></div>; })}</div><div className="inspector-insight-summary" aria-label="Analysis summary">{selectedInsights.framework.length > 0 && <span className="framework-insight">{selectedInsights.framework[0]}</span>}{selectedInsights.props.length > 0 && <span>{selectedInsights.props.length} props</span>}{selectedInsights.hooks.length > 0 && <span>{selectedInsights.hooks.length} hooks</span>}{selectedInsights.exports.length > 0 && <span>{selectedInsights.exports.length} exports</span>}{(selectedInsights.bundler?.length ?? 0) > 0 && <span>{selectedInsights.bundler?.length} build links</span>}{selectedInsights.diagnostics.length > 0 && <span className="diagnostic-insight">{selectedInsights.diagnostics.length} issues</span>}</div><h3>HOW THIS FILE WORKS</h3><p className="steps-note">{(selectedDetail.explanations ?? []).length || selectedDetail.steps.length} steps · Select a step to highlight its source range</p><ol className="steps">{(selectedDetail.explanations ?? selectedDetail.steps.map((text) => ({ text, line: 1, endLine: 1, kind: "analysis" }))).map((step, index) => { const endLine = step.endLine ?? inferExplanationEndLine(selectedDetail.source, step.line, step.kind); const isActive = index === activeStep; const hasIssue = step.kind === "diagnostic"; return <li className={`${isActive ? "active " : ""}${hasIssue ? "has-issue" : ""}`} key={`${step.kind}-${step.line}-${endLine}-${step.text}`}><button type="button" aria-pressed={isActive} aria-label={`${hasIssue ? "Issue: " : ""}${step.text} ${lineRangeLabel(step.line, endLine)}`} onClick={() => { setActiveStep(index); jumpToCodeLocation(selectedDetail.file, step.line, endLine); }}><span>{hasIssue ? "!" : index + 1}</span><p>{step.text}<small>{selectedDetail.file} · {lineRangeLabel(step.line, endLine)}</small></p><b><ChevronRight aria-hidden="true" /></b></button></li>; })}</ol></>}
          {inspectorTab === "Relations" && <div className="tab-panel"><h3>RELATIONSHIPS</h3><div className="relation"><span>Used by</span><b><Route aria-hidden="true" /> {selectedDetail.parent}</b></div><div className="relation"><span>Depends on</span><b><Boxes aria-hidden="true" /> {selectedDetail.children}</b></div><div className="relation resource-list"><span>Resources</span><div>{selectedDetail.relations?.resources?.length ? selectedDetail.relations.resources.map((file) => <button title={file} key={file} onClick={() => openProjectFile(file)}>{fileIcon(file)} {file.split("/").at(-1)}</button>) : <small>None</small>}</div></div><p className="panel-copy">Code relationships and resources are derived from local imports. Resources stay out of the main graph to keep it readable.</p></div>}
          {inspectorTab === "Source" && <div className="source-panel"><div><span>{selectedDetail.file}</span><button onClick={() => navigator.clipboard?.writeText(selectedDetail.source).then(() => notify("Source copied"))}>Copy</button></div><pre><HighlightedCode source={selectedDetail.source} /></pre></div>}
        </aside>
      </section>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={() => modal === "duplicate" ? dismissDuplicateProject() : modal === "remove" ? dismissProjectRemoval() : modal !== "analysis" && setModal(null)}><section className={`modal-card ${modal === "report" ? "report-modal" : ""} ${modal === "duplicate" ? "duplicate-modal" : ""} ${modal === "remove" ? "remove-project-modal" : ""} ${modal === "analysis" ? "analysis-modal" : ""} ${modal === "settings" ? "settings-modal" : ""}`} role="dialog" aria-modal="true" aria-label={`${modal} dialog`} onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close dialog" onClick={modal === "analysis" ? cancelProjectAnalysis : modal === "duplicate" ? dismissDuplicateProject : modal === "remove" ? dismissProjectRemoval : () => setModal(null)}>×</button>
        {pasteContent}
        {modal === "github" && <><h2>Import from GitHub</h2><p>Enter a public repository URL. Component Atlas will load its JavaScript and TypeScript file tree.</p><input value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/owner/repository" /><button className="primary-action" onClick={importGithub}>Import repository</button></>}
        {modal === "settings" && <div className="settings-dialog">
          <header className="settings-heading"><span><Settings aria-hidden="true" /></span><div><small>WORKSPACE PREFERENCES</small><h2>Workspace settings</h2><p>Personalize your graph and interface without changing project data.</p></div></header>
          <div className="settings-list">
            <label className="setting-row"><span className="setting-icon setting-icon-graph"><Network aria-hidden="true" /></span><span className="setting-copy"><b>Graph minimap</b><small>Show an overview for faster canvas navigation.</small></span><input className="setting-toggle-input" type="checkbox" checked={showMinimap} onChange={() => setShowMinimap(!showMinimap)} /><span className="setting-toggle" aria-hidden="true"><i /></span></label>
            <label className="setting-row"><span className="setting-icon setting-icon-theme">{theme === "light" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</span><span className="setting-copy"><b>Light interface</b><small>Use a brighter theme across the workspace.</small></span><input className="setting-toggle-input" type="checkbox" checked={theme === "light"} onChange={() => setTheme(theme === "dark" ? "light" : "dark")} /><span className="setting-toggle" aria-hidden="true"><i /></span></label>
          </div>
          <div className="settings-footer"><span>Preferences are saved automatically.</span><button className="primary-action" onClick={() => setModal(null)}><Check aria-hidden="true" /> Done</button></div>
        </div>}
        {modal === "unsupported" && <div className="unsupported-project"><span className="unsupported-icon">!</span><h2>Project type not supported yet</h2><p><strong>{unsupportedProject.name}</strong> appears to be a <b>{unsupportedProject.type}</b> project. Component Atlas currently analyzes React projects written in JavaScript or TypeScript.</p><div className="supported-formats"><b>Supported project files</b><span>.js</span><span>.jsx</span><span>.ts</span><span>.tsx</span></div><button className="primary-action" onClick={() => setModal(null)}>Choose another project</button></div>}
        {modal === "remove" && projectToRemove && <div className="remove-project-dialog"><span className="remove-project-icon"><Trash2 aria-hidden="true" /></span><small>REMOVE PROJECT</small><h2>Remove {projectToRemove.name}?</h2><p>This removes the project and its analyzed source from your saved workspace on this device. Your original project files will not be changed.</p><div className="remove-project-summary"><Boxes aria-hidden="true" /><span><b>{projectToRemove.name}</b><small>{projectToRemove.files.length} source files</small></span></div><div className="remove-project-actions"><button onClick={dismissProjectRemoval}>Keep project</button><button onClick={confirmProjectRemoval}><Trash2 aria-hidden="true" /> Remove project</button></div></div>}
        {duplicateContent}
        {analysisContent}
        {modal === "report" && <><h2>Import report</h2><p><strong>{reportLabel}</strong> was reviewed before building the component graph.</p><div className="import-stats"><div><b>{reportIncludedCount}</b><span>Source files included</span></div><div><b>{ignoredFiles.length}</b><span>Files ignored</span></div></div>{ignoredGroups.length ? <div className="ignored-report">{ignoredGroups.map(([reason, paths], index) => { const isOpen = openIgnoredGroup === reason; const panelId = `ignored-files-${index}`; return <section className="ignored-group" data-open={isOpen || undefined} key={reason}><button className="ignored-group-toggle" type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpenIgnoredGroup(isOpen ? null : reason)}><span className="ignored-group-chevron"><ChevronRight aria-hidden="true" /></span><span className="ignored-group-reason">{reason}</span><mark>{paths.length} {paths.length === 1 ? "file" : "files"}</mark></button>{isOpen && <ul id={panelId}>{paths.map((path) => <li key={path}>{path}</li>)}</ul>}</section>; })}</div> : <div className="no-ignored-files">✓ No files were ignored. Every selected file was relevant application source.</div>}<button className="primary-action" onClick={() => setModal(null)}>Continue to project</button></>}
      </section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

export default function LandingPage() {
  return <ComponentAtlas initialView="landing" />;
}
