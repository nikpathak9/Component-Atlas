import { parse, type ParserPlugin } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

type Traverse = typeof traverse;
const traverseAst = ((traverse as unknown as { default?: Traverse }).default ?? traverse) as Traverse;

export type NodeKind = "Page" | "Component" | "Hook" | "Service" | "Utility";

export type AnalyzerNode = {
  id: string;
  name: string;
  file: string;
  kind: NodeKind;
  icon: string;
  tone: string;
  meta: string;
};

export type AnalyzerEdge = { from: string; to: string; dashed?: boolean };

export type AnalyzerDetail = {
  name?: string;
  file: string;
  type: NodeKind;
  parent: string;
  children: string;
  metrics: string[];
  steps: string[];
  explanations: Array<{ text: string; line: number; endLine: number; kind: "declaration" | "import" | "render" | "hook" | "props" | "state" | "effect" | "event" | "api" | "resource" | "export" | "diagnostic" }>;
  source: string;
  relations: { usedBy: string[]; dependsOn: string[]; resources: string[] };
  insights: { props: string[]; hooks: string[]; exports: string[]; diagnostics: AnalyzerIssue[]; bundler: string[]; framework: string[] };
};

export type AnalyzerIssue = {
  title: string;
  file: string;
  line: number;
  column?: number;
  detail: string;
  source?: "parser" | "ast" | "typescript" | "eslint";
  severity?: "error" | "warning" | "info";
  ruleId?: string;
};

export type AnalysisResult = {
  nodes: AnalyzerNode[];
  edges: AnalyzerEdge[];
  details: Record<string, AnalyzerDetail>;
  issues: AnalyzerIssue[];
};

export type AnalyzerProgress = {
  stage: 1 | 2 | 3 | 4;
  components?: number;
  imports?: number;
};

type FileFacts = {
  file: string;
  source: string;
  name: string;
  imports: Array<{ specifier: string; line: number; endLine: number; lazy?: boolean }>;
  assets: Set<string>;
  hooks: Set<string>;
  hookRanges: Map<string, { line: number; endLine: number }>;
  renderedComponents: Set<string>;
  renderRanges: Map<string, { line: number; endLine: number }>;
  propNames: Set<string>;
  stateCount: number;
  effectCount: number;
  eventCount: number;
  apiCount: number;
  stateLine: number;
  effectLine: number;
  eventLine: number;
  apiLine: number;
  stateEndLine: number;
  effectEndLine: number;
  eventEndLine: number;
  apiEndLine: number;
  declarationLine: number;
  declarationEndLine: number;
  jsxLine: number;
  jsxEndLine: number;
  hasJsx: boolean;
  issues: AnalyzerIssue[];
};

const SOURCE_FILE_PATTERN = /\.(tsx?|jsx?)$/i;
const SOURCE_EXTENSION_PATTERN = /\.(tsx?|jsx?)$/i;
const TOOL_CONFIG_PATTERN = /(^|\/)(vite|webpack|rollup|next|astro|remix|babel|eslint)\.config\.[cm]?[jt]s$/i;

const kindStyle = (kind: NodeKind) => kind === "Page" ? ["⌁", "amber"] : kind === "Hook" ? ["∪", "purple"] : kind === "Service" ? ["◇", "mint"] : kind === "Utility" ? ["</>", "slate"] : ["▦", "blue"];

function normalizePath(path: string) {
  const normalized: string[] = [];
  path.replace(/\\/g, "/").split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  });
  return normalized.join("/");
}

export function resolveLocalImport(fromFile: string, specifier: string, files: string[], aliases: Record<string, string> = {}) {
  const configuredAlias = Object.keys(aliases).sort((left, right) => right.length - left.length).find((alias) => specifier === alias || specifier.startsWith(`${alias}/`));
  const configuredPath = configuredAlias ? `${aliases[configuredAlias]}${specifier.slice(configuredAlias.length)}` : "";
  const explicitRoot = specifier.startsWith("/");
  const aliasPath = configuredPath || (specifier.startsWith("@/") || specifier.startsWith("~/") ? specifier.slice(2) : specifier.startsWith("src/") ? specifier : explicitRoot ? specifier.slice(1) : "");
  if (!specifier.startsWith(".") && !aliasPath) return "";
  const fromDirectory = fromFile.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
  const base = normalizePath(aliasPath || `${fromDirectory}/${specifier}`);
  const bases = explicitRoot ? [base, `public/${base}`] : aliasPath && !base.startsWith("src/") ? [base, `src/${base}`] : [base];
  const candidates = new Set<string>();
  bases.forEach((candidate) => {
    candidates.add(candidate);
    if (!SOURCE_EXTENSION_PATTERN.test(candidate)) {
      [".tsx", ".jsx", ".ts", ".js"].forEach((extension) => {
        candidates.add(`${candidate}${extension}`);
        candidates.add(`${candidate}/index${extension}`);
      });
    }
  });
  return files.find((file) => candidates.has(normalizePath(file))) ?? "";
}

