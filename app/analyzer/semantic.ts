import * as tsModule from "typescript";
import type * as TsTypes from "typescript";
import { resolveLocalImport, type AnalyzerIssue } from "./index";

type TypeScriptApi = typeof import("typescript");

function resolveTypeScriptApi(module: typeof tsModule): TypeScriptApi {
  const wrappedModule = module as typeof tsModule & {
    default?: TypeScriptApi;
    "module.exports"?: TypeScriptApi;
  };
  const candidates = [module, wrappedModule.default, wrappedModule["module.exports"]];
  const api = candidates.find((candidate) => candidate?.createProgram && candidate?.JsxEmit);
  if (!api) throw new Error("The TypeScript analysis engine could not be initialized in this browser.");
  return api;
}

const ts = resolveTypeScriptApi(tsModule);

export type SemanticFileInfo = {
  props: string[];
  propsType: string;
  exports: string[];
  referencedBy: string[];
  dependencies: string[];
};

export type SemanticAnalysis = {
  files: Record<string, SemanticFileInfo>;
  issues: AnalyzerIssue[];
};

const SOURCE_FILE_PATTERN = /\.(tsx?|jsx?)$/i;
const CONFIG_FILE_PATTERN = /(^|\/)tsconfig(?:\.[^/]+)?\.json$/i;
const TOOL_CONFIG_PATTERN = /(^|\/)(vite|webpack|rollup|next|astro|remix|babel|eslint)\.config\.[cm]?[jt]s$/i;
const IGNORED_DIAGNOSTIC_CODES = new Set([
  2307, // External package declarations are intentionally not loaded.
  2318, // Standard library declarations are intentionally not loaded.
  2468,
  2503,
  2580,
  2583,
  2584,
  2688,
  2693,
  2705,
  2711, // Dynamic imports require the intentionally omitted Promise library declaration.
  2875,
  6053,
  7016,
  7026,
]);

function normalizePath(path: string) {
  const normalized: string[] = [];
  path.replace(/\\/g, "/").split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  });
  return normalized.join("/");
}

const toVirtualPath = (path: string) => `/${normalizePath(path)}`;
const fromVirtualPath = (path: string) => normalizePath(path);

function scriptKind(file: string) {
  if (/\.tsx$/i.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(file)) return ts.ScriptKind.JSX;
  if (/\.js$/i.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function extensionFor(file: string) {
  if (/\.tsx$/i.test(file)) return ts.Extension.Tsx;
  if (/\.jsx$/i.test(file)) return ts.Extension.Jsx;
  if (/\.js$/i.test(file)) return ts.Extension.Js;
  return ts.Extension.Ts;
}

function compilerOptions(sources: Record<string, string>, issues: AnalyzerIssue[]) {
  const defaults: TsTypes.CompilerOptions = {
    allowJs: true,
    checkJs: false,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    noEmit: true,
    noLib: true,
    skipLibCheck: true,
    baseUrl: "/",
    paths: { "@/*": ["src/*"], "~/*": ["src/*"] },
    types: [],
  };
  const configFile = Object.keys(sources).find((file) => CONFIG_FILE_PATTERN.test(file));
  if (!configFile) return defaults;
  const parsed = ts.parseConfigFileTextToJson(configFile, sources[configFile]);
  if (parsed.error) {
    issues.push({ title: "Invalid TypeScript configuration", file: configFile, line: 1, detail: ts.flattenDiagnosticMessageText(parsed.error.messageText, "\n"), source: "typescript", severity: "error" });
    return defaults;
  }
  const converted = ts.convertCompilerOptionsFromJson(parsed.config?.compilerOptions ?? {}, "/", configFile);
  converted.errors.forEach((error) => issues.push({ title: "Invalid TypeScript configuration", file: configFile, line: 1, detail: ts.flattenDiagnosticMessageText(error.messageText, "\n"), source: "typescript", severity: "error" }));
  return {
    ...defaults,
    ...converted.options,
    allowJs: true,
    noEmit: true,
    noLib: true,
    skipLibCheck: true,
    types: [],
    baseUrl: converted.options.baseUrl ?? defaults.baseUrl,
    paths: converted.options.paths ?? defaults.paths,
  };
}

function diagnosticTitle(code: number) {
  if (code === 2322) return "Incompatible TypeScript type";
  if (code === 2339) return "Unknown TypeScript property";
  if (code === 2345) return "Invalid TypeScript argument";
  if (code === 2554) return "Invalid argument count";
  if (code === 2741) return "Missing required TypeScript property";
  if (code === 2353) return "Unknown object property";
  return "TypeScript diagnostic";
}

function isUsefulDiagnostic(diagnostic: TsTypes.Diagnostic) {
  if (!diagnostic.file || diagnostic.start === undefined) return false;
  if (IGNORED_DIAGNOSTIC_CODES.has(diagnostic.code)) return false;
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (/Cannot find (?:name|global type) '(?:Array|Boolean|Date|Error|Function|JSON|Math|Number|Object|Promise|Record|RegExp|String|Symbol|console|fetch|require|setTimeout|window|document)'/.test(message)) return false;
  return diagnostic.category === ts.DiagnosticCategory.Error || diagnostic.category === ts.DiagnosticCategory.Warning;
}

function walkTypeScriptAst(root: TsTypes.Node, visitor: (node: TsTypes.Node) => boolean | void) {
  const pending: TsTypes.Node[] = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if (visitor(node) === false) return;
    const children: TsTypes.Node[] = [];
    ts.forEachChild(node, (child) => { children.push(child); });
    for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]);
  }
}

