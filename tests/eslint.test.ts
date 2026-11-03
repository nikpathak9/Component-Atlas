import assert from "node:assert/strict";
import test from "node:test";
import { analyzeESLint } from "../app/analyzer/eslint";

test("runs ESLint core correctness rules with file and source locations", () => {
  const issues = analyzeESLint({
    "src/Card.jsx": `export function Card({ count }) {
      debugger;
      if (count == "1") return <div>{count}</div>;
      return <span />;
    }`,
  });

  const debuggerIssue = issues.find((issue) => issue.ruleId === "no-debugger");
  const equalityIssue = issues.find((issue) => issue.ruleId === "eqeqeq");
  assert.equal(debuggerIssue?.source, "eslint");
  assert.equal(debuggerIssue?.severity, "warning");
  assert.equal(debuggerIssue?.file, "src/Card.jsx");
  assert.equal(debuggerIssue?.line, 2);
  assert.equal(equalityIssue?.line, 3);
  assert.ok((equalityIssue?.column ?? 0) > 0);
});

test("leaves TypeScript and TSX to the TypeScript semantic engine", () => {
  const issues = analyzeESLint({
    "src/Card.tsx": `export function Card({ count }: { count: number }) { return <div>{count}</div>; }`,
  });
  assert.deepEqual(issues, []);
});