function parserPlugins(file: string): ParserPlugin[] {
  const plugins: ParserPlugin[] = ["decorators-legacy", "classProperties", "classPrivateProperties", "classPrivateMethods", "dynamicImport", "importMeta", "topLevelAwait"];
  if (/\.[jt]sx$/i.test(file)) plugins.push("jsx");
  if (/\.tsx?$/i.test(file)) plugins.push("typescript");
  return plugins;
}

function declarationName(node: t.Node | null | undefined) {
  if (!node) return "";
  if ((t.isFunctionDeclaration(node) || t.isClassDeclaration(node)) && node.id) return node.id.name;
  if (t.isIdentifier(node)) return node.name;
  if (t.isVariableDeclaration(node)) {
    const identifier = node.declarations.find((declaration) => t.isIdentifier(declaration.id))?.id;
    return t.isIdentifier(identifier) ? identifier.name : "";
  }
  return "";
}

function calleeName(node: t.Expression | t.V8IntrinsicIdentifier | t.Super | null | undefined): string {
  if (!node) return "";
  if (t.isIdentifier(node)) return node.name;
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
    const object = t.isExpression(node.object) ? calleeName(node.object) : "";
    const property = node.computed ? t.isStringLiteral(node.property) ? node.property.value : "" : t.isIdentifier(node.property) ? node.property.name : "";
    return [object, property].filter(Boolean).join(".");
  }
  return "";
}

function addPropsFromPattern(pattern: t.PatternLike | null | undefined, props: Set<string>) {
  if (!pattern || !t.isObjectPattern(pattern)) return;
  pattern.properties.forEach((property) => {
    if (t.isRestElement(property) && t.isIdentifier(property.argument)) props.add(property.argument.name);
    if (!t.isObjectProperty(property)) return;
    if (t.isIdentifier(property.key)) props.add(property.key.name);
    else if (t.isStringLiteral(property.key)) props.add(property.key.value);
  });
}

function displayNameForFile(file: string) {
  const baseName = file.split("/").at(-1)?.replace(SOURCE_EXTENSION_PATTERN, "") ?? file;
  return baseName === "index" ? file.split("/").at(-2) ?? "index" : baseName;
}

