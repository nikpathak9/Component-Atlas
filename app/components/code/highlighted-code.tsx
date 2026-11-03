import { memo, type ReactElement } from "react";
import type { AnalysisIssue } from "../../types/workspace";

const syntaxKeywords = new Set([
  "abstract", "as", "async", "await", "break", "case", "catch", "class",
  "const", "continue", "declare", "default", "delete", "do", "else", "enum",
  "export", "extends", "finally", "for", "from", "function", "get", "if",
  "implements", "import", "in", "infer", "instanceof", "interface", "keyof",
  "let", "namespace", "new", "of", "private", "protected", "public", "readonly",
  "return", "satisfies", "set", "static", "super", "switch", "throw", "try",
  "type", "typeof", "var", "void", "while", "with", "yield",
]);

const syntaxTokenPattern =
  /\/\*[\s\S]*?\*\/|\/\/[^\n]*|`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:abstract|as|async|await|break|case|catch|class|const|continue|declare|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|infer|instanceof|interface|keyof|let|namespace|new|of|private|protected|public|readonly|return|satisfies|set|static|super|switch|throw|try|type|typeof|var|void|while|with|yield)\b|\b(?:true|false|null|undefined)\b|\b\d+(?:\.\d+)?\b|<\/?[A-Za-z][\w.-]*|\b[A-Z][A-Za-z0-9_$]*\b|\b[A-Za-z_$][\w$]*(?=\s*\()|(?<=\.)[A-Za-z_$][\w$]*/g;

export const HighlightedCode = memo(function HighlightedCode({
  source,
  highlightedLine = 0,
  highlightedEndLine = highlightedLine,
  diagnostics = [],
}: {
  source: string;
  highlightedLine?: number;
  highlightedEndLine?: number;
  diagnostics?: AnalysisIssue[];
}) {
  const diagnosticsByLine = new Map(
    diagnostics.map((diagnostic) => [diagnostic.line, diagnostic]),
  );
  return (
    <code className='syntax-code'>
      {source.split("\n").map((line, lineIndex) => {
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
        const diagnostic = diagnosticsByLine.get(lineNumber);
        return (
          <span
            className={`syntax-line ${isHighlighted ? "highlighted" : ""} ${diagnostic ? `has-diagnostic diagnostic-${diagnostic.severity ?? "error"}` : ""} ${isHighlighted && lineNumber === highlightedLine ? "range-start" : ""} ${isHighlighted && lineNumber === Math.max(highlightedLine, highlightedEndLine) ? "range-end" : ""}`}
            data-line={lineNumber}
            key={lineNumber}
            title={diagnostic ? `${diagnostic.title}: ${diagnostic.detail}` : undefined}
          >
            <i className='syntax-line-number'>{lineNumber}</i>
            <span className='syntax-line-content'>{parts.length ? parts : " "}</span>
          </span>
        );
      })}
    </code>
  );
});