function componentProps(sourceFile: TsTypes.SourceFile, componentName: string, checker: TsTypes.TypeChecker) {
  let parameter: TsTypes.ParameterDeclaration | undefined;
  walkTypeScriptAst(sourceFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === componentName) parameter = node.parameters[0];
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === componentName && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) parameter = node.initializer.parameters[0];
    if (parameter) return false;
  });
  if (!parameter) return { props: [] as string[], propsType: "" };
  const type = checker.getTypeAtLocation(parameter);
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return { props: [] as string[], propsType: "" };
  return {
    props: checker.getPropertiesOfType(type).map((property) => property.getName()).filter((name) => !name.startsWith("__")),
    propsType: checker.typeToString(type, parameter, ts.TypeFormatFlags.NoTruncation),
  };
}

function semanticSkipIssue(file: string, phase: string, error: unknown): AnalyzerIssue {
  return {
    title: "TypeScript analysis skipped for file",
    file,
    line: 1,
    detail: error instanceof RangeError
      ? `${phase} encountered syntax nested too deeply for the browser engine. Other files were still analyzed.`
      : `${phase} could not complete: ${error instanceof Error ? error.message : "Unknown TypeScript analysis error"}`,
    source: "typescript",
    severity: "warning",
  };
}

export function analyzeTypeScriptSemantics(sources: Record<string, string>, componentNames: Record<string, string>, aliases: Record<string, string> = {}): SemanticAnalysis {
  const issues: AnalyzerIssue[] = [];
  const sourcePaths = Object.keys(sources).filter((file) => SOURCE_FILE_PATTERN.test(file) && !/\.d\.ts$/i.test(file) && !TOOL_CONFIG_PATTERN.test(file));
  const sourceByVirtualPath = new Map(sourcePaths.map((file) => [toVirtualPath(file), sources[file]]));
  const options = compilerOptions(sources, issues);
  const moduleHost: TsTypes.ModuleResolutionHost = {
    fileExists: (fileName) => sourceByVirtualPath.has(toVirtualPath(fileName)),
    readFile: (fileName) => sourceByVirtualPath.get(toVirtualPath(fileName)),
    directoryExists: (directory) => {
      const prefix = `${toVirtualPath(directory).replace(/\/$/, "")}/`;
      return prefix === "//" || Array.from(sourceByVirtualPath.keys()).some((file) => file.startsWith(prefix));
    },
    realpath: (path) => toVirtualPath(path),
    getCurrentDirectory: () => "/",
    useCaseSensitiveFileNames: true,
  };
  const sourceFileCache = new Map<string, TsTypes.SourceFile>();
  const host: TsTypes.CompilerHost = {
    ...moduleHost,
    fileExists: moduleHost.fileExists,
    readFile: moduleHost.readFile,
    getCurrentDirectory: () => "/",
    getSourceFile(fileName, languageVersion) {
      const virtualPath = toVirtualPath(fileName);
      const source = sourceByVirtualPath.get(virtualPath);
      if (source === undefined) return undefined;
      const cached = sourceFileCache.get(virtualPath);
      if (cached) return cached;
      const parsed = ts.createSourceFile(virtualPath, source, languageVersion, true, scriptKind(virtualPath));
      sourceFileCache.set(virtualPath, parsed);
      return parsed;
    },
    getDefaultLibFileName: () => "/lib.d.ts",
    getCanonicalFileName: (fileName) => toVirtualPath(fileName),
    getNewLine: () => "\n",
    useCaseSensitiveFileNames: () => true,
    writeFile: () => undefined,
    resolveModuleNames(moduleNames, containingFile) {
      return moduleNames.map((moduleName) => {
        const resolved = ts.resolveModuleName(moduleName, containingFile, options, moduleHost).resolvedModule;
        if (resolved && sourceByVirtualPath.has(toVirtualPath(resolved.resolvedFileName))) return { ...resolved, resolvedFileName: toVirtualPath(resolved.resolvedFileName), isExternalLibraryImport: false };
        const fallback = resolveLocalImport(fromVirtualPath(containingFile), moduleName, sourcePaths, aliases);
        return fallback ? { resolvedFileName: toVirtualPath(fallback), extension: extensionFor(fallback), isExternalLibraryImport: false } : undefined;
      });
    },
  };

  const program = ts.createProgram({ rootNames: sourcePaths.map(toVirtualPath), options, host });
  const checker = program.getTypeChecker();
  try {
    program.getSemanticDiagnostics().filter((diagnostic) => {
      const fileName = diagnostic.file?.fileName ?? "";
      return /\.tsx?$/i.test(fileName) && isUsefulDiagnostic(diagnostic);
    }).forEach((diagnostic) => {
      const location = diagnostic.file!.getLineAndCharacterOfPosition(diagnostic.start!);
      issues.push({
        title: diagnosticTitle(diagnostic.code),
        file: fromVirtualPath(diagnostic.file!.fileName),
        line: location.line + 1,
        column: location.character + 1,
        detail: `TS${diagnostic.code}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
        source: "typescript",
        severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" : "warning",
        ruleId: `TS${diagnostic.code}`,
      });
    });
  } catch (error) {
    issues.push(semanticSkipIssue(sourcePaths[0] ?? "Project", "Project diagnostics", error));
  }

  const referencesByDefinition = new Map<string, Set<string>>();
  program.getSourceFiles().forEach((sourceFile) => {
    const consumer = fromVirtualPath(sourceFile.fileName);
    try {
      walkTypeScriptAst(sourceFile, (node) => {
        if (ts.isIdentifier(node)) {
          let symbol = checker.getSymbolAtLocation(node);
          if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias) {
            try { symbol = checker.getAliasedSymbol(symbol); } catch { /* Ignore an unresolved alias. */ }
          }
          const declaration = symbol?.declarations?.find((candidate) => sourceByVirtualPath.has(toVirtualPath(candidate.getSourceFile().fileName)));
          if (declaration) {
            const definition = fromVirtualPath(declaration.getSourceFile().fileName);
            if (definition !== consumer) {
              const consumers = referencesByDefinition.get(definition) ?? new Set<string>();
              consumers.add(consumer);
              referencesByDefinition.set(definition, consumers);
            }
          }
        }
      });
    } catch (error) {
      issues.push(semanticSkipIssue(consumer, "Cross-file reference analysis", error));
    }
  });

  const files: Record<string, SemanticFileInfo> = {};
  program.getSourceFiles().forEach((sourceFile) => {
    const file = fromVirtualPath(sourceFile.fileName);
    try {
      const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
      const exportedSymbols = moduleSymbol ? checker.getExportsOfModule(moduleSymbol).map((symbol) => symbol.getName()).filter((name) => name !== "default") : [];
      const props = componentProps(sourceFile, componentNames[file] ?? "", checker);
      const dependencies = new Set<string>();
      const addDependency = (specifier: string) => {
        const resolved = ts.resolveModuleName(specifier, sourceFile.fileName, options, moduleHost).resolvedModule;
        const dependency = resolved && sourceByVirtualPath.has(toVirtualPath(resolved.resolvedFileName))
          ? fromVirtualPath(resolved.resolvedFileName)
          : resolveLocalImport(file, specifier, sourcePaths, aliases);
        if (dependency && dependency !== file) dependencies.add(dependency);
      };
      walkTypeScriptAst(sourceFile, (node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const clause = node.importClause;
          const bindings = clause?.namedBindings;
          const hasRuntimeBinding = !clause || (!clause.isTypeOnly && (
            Boolean(clause.name)
            || Boolean(bindings && ts.isNamespaceImport(bindings))
            || Boolean(bindings && ts.isNamedImports(bindings) && bindings.elements.some((element) => !element.isTypeOnly))
          ));
          if (hasRuntimeBinding) addDependency(node.moduleSpecifier.text);
        }
        if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const hasRuntimeExport = !node.isTypeOnly && (!node.exportClause || !ts.isNamedExports(node.exportClause) || node.exportClause.elements.some((element) => !element.isTypeOnly));
          if (hasRuntimeExport) addDependency(node.moduleSpecifier.text);
        }
        if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteralLike(node.arguments[0])) {
          const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
          const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
          if (isDynamicImport || isRequire) addDependency(node.arguments[0].text);
        }
      });
      files[file] = {
        ...props,
        exports: exportedSymbols,
        referencedBy: Array.from(referencesByDefinition.get(file) ?? []).sort(),
        dependencies: Array.from(dependencies).sort(),
      };
    } catch (error) {
      issues.push(semanticSkipIssue(file, "Exports, props, and dependency analysis", error));
      files[file] = { props: [], propsType: "", exports: [], referencedBy: Array.from(referencesByDefinition.get(file) ?? []).sort(), dependencies: [] };
    }
  });

  return { files, issues };
}
