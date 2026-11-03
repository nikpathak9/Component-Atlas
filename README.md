# Component Atlas

<p align="center">
  <img src="public/component-atlas-logo.png" alt="Component Atlas logo" width="104" />
</p>

<p align="center"><strong>Understand a codebase before you touch a line.</strong></p>

Component Atlas is a browser-based static analysis workspace that turns a frontend project into an interactive map of its components, routes, dependencies, data flow, diagnostics, and source code.

## What it does

Import a local folder, paste source code, or provide a public GitHub repository URL. Component Atlas analyzes the project without running it or installing its dependencies, then provides:

- An interactive component and dependency graph
- Focused incoming and outgoing relationships for the selected file
- Execution-flow explanations linked to exact source ranges
- A directory-style explorer for source, styles, data, and assets
- A syntax-highlighted viewer with unlimited, closable tabs
- TypeScript, ESLint, parser, and unresolved-import diagnostics
- Project health, comparison, ignored-file, and storage reports
- Multiple saved projects with rename, reanalysis, favorites, and deletion
- Dark and light themes with a desktop-focused, resizable workspace

## Analysis engine

Analysis runs inside a browser Web Worker. Imported application code is not executed.

| Engine | Purpose |
| --- | --- |
| Babel parser and traversal | JavaScript, JSX, TypeScript, and TSX syntax trees |
| TypeScript compiler APIs | Symbols, props, exports, aliases, references, and semantic diagnostics |
| ESLint browser runtime | Static correctness checks for JavaScript source |
| Framework adapters | Routes, layouts, lifecycle APIs, and framework relationships |
| Bundler inspection | Vite and Webpack aliases, lazy imports, and assets |

Unchanged file facts are cached between analyses to reduce repeat work.

## Framework support

- React
- Next.js App Router and Pages Router
- Remix
- SolidJS and SolidStart
- LightningJS
- Vue and Nuxt
- Astro

React and Next.js currently have the deepest support. Other adapters continue to evolve.

## Supported inputs

- Local project folders
- Pasted JavaScript or TypeScript source
- Public GitHub repositories

Private GitHub repositories are not supported yet.

Relevant source, style, data, vector, image, and font files are kept for analysis or relationship mapping. Generated output, dependency folders, secrets, lock files, oversized binaries, and unsupported files are excluded. The import report explains what was ignored and why.

## Privacy

- Local analysis happens in the browser.
- Imported applications are never executed.
- Project dependencies are never installed.
- Local and pasted private source is not uploaded to Firestore.
- Firestore stores cloud-safe analysis metadata so signed-in users can restore projects across sessions.
- Public GitHub source is fetched only for the repository being analyzed.

Review the Firebase and hosting configuration before deploying publicly.

## Requirements

- Node.js `22.13.0` or newer
- npm
- A modern desktop browser with Web Worker and ES module support

Component Atlas uses Vite for local development and production builds.

## Getting started

```bash
git clone https://github.com/nikpathak9/Component-Atlas.git
cd Component-Atlas
npm install
cp .env.example .env.local
```

Add your Firebase web configuration to `.env.local`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

With `nvm`:

```bash
nvm install 22
nvm use 22
```

## Firebase setup

1. Create a Firebase project and web application.
2. Enable Google and Email/Password providers in Firebase Authentication.
3. Create a Firestore database.
4. Add the Firebase web configuration to `.env.local`.
5. Review and deploy the included Firestore rules before production use.

```bash
firebase deploy --only firestore:rules
```

## Deploying to Netlify

This repository includes `netlify.toml`. In Netlify, import the GitHub repository and use the included build settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22`

In **Project configuration → Environment variables**, add the six `VITE_FIREBASE_*` values from your Firebase web application. Do not add a local `.env` file to the repository.

For Google authentication, add your deployed Netlify domain to Firebase Authentication's **Authorized domains** list. Direct navigation to `/workspace`, `/login`, and `/signup` is supported by the SPA redirect in `netlify.toml`.

## Commands

```bash
npm run dev            # Start the development server
npm run build          # Create a production build
npm run start          # Start the production server
npm run test           # Build and run rendered HTML tests
npm run test:analyzer  # Run analyzer regression tests
npm run lint           # Run ESLint
```

## Project structure

```text
app/
  analyzer/             Web Worker and static-analysis engines
  components/           Code viewer and workspace components
  firebase/             Authentication and Firestore project sync
  lib/                  Shared file and presentation utilities
  login/                Sign-in route
  signup/               Account creation route
  stores/               Zustand UI and editor state
  types/                Shared workspace types
  workspace/            Workspace route
  page.tsx              Main application orchestration
db/                     Optional Drizzle data layer
public/                 Logos and static assets
tests/                  Analyzer and framework regression tests
netlify.toml            Netlify build settings and SPA route redirect
```

## Current limitations

- The analysis workspace is restricted to desktop screens.
- Private GitHub repository import is unavailable.
- Cloud sync has a payload limit and stores analysis metadata rather than private local source.
- Large repositories use file and byte budgets to protect browser responsiveness.
- Some framework adapters provide less detail than React and Next.js.

## Roadmap

- Deeper state, callback, prop, route, and API-flow analysis
- Private GitHub support using minimal OAuth permissions
- Virtualized project trees and diagnostic lists
- Graph layout work moved fully off the main UI thread
- Further component extraction and performance profiling
- Expanded end-to-end and accessibility coverage

## Development status

Component Atlas is under active development. The analyzer regression suite covers AST relationships, aliases, resources, TypeScript semantics, ESLint findings, bundler behavior, framework routes, source locations, caching, and analysis progress.

## License

No open-source license has been added yet. All rights are reserved by the repository owner unless a license is introduced later.