function sourceLine(source: string, pattern: RegExp, fallback = 1) {
  const match = pattern.exec(source);
  if (!match || match.index === undefined) return fallback;
  return source.slice(0, match.index).split("\n").length;
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseFile(file: string, source: string): FileFacts {
  const imports: FileFacts["imports"] = [];
  const assets = new Set<string>();
  const hooks = new Set<string>();
  const hookRanges = new Map<string, { line: number; endLine: number }>();
  const renderedComponents = new Set<string>();
  const renderRanges = new Map<string, { line: number; endLine: number }>();
  const propNames = new Set<string>();
  const issues: AnalyzerIssue[] = [];
  const nameCandidates: Array<{ name: string; priority: number; line: number; endLine: number }> = [];
  const reactHookAliases = new Map<string, string>();
  let stateCount = 0;
  let effectCount = 0;
  let eventCount = 0;
  let apiCount = 0;
  let stateLine = 0;
  let effectLine = 0;
  let eventLine = 0;
  let apiLine = 0;
  let stateEndLine = 0;
  let effectEndLine = 0;
  let eventEndLine = 0;
  let apiEndLine = 0;
  let jsxLine = 0;
  let jsxEndLine = 0;
  let hasJsx = false;

  try {
    const ast = parse(source, {
      sourceFilename: file,
      sourceType: "unambiguous",
      plugins: parserPlugins(file),
      errorRecovery: true,
      allowReturnOutsideFunction: true,
      ranges: true,
    });

    const parserErrors = (ast as typeof ast & { errors?: Array<Error & { loc?: { line: number; column: number } }> }).errors ?? [];
    parserErrors.forEach((error) => issues.push({
      title: "Invalid source syntax",
      file,
      line: error.loc?.line ?? 1,
      column: (error.loc?.column ?? 0) + 1,
      detail: error.message.replace(/\s*\(\d+:\d+\)\s*$/, ""),
      source: "parser",
      severity: "error",
    }));

    traverseAst(ast, {
      ImportDeclaration(path) {
        const declaration = path.node;
        const hasRuntimeImport = declaration.specifiers.length === 0 || declaration.specifiers.some((specifier) => !t.isImportSpecifier(specifier) || specifier.importKind !== "type");
        if (declaration.importKind !== "type" && hasRuntimeImport) imports.push({ specifier: declaration.source.value, line: declaration.loc?.start.line ?? 1, endLine: declaration.loc?.end.line ?? declaration.loc?.start.line ?? 1 });
        if (!isSourceSpecifier(declaration.source.value) && (declaration.source.value.startsWith(".") || declaration.source.value.startsWith("/"))) assets.add(declaration.source.value);
        if (declaration.source.value === "react") {
          declaration.specifiers.forEach((specifier) => {
            if (!t.isImportSpecifier(specifier)) return;
            const imported = t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value;
            if (/^use[A-Z]/.test(imported)) reactHookAliases.set(specifier.local.name, imported);
          });
        }
      },
      ExportNamedDeclaration(path) {
        const hasRuntimeExport = path.node.specifiers.length === 0 || path.node.specifiers.some((specifier) => specifier.exportKind !== "type");
        if (path.node.source && path.node.exportKind !== "type" && hasRuntimeExport) imports.push({ specifier: path.node.source.value, line: path.node.loc?.start.line ?? 1, endLine: path.node.loc?.end.line ?? path.node.loc?.start.line ?? 1 });
        const name = declarationName(path.node.declaration);
        if (name) nameCandidates.push({ name, priority: 80, line: path.node.declaration?.loc?.start.line ?? path.node.loc?.start.line ?? 1, endLine: path.node.declaration?.loc?.end.line ?? path.node.loc?.end.line ?? 1 });
      },
      ExportAllDeclaration(path) {
        if (path.node.exportKind !== "type") imports.push({ specifier: path.node.source.value, line: path.node.loc?.start.line ?? 1, endLine: path.node.loc?.end.line ?? path.node.loc?.start.line ?? 1 });
      },
      ExportDefaultDeclaration(path) {
        const name = declarationName(path.node.declaration);
        if (name) nameCandidates.push({ name, priority: 100, line: path.node.declaration.loc?.start.line ?? path.node.loc?.start.line ?? 1, endLine: path.node.declaration.loc?.end.line ?? path.node.loc?.end.line ?? 1 });
      },
      FunctionDeclaration(path) {
        const name = path.node.id?.name;
        if (name) nameCandidates.push({ name, priority: /^[A-Z]|^use[A-Z]/.test(name) ? 65 : 25, line: path.node.loc?.start.line ?? 1, endLine: path.node.loc?.end.line ?? path.node.loc?.start.line ?? 1 });
        addPropsFromPattern(path.node.params[0], propNames);
      },
      ClassDeclaration(path) {
        const name = path.node.id?.name;
        if (name) nameCandidates.push({ name, priority: /^[A-Z]/.test(name) ? 60 : 20, line: path.node.loc?.start.line ?? 1, endLine: path.node.loc?.end.line ?? path.node.loc?.start.line ?? 1 });
      },
      VariableDeclarator(path) {
        if (!t.isIdentifier(path.node.id)) return;
        const initializer = path.node.init;
        if (!t.isArrowFunctionExpression(initializer) && !t.isFunctionExpression(initializer)) return;
        const name = path.node.id.name;
        nameCandidates.push({ name, priority: /^[A-Z]|^use[A-Z]/.test(name) ? 60 : 20, line: path.node.loc?.start.line ?? 1, endLine: path.node.loc?.end.line ?? path.node.loc?.start.line ?? 1 });
        addPropsFromPattern(initializer.params[0], propNames);
      },
      CallExpression(path) {
        if (t.isImport(path.node.callee) && t.isStringLiteral(path.node.arguments[0])) imports.push({ specifier: path.node.arguments[0].value, line: path.node.loc?.start.line ?? 1, endLine: path.node.loc?.end.line ?? path.node.loc?.start.line ?? 1, lazy: true });
        const called = calleeName(path.node.callee);
        if (called === "require" && t.isStringLiteral(path.node.arguments[0])) imports.push({ specifier: path.node.arguments[0].value, line: path.node.loc?.start.line ?? 1, endLine: path.node.loc?.end.line ?? path.node.loc?.start.line ?? 1 });
        const canonicalHook = reactHookAliases.get(called) ?? called.split(".").at(-1) ?? called;
        const line = path.node.loc?.start.line ?? 1;
        const endLine = path.node.loc?.end.line ?? line;
        if (/^use[A-Z]/.test(canonicalHook)) { hooks.add(canonicalHook); if (!hookRanges.has(canonicalHook)) hookRanges.set(canonicalHook, { line, endLine }); }
        if (canonicalHook === "useState" || canonicalHook === "useReducer") { stateCount += 1; if (!stateLine) { stateLine = line; stateEndLine = endLine; } }
        if (["useEffect", "useLayoutEffect", "useInsertionEffect"].includes(canonicalHook)) { effectCount += 1; if (!effectLine) { effectLine = line; effectEndLine = endLine; } }
        if (called === "fetch" || /^axios\.(get|post|put|patch|delete|request)$/.test(called)) { apiCount += 1; if (!apiLine) { apiLine = line; apiEndLine = endLine; } }
      },
      JSXElement(path) {
        hasJsx = true;
        if (!jsxLine) { jsxLine = path.node.loc?.start.line ?? 1; jsxEndLine = path.node.loc?.end.line ?? jsxLine; }
        const nameNode = path.node.openingElement.name;
        if (t.isJSXIdentifier(nameNode) && /^[A-Z]/.test(nameNode.name)) { renderedComponents.add(nameNode.name); if (!renderRanges.has(nameNode.name)) renderRanges.set(nameNode.name, { line: path.node.loc?.start.line ?? 1, endLine: path.node.loc?.end.line ?? path.node.loc?.start.line ?? 1 }); }
        if (t.isJSXMemberExpression(nameNode)) {
          let current: t.JSXIdentifier | t.JSXMemberExpression = nameNode;
          while (t.isJSXMemberExpression(current)) current = current.object;
          if (t.isJSXIdentifier(current) && /^[A-Z]/.test(current.name)) { renderedComponents.add(current.name); if (!renderRanges.has(current.name)) renderRanges.set(current.name, { line: path.node.loc?.start.line ?? 1, endLine: path.node.loc?.end.line ?? path.node.loc?.start.line ?? 1 }); }
        }
      },
      JSXFragment(path) { hasJsx = true; if (!jsxLine) { jsxLine = path.node.loc?.start.line ?? 1; jsxEndLine = path.node.loc?.end.line ?? jsxLine; } },
      JSXAttribute(path) {
        if (!t.isJSXIdentifier(path.node.name)) return;
        if (/^on[A-Z]/.test(path.node.name.name)) { eventCount += 1; if (!eventLine) { eventLine = path.node.loc?.start.line ?? 1; eventEndLine = path.node.loc?.end.line ?? eventLine; } }
        if (/^(src|href|poster)$/i.test(path.node.name.name) && t.isStringLiteral(path.node.value)) assets.add(path.node.value.value);
      },
    });
  } catch (error) {
    const parseError = error as Error & { loc?: { line: number; column: number } };
    issues.push({
      title: error instanceof RangeError ? "AST analysis skipped for file" : "Invalid source syntax",
      file,
      line: parseError.loc?.line ?? 1,
      column: (parseError.loc?.column ?? 0) + 1,
      detail: error instanceof RangeError ? "This file contains syntax nested too deeply for browser analysis. Other project files will still be mapped." : parseError.message.replace(/\s*\(\d+:\d+\)\s*$/, ""),
      source: "parser",
      severity: error instanceof RangeError ? "warning" : "error",
    });
    // A fatal parser error can prevent traversal entirely. Retain only import
    // locations as a recovery path so unresolved dependencies are still useful.
    for (const match of source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g)) {
      const line = source.slice(0, match.index ?? 0).split("\n").length;
      imports.push({ specifier: match[1], line, endLine: line });
    }
  }

  const fallbackName = displayNameForFile(file);
  const selectedDeclaration = nameCandidates.sort((left, right) => right.priority - left.priority)[0];
  const name = selectedDeclaration?.name || fallbackName;
  return { file, source, name, imports, assets, hooks, hookRanges, renderedComponents, renderRanges, propNames, stateCount, effectCount, eventCount, apiCount, stateLine, effectLine, eventLine, apiLine, stateEndLine, effectEndLine, eventEndLine, apiEndLine, declarationLine: selectedDeclaration?.line ?? 1, declarationEndLine: selectedDeclaration?.endLine ?? selectedDeclaration?.line ?? 1, jsxLine, jsxEndLine, hasJsx, issues };
}

