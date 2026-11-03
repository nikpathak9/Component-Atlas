# Component Atlas

<p align="center">
  <img src="public/component-atlas-logo.png" alt="Component Atlas logo" width="96" />
</p>

<p align="center">
  A browser-based static analysis workspace for understanding React and TypeScript codebases without running them.
</p>

Component Atlas turns source code into an interactive component graph, execution flow, relationship inspector, and connected source viewer. Import a local project, paste source code, or load a public GitHub repository to explore how files, components, hooks, state, effects, routes, APIs, and resources connect.

## Highlights

- Interactive component graph with draggable infinite canvas, zoom, minimap, filters, and focused relationships
- Project explorer for source files, components, routes, hooks, styles, data, and assets
- Resizable and collapsible project explorer, code viewer, and flow inspector
- Multiple projects stored per signed-in user in browser IndexedDB
- Unlimited, closable, horizontally scrollable source tabs
- Syntax-highlighted source with AST-backed line-range navigation
- Flow Inspector with metrics, analysis summaries, relationships, resources, and clickable execution steps
- Local folder upload, pasted source, and public GitHub repository import
- Duplicate-project and duplicate-file handling
- Ignored-file report with reasons and configurable analysis budgets
- Dark and light themes
- Desktop-only analysis workspace with a responsive landing and authentication flow

## Static analysis engine

Analysis runs in a browser Web Worker and does not execute the imported application or install its dependencies.

The analyzer currently combines:

- `@babel/parser`, `@babel/traverse`, and `@babel/types` for JavaScript, JSX, TypeScript, and TSX AST analysis
- TypeScript compiler APIs for semantic diagnostics, props, exports, symbol references, and path aliases
- `eslint-linter-browserify` for browser-side correctness checks
- Bundler configuration inspection for Vite and Webpack aliases, lazy imports, and assets
- Next.js adapters for App Router, Pages Router, layouts, route handlers, API routes, and data-loading conventions

## Supported project inputs

Component Atlas currently focuses on React-oriented JavaScript and TypeScript projects.

Kept for analysis or relationship mapping:

- `.js`, `.jsx`, `.ts`, `.tsx`
- `.css`, `.scss`, `.sass`, `.less`, `.styl`, `.stylus`
- `.svg`, common image formats, and common font formats
- `.json`, `.graphql`, `.gql`, `.mdx`

Generated output, dependency directories, secrets, lock files, large binaries, and unrelated configuration files are ignored. The import report explains every ignored category.

## Requirements

- Node.js `>=22.13.0`
- npm
- A modern desktop browser with Web Worker, IndexedDB, File System upload, and ES module support

Node.js 20 is not supported by the current vinext toolchain because it relies on newer Node filesystem APIs.

## Local development

```bash
git clone https://github.com/nikpathak9/Component-Atlas.git
cd Component-Atlas
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To select a compatible Node version with `nvm`:

```bash
nvm install 22
nvm use 22
```

## Commands

```bash
npm run dev            # Start the vinext development server
npm run build          # Create a production build
npm run start          # Start the production server
npm run test:analyzer  # Run analyzer regression tests
npm run lint           # Run ESLint
```

## Project structure

```text
app/
  analyzer/        Browser worker, AST, TypeScript, ESLint, bundler, and Next.js analysis
  api/auth/        Current-user endpoint
  login/           Sign-in screen
  workspace/       Workspace route
  page.tsx         Landing page, import workflow, and interactive workspace
  *.css            Landing and workspace styling
db/                Optional Drizzle/D1 data layer
public/            Component Atlas branding assets
tests/             Analyzer, semantic, ESLint, bundler, and Next.js tests
worker/            Cloudflare worker entry point
```

## Privacy model

- Imported local source is analyzed in the browser.
- Imported application code is never executed.
- Project dependencies are not installed.
- Workspace projects are stored locally in IndexedDB and separated by authenticated user ID.
- Public GitHub imports fetch repository contents for static analysis without connecting a GitHub account.

Review the hosting and authentication configuration before deploying the application publicly.

## Current limitations

- The analysis workspace is intentionally restricted to desktop screens.
- React and Next.js have the strongest support today.
- React, Next.js, SolidJS, SolidStart, and LightningJS support continue to evolve at different depths.
- Private GitHub repository import is intentionally deferred; current imports support public repositories only.
- Authentication currently depends on the hosting environment's identity headers, with a local development fallback.
- Very large repositories are constrained by source-file and byte budgets to keep browser analysis responsive.

## Roadmap

- Framework adapters for SolidJS, LightningJS, and additional React meta-frameworks
- Richer prop, callback, state, route, and API data-flow edges
- Detailed diagnostic explanations and suggested fixes
- Optional private-repository integration with fine-grained GitHub App permissions
- Cloud project persistence and collaboration
- Large-project performance benchmarks and broader end-to-end test coverage

## Status

Component Atlas is under active development. The analyzer regression suite currently covers component relationships, source locations, aliases, resources, ESLint findings, TypeScript semantics, bundler behavior, and Next.js conventions.
