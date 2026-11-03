import { Linter } from "eslint-linter-browserify";
import type { AnalyzerIssue } from "./index";

const JAVASCRIPT_FILE_PATTERN = /\.jsx?$/i;
const TOOL_CONFIG_PATTERN = /(^|\/)(vite|webpack|rollup|next|astro|remix|babel|eslint)\.config\.[cm]?[jt]s$/i;

const browserGlobals = {
  AbortController: "readonly",
  Blob: "readonly",
  console: "readonly",
  document: "readonly",
  fetch: "readonly",
  File: "readonly",
  FileReader: "readonly",
  FormData: "readonly",
  location: "readonly",
  localStorage: "readonly",
  navigator: "readonly",
  process: "readonly",
  requestAnimationFrame: "readonly",
  sessionStorage: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  window: "readonly",
} as const;

const correctnessRules = {
  "constructor-super": "error",
  "for-direction": "error",
  "getter-return": "error",
  "no-async-promise-executor": "error",
  "no-class-assign": "error",
  "no-compare-neg-zero": "error",
  "no-cond-assign": "error",
  "no-const-assign": "error",
  "no-constant-binary-expression": "error",
  "no-control-regex": "error",
  "no-debugger": "warn",
  "no-dupe-args": "error",
  "no-dupe-class-members": "error",
  "no-dupe-else-if": "error",
  "no-dupe-keys": "error",
  "no-duplicate-case": "error",
  "no-empty-character-class": "error",
  "no-ex-assign": "error",
  "no-fallthrough": "error",
  "no-func-assign": "error",
  "no-import-assign": "error",
  "no-invalid-regexp": "error",
  "no-irregular-whitespace": "error",
  "no-loss-of-precision": "error",
  "no-obj-calls": "error",
  "no-promise-executor-return": "error",
  "no-self-assign": "warn",
  "no-setter-return": "error",
  "no-shadow-restricted-names": "error",
  "no-sparse-arrays": "error",
  "no-unreachable": "error",
  "no-unreachable-loop": "error",
  "no-unsafe-finally": "error",
  "no-unsafe-negation": "error",
  "no-unsafe-optional-chaining": "error",
  "no-useless-catch": "warn",
  "no-with": "error",
  "require-yield": "error",
  "use-isnan": "error",
  "valid-typeof": "error",
  eqeqeq: "warn",
} as const;

function lintTitle(ruleId: string | null, severity: number) {
  if (!ruleId) return "ESLint parser diagnostic";
  return severity === 2 ? "ESLint correctness error" : "ESLint code-quality warning";
}

const lintCache = new Map<string, { source: string; issues: AnalyzerIssue[] }>();

export function analyzeESLint(sources: Record<string, string>): AnalyzerIssue[] {
  const linter = new Linter();
  const issues: AnalyzerIssue[] = [];

  Object.entries(sources).forEach(([file, source]) => {
    if (!JAVASCRIPT_FILE_PATTERN.test(file) || /\.d\.ts$/i.test(file) || TOOL_CONFIG_PATTERN.test(file)) return;
    const cached = lintCache.get(file);
    if (cached?.source === source) {
      issues.push(...cached.issues);
      return;
    }
    const fileIssues: AnalyzerIssue[] = [];
    try {
      const messages = linter.verify(source, [{
        files: ["**/*.{js,jsx}"],
        languageOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
          globals: browserGlobals,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
        rules: correctnessRules,
      }], { filename: file });

      messages.slice(0, 12).forEach((message) => {
        fileIssues.push({
          title: lintTitle(message.ruleId, message.severity),
          file,
          line: message.line || 1,
          column: message.column || 1,
          detail: message.message,
          source: "eslint",
          severity: message.severity === 2 ? "error" : "warning",
          ruleId: message.ruleId ?? undefined,
        });
      });
    } catch (error) {
      fileIssues.push({
        title: "ESLint analysis skipped for file",
        file,
        line: 1,
        detail: error instanceof RangeError ? "This file contains syntax nested too deeply for the browser lint engine. Other files were still analyzed." : error instanceof Error ? error.message : "ESLint could not inspect this file.",
        source: "eslint",
        severity: "warning",
      });
    }
    lintCache.set(file, { source, issues: fileIssues });
    issues.push(...fileIssues);
  });

  return issues;
}
