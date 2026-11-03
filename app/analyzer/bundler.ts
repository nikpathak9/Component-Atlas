import { parse, type ParserPlugin } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

type Traverse = typeof traverse;
const traverseAst = ((traverse as unknown as { default?: Traverse }).default ?? traverse) as Traverse;

export type BundlerAnalysis = {
  tools: string[];
  aliases: Record<string, string>;
  configFiles: string[];
};

const BUNDLER_CONFIG_PATTERN = /(^|\/)(vite|webpack|rollup|next)\.config\.[cm]?[jt]s$/i;

function normalizeTarget(target: string) {
  const normalized = target.replace(/\\/g, "/").replace(/^file:\/\//, "").replace(/^\.\//, "").replace(/^\//, "").replace(/\/$/, "");
  const sourceIndex = normalized.lastIndexOf("/src/");
  if (sourceIndex >= 0) return normalized.slice(sourceIndex + 1);
  return normalized || ".";
}

function propertyName(node: t.Expression | t.PrivateName | t.Identifier | null | undefined) {
  if (t.isIdentifier(node)) return node.name;
  if (t.isStringLiteral(node)) return node.value;
  return "";
}

function staticString(node: t.Node | null | undefined): string {
  if (!node) return "";
  if (t.isStringLiteral(node)) return node.value;
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? "";
  if (t.isTSAsExpression(node) || t.isTSTypeAssertion(node) || t.isTSNonNullExpression(node)) return staticString(node.expression);
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) return staticString(node.object);
  if (t.isNewExpression(node) || t.isCallExpression(node)) {
    const candidates = node.arguments.map((argument) => t.isSpreadElement(argument) || t.isJSXNamespacedName(argument) ? "" : staticString(argument)).filter(Boolean);
    return candidates.at(-1) ?? "";
  }
  return "";
}

function addObjectAliases(object: t.ObjectExpression, aliases: Record<string, string>) {
  object.properties.forEach((property) => {
    if (!t.isObjectProperty(property)) return;
    const alias = propertyName(property.key).replace(/\$$/, "");
    const target = staticString(property.value);
    if (alias && target) aliases[alias] = normalizeTarget(target);
  });
}

function addArrayAliases(array: t.ArrayExpression, aliases: Record<string, string>) {
  array.elements.forEach((element) => {
    if (!t.isObjectExpression(element)) return;
    let alias = "";
    let target = "";
    element.properties.forEach((property) => {
      if (!t.isObjectProperty(property)) return;
      const key = propertyName(property.key);
      if (key === "find") alias = staticString(property.value).replace(/\$$/, "");
      if (key === "replacement") target = staticString(property.value);
    });
    if (alias && target) aliases[alias] = normalizeTarget(target);
  });
}

function configPlugins(file: string): ParserPlugin[] {
  const plugins: ParserPlugin[] = ["decorators-legacy", "classProperties", "dynamicImport", "importMeta", "topLevelAwait"];
  if (/\.tsx?$/i.test(file)) plugins.push("typescript");
  return plugins;
}

function readConfigAliases(file: string, source: string, aliases: Record<string, string>) {
  const ast = parse(source, { sourceType: "unambiguous", sourceFilename: file, plugins: configPlugins(file), errorRecovery: true });
  traverseAst(ast, {
    ObjectProperty(path) {
      if (propertyName(path.node.key) !== "alias") return;
      if (t.isObjectExpression(path.node.value)) addObjectAliases(path.node.value, aliases);
      if (t.isArrayExpression(path.node.value)) addArrayAliases(path.node.value, aliases);
    },
  });
}

export function analyzeBundlerConfig(sources: Record<string, string>): BundlerAnalysis {
  const aliases: Record<string, string> = {};
  const tools = new Set<string>();
  const configFiles = Object.keys(sources).filter((file) => BUNDLER_CONFIG_PATTERN.test(file));

  configFiles.forEach((file) => {
    if (/vite\.config/i.test(file)) tools.add("Vite");
    if (/webpack\.config/i.test(file)) tools.add("Webpack");
    if (/rollup\.config/i.test(file)) tools.add("Rollup");
    if (/next\.config/i.test(file)) tools.add("Next.js");
    try { readConfigAliases(file, sources[file], aliases); } catch { /* The source parser reports application syntax separately. */ }
  });

  const packageSource = sources[Object.keys(sources).find((file) => /(^|\/)package\.json$/i.test(file)) ?? ""];
  if (packageSource) {
    try {
      const packageJson = JSON.parse(packageSource) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      const packages = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (packages.vite) tools.add("Vite");
      if (packages.webpack) tools.add("Webpack");
      if (packages.rollup) tools.add("Rollup");
      if (packages.next) tools.add("Next.js");
    } catch { /* Invalid package metadata does not prevent source analysis. */ }
  }

  return { tools: Array.from(tools), aliases, configFiles };
}