function classifyFile(facts: FileFacts): NodeKind {
  const { file, name, source, hooks, stateCount, effectCount, apiCount, hasJsx } = facts;
  if (/(^|\/)hooks?\//i.test(file) || /^use[A-Z]/.test(name)) return "Hook";
  if (/(^|\/)(pages?|routes?|router|screens?|views?)\//i.test(file) || /(^|\/)app\/(?:.*\/)?(page|layout)\.[jt]sx?$/i.test(file) || /^(App|main)$/i.test(name)) return "Page";
  if (/(^|\/)(services?|api)\//i.test(file) || apiCount > 0) return "Service";
  if (/^[A-Z]/.test(name) || hasJsx) return "Component";
  if (hooks.size || stateCount || effectCount || /react/i.test(source)) return "Component";
  return "Utility";
}

function isSourceSpecifier(specifier: string) {
  return !/\.[a-z0-9]+$/i.test(specifier) || SOURCE_EXTENSION_PATTERN.test(specifier);
}

export function analyzeSources(sources: Record<string, string>, aliases: Record<string, string> = {}, bundlerTools: string[] = []): AnalysisResult {
  const files = Object.keys(sources).filter((file) => SOURCE_FILE_PATTERN.test(file) && !/\.d\.ts$/i.test(file) && !TOOL_CONFIG_PATTERN.test(file));
  const allFiles = Object.keys(sources);
  const facts = files.map((file) => parseFile(file, sources[file]));
  const factsByFile = Object.fromEntries(facts.map((entry) => [entry.file, entry]));
  const nodes: AnalyzerNode[] = facts.map((entry) => {
    const kind = classifyFile(entry);
    const [icon, tone] = kindStyle(kind);
    const meta = [
      entry.propNames.size ? `${entry.propNames.size} prop${entry.propNames.size === 1 ? "" : "s"}` : "",
      entry.stateCount ? `${entry.stateCount} state` : "",
      entry.effectCount ? `${entry.effectCount} effect${entry.effectCount === 1 ? "" : "s"}` : "",
      entry.apiCount ? `${entry.apiCount} API` : "",
    ].filter(Boolean).join(" · ") || kind;
    return { id: entry.file, name: entry.name, file: entry.file, kind, icon, tone, meta };
  });

  const issues = facts.flatMap((entry) => entry.issues);
  const edges: AnalyzerEdge[] = [];
  facts.forEach((entry) => {
    entry.imports.forEach(({ specifier, line }) => {
      const local = specifier.startsWith(".") || specifier.startsWith("@/") || specifier.startsWith("~/") || specifier.startsWith("src/") || Object.keys(aliases).some((alias) => specifier === alias || specifier.startsWith(`${alias}/`));
      if (!local || !isSourceSpecifier(specifier)) return;
      const target = resolveLocalImport(entry.file, specifier, files, aliases);
      if (!target) {
        issues.push({ title: "Unresolved import", file: entry.file, line, detail: specifier, source: "ast", severity: "error" });
        return;
      }
      if (target !== entry.file && !edges.some((edge) => edge.from === entry.file && edge.to === target)) {
        edges.push({ from: entry.file, to: target, dashed: classifyFile(factsByFile[target]) === "Hook" });
      }
    });
  });

  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const details: Record<string, AnalyzerDetail> = {};
  nodes.forEach((node) => {
    const entry = factsByFile[node.file];
    const incoming = edges.filter((edge) => edge.to === node.id).map((edge) => nodeById[edge.from]?.name).filter(Boolean);
    const outgoing = edges.filter((edge) => edge.from === node.id).map((edge) => nodeById[edge.to]?.name).filter(Boolean);
    const steps: string[] = [];
    const explanations: AnalyzerDetail["explanations"] = [];
    const explain = (text: string, line: number, kind: AnalyzerDetail["explanations"][number]["kind"], endLine = line) => { steps.push(text); explanations.push({ text, line, endLine: Math.max(line, endLine), kind }); };
    explain(`${node.name} is declared in ${node.file}.`, entry.declarationLine, "declaration", entry.declarationEndLine);
    if (outgoing.length) explain(`It imports or depends on ${outgoing.join(", ")}.`, entry.imports[0]?.line ?? 1, "import", entry.imports[0]?.endLine ?? entry.imports[0]?.line ?? 1);
    if (entry.renderedComponents.size) {
      const firstRendered = Array.from(entry.renderedComponents)[0];
      const range = entry.renderRanges.get(firstRendered);
      explain(`It renders ${Array.from(entry.renderedComponents).join(", ")}.`, range?.line ?? sourceLine(entry.source, new RegExp(`<${escapePattern(firstRendered)}\\b`)), "render", range?.endLine);
    }
    if (entry.hooks.size) {
      const firstHook = Array.from(entry.hooks)[0];
      const range = entry.hookRanges.get(firstHook);
      explain(`It calls ${Array.from(entry.hooks).join(", ")}.`, range?.line ?? sourceLine(entry.source, new RegExp(`\\b${escapePattern(firstHook)}\\s*\\(`)), "hook", range?.endLine);
    }
    if (entry.propNames.size) explain(`It receives ${Array.from(entry.propNames).join(", ")} as props.`, entry.declarationLine, "props", entry.declarationEndLine);
    if (entry.stateCount) explain(`It initializes ${entry.stateCount} local state value${entry.stateCount === 1 ? "" : "s"}.`, entry.stateLine || 1, "state", entry.stateEndLine || entry.stateLine || 1);
    if (entry.effectCount) explain(`It runs ${entry.effectCount} React effect${entry.effectCount === 1 ? "" : "s"}.`, entry.effectLine || 1, "effect", entry.effectEndLine || entry.effectLine || 1);
    if (entry.eventCount) explain(`It declares ${entry.eventCount} interface event handler${entry.eventCount === 1 ? "" : "s"}.`, entry.eventLine || 1, "event", entry.eventEndLine || entry.eventLine || 1);
    if (entry.apiCount) explain(`It performs ${entry.apiCount} API request${entry.apiCount === 1 ? "" : "s"}.`, entry.apiLine || 1, "api", entry.apiEndLine || entry.apiLine || 1);
    const lazyImports = entry.imports.filter((item) => item.lazy).map((item) => item.specifier);
    const aliasedAssets = entry.imports.filter((item) => !isSourceSpecifier(item.specifier) && Object.keys(aliases).some((alias) => item.specifier === alias || item.specifier.startsWith(`${alias}/`))).map((item) => item.specifier);
    const assetDependencies = Array.from(new Set([...entry.assets, ...aliasedAssets]));
    const resourceDependencies = Array.from(new Set(assetDependencies.map((specifier) => resolveLocalImport(entry.file, specifier, allFiles, aliases)).filter(Boolean)));
    if (lazyImports.length) { const lazyImport = entry.imports.find((item) => item.lazy); explain(`It lazy-loads ${lazyImports.join(", ")} into a separate runtime path.`, lazyImport?.line ?? 1, "import", lazyImport?.endLine); }
    const firstAssetSpecifier = assetDependencies[0];
    const assetLine = firstAssetSpecifier ? entry.imports.find((item) => item.specifier === firstAssetSpecifier)?.line ?? sourceLine(entry.source, new RegExp(escapePattern(firstAssetSpecifier))) : 1;
    if (resourceDependencies.length) explain(`It includes ${resourceDependencies.join(", ")} as local style, data, or asset dependencies.`, assetLine, "resource");
    else if (assetDependencies.length) explain(`It references ${assetDependencies.join(", ")} as bundled style or asset dependencies that are external or unresolved.`, assetLine, "resource");
    if (entry.hasJsx) explain("It returns or renders interface elements.", entry.jsxLine || sourceLine(entry.source, /<[A-Za-z]/), "render", entry.jsxEndLine || entry.jsxLine || 1);
    const usedAliases = Object.keys(aliases).filter((alias) => entry.imports.some((item) => item.specifier === alias || item.specifier.startsWith(`${alias}/`)));
    const bundlerNotes = [
      ...usedAliases.map((alias) => `${alias} → ${aliases[alias]}`),
      ...lazyImports.map((specifier) => `lazy: ${specifier}`),
      ...assetDependencies.map((asset) => `asset: ${asset}`),
    ];
    if (usedAliases.length && bundlerTools.length) explain(`${bundlerTools.join("/")} resolves ${usedAliases.join(", ")} through project aliases.`, entry.imports.find((item) => usedAliases.some((alias) => item.specifier === alias || item.specifier.startsWith(`${alias}/`)))?.line ?? 1, "import");
    details[node.id] = {
      name: node.name,
      file: node.file,
      type: node.kind,
      parent: incoming.join(", ") || "Application",
      children: outgoing.join(", ") || "None",
      metrics: [`${incoming.length} dependents`, `${outgoing.length} dependencies`, `${entry.stateCount} local state`, `${entry.effectCount + entry.apiCount + entry.eventCount} effects & events`],
      steps,
      explanations,
      source: entry.source,
      relations: {
        usedBy: edges.filter((edge) => edge.to === node.id).map((edge) => edge.from),
        dependsOn: edges.filter((edge) => edge.from === node.id).map((edge) => edge.to),
        resources: resourceDependencies,
      },
      insights: {
        props: Array.from(entry.propNames),
        hooks: Array.from(entry.hooks),
        exports: [],
        diagnostics: entry.issues,
        bundler: bundlerNotes,
        framework: [],
      },
    };
  });

  return { nodes, edges, details, issues: issues.slice(0, 20) };
}

export async function analyzeProjectSources(sources: Record<string, string>, onProgress: (progress: AnalyzerProgress) => void = () => undefined): Promise<AnalysisResult> {
  const [{ analyzeTypeScriptSemantics }, { analyzeESLint }, { analyzeBundlerConfig }, { analyzeNextProject }] = await Promise.all([
    import("./semantic"),
    import("./eslint"),
    import("./bundler"),
    import("./next"),
  ]);
  const bundler = analyzeBundlerConfig(sources);
  onProgress({ stage: 1 });
  const result = analyzeSources(sources, bundler.aliases, bundler.tools);
  const componentCount = result.nodes.filter((node) => node.kind === "Component" || node.kind === "Page").length;
  onProgress({ stage: 2, components: componentCount, imports: result.edges.length });
  const next = analyzeNextProject(sources);
  result.nodes.forEach((node) => {
    const info = next.files[node.file];
    if (!info) return;
    node.kind = info.kind;
    const [icon, tone] = kindStyle(info.kind);
    node.icon = icon;
    node.tone = tone;
    node.meta = [info.role, info.route, info.rendering].filter(Boolean).join(" · ");
    const detail = result.details[node.id];
    detail.type = info.kind;
    detail.steps.push(...info.notes);
    detail.insights.framework = [`Next.js ${next.router}`, info.role, info.route, info.rendering];
  });
  let semantic: ReturnType<typeof analyzeTypeScriptSemantics> = { files: {}, issues: [] };
  let lintIssues: AnalyzerIssue[] = [];
  try {
    semantic = analyzeTypeScriptSemantics(sources, Object.fromEntries(result.nodes.map((node) => [node.file, node.name])), bundler.aliases);
  } catch (error) {
    result.issues.push({
      title: "TypeScript semantic analysis skipped",
      file: result.nodes[0]?.file ?? "Project",
      line: 1,
      detail: error instanceof RangeError ? "A source file contains syntax nested too deeply for the browser semantic engine. The component graph was built with Babel AST analysis instead." : error instanceof Error ? error.message : "The semantic analyzer could not inspect this project.",
      source: "typescript",
      severity: "warning",
    });
  }
  onProgress({ stage: 3, components: componentCount, imports: result.edges.length });
  try {
    lintIssues = analyzeESLint(sources);
  } catch (error) {
    result.issues.push({
      title: "ESLint analysis skipped",
      file: result.nodes[0]?.file ?? "Project",
      line: 1,
      detail: error instanceof RangeError ? "A source file is nested too deeply for the browser lint engine. Component and dependency analysis still completed." : error instanceof Error ? error.message : "ESLint could not inspect this project.",
      source: "eslint",
      severity: "warning",
    });
  }
  const nodeByFile = Object.fromEntries(result.nodes.map((node) => [node.file, node]));
  result.edges = [];
  Object.entries(semantic.files).forEach(([file, info]) => {
    info.dependencies.forEach((dependency) => {
      if (!nodeByFile[file] || !nodeByFile[dependency] || result.edges.some((edge) => edge.from === file && edge.to === dependency)) return;
      result.edges.push({ from: file, to: dependency, dashed: nodeByFile[dependency].kind === "Hook" });
    });
  });
  next.edges.forEach((edge) => {
    if (!nodeByFile[edge.from] || !nodeByFile[edge.to] || result.edges.some((existing) => existing.from === edge.from && existing.to === edge.to)) return;
    result.edges.push(edge);
  });
  onProgress({ stage: 4, components: componentCount, imports: result.edges.length });
  result.nodes.forEach((node) => {
    const info = semantic.files[node.file];
    const detail = result.details[node.id];
    if (!info || !detail) return;
    const incoming = result.edges.filter((edge) => edge.to === node.id).map((edge) => nodeByFile[edge.from]?.name).filter(Boolean);
    const outgoing = result.edges.filter((edge) => edge.from === node.id).map((edge) => nodeByFile[edge.to]?.name).filter(Boolean);
    detail.parent = incoming.join(", ") || "Application";
    detail.children = outgoing.join(", ") || "None";
    detail.relations = {
      usedBy: result.edges.filter((edge) => edge.to === node.id).map((edge) => edge.from),
      dependsOn: result.edges.filter((edge) => edge.from === node.id).map((edge) => edge.to),
      resources: detail.relations.resources,
    };
    detail.metrics[0] = `${incoming.length} dependents`;
    detail.metrics[1] = `${outgoing.length} dependencies`;
    detail.insights = {
      props: info.props.length ? info.props : detail.insights.props,
      hooks: detail.insights.hooks,
      exports: info.exports,
      diagnostics: [
        ...detail.insights.diagnostics,
        ...semantic.issues.filter((issue) => issue.file === node.file),
        ...lintIssues.filter((issue) => issue.file === node.file),
      ],
      bundler: detail.insights.bundler,
      framework: detail.insights.framework,
    };
    if (info.props.length && !/\bprops?\b/.test(node.meta)) node.meta = `${info.props.length} prop${info.props.length === 1 ? "" : "s"} · ${node.meta}`;
    if (info.props.length) {
      const text = `TypeScript resolves ${info.propsType || "its props"} with ${info.props.join(", ")}.`;
      detail.steps.push(text);
      const line = sourceLine(detail.source, new RegExp(`\\b${escapePattern(node.name)}\\b`));
      detail.explanations.push({ text, line, endLine: line, kind: "props" });
    }
    if (info.referencedBy.length) detail.steps.push(`Its exported symbols are referenced by ${info.referencedBy.join(", ")}.`);
    if (info.exports.length) {
      const text = `It exports ${info.exports.join(", ")}.`;
      detail.steps.push(text);
      const line = sourceLine(detail.source, /\bexport\b/);
      detail.explanations.push({ text, line, endLine: line, kind: "export" });
    }
    const diagnosticCount = semantic.issues.filter((issue) => issue.file === node.file).length;
    if (diagnosticCount) {
      const text = `TypeScript reported ${diagnosticCount} diagnostic${diagnosticCount === 1 ? "" : "s"} in this file.`;
      detail.steps.push(text);
      const line = semantic.issues.find((issue) => issue.file === node.file)?.line ?? 1;
      detail.explanations.push({ text, line, endLine: line, kind: "diagnostic" });
    }
    const lintCount = lintIssues.filter((issue) => issue.file === node.file).length;
    if (lintCount) {
      const text = `ESLint reported ${lintCount} correctness or code-quality finding${lintCount === 1 ? "" : "s"} in this file.`;
      detail.steps.push(text);
      const line = lintIssues.find((issue) => issue.file === node.file)?.line ?? 1;
      detail.explanations.push({ text, line, endLine: line, kind: "diagnostic" });
    }
  });
  const seenIssues = new Set<string>();
  result.issues = [...result.issues, ...semantic.issues, ...lintIssues].filter((issue) => {
    const key = `${issue.file}:${issue.line}:${issue.title}:${issue.detail}`;
    if (seenIssues.has(key)) return false;
    seenIssues.add(key);
    return true;
  }).slice(0, 20);
  return result;
}
