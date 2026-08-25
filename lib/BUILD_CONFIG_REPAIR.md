# QuickGuard — Build, Lint & Configuration Repair (Prompt 2C handoff)

Status: build-critical config files are locked in the Readdy editor. `package.json`,
`tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore` and CI workflows
either revert silently or are blocked from creation. Apply the changes below in the
local Git repo / CI instead.

## 1. package.json — scripts

Replace the `scripts` block with:

```json
"scripts": {
  "dev": "cross-env NODE_ENV=development next dev -H 0.0.0.0 -p 3000",
  "build": "next build",
  "start": "next start",
  "typecheck": "tsc --noEmit -p tsconfig.app.json",
  "typecheck:edge": "deno check supabase/functions/*/index.ts",
  "lint": "eslint .",
  "check": "npm run typecheck && npm run lint && npm run build"
}
```

No `test` script is defined because no test runner is installed. If a runner is added
later, add `"test": "<runner>"` and prepend it to `check`.

## 2. package.json — dependencies

- Upgrade `next` from `15.3.2` to `^15.5.0` (patched 15.x; below the patched 15.3.8).
- Remove `@react-google-maps/api` — unused (maps render via an iframe embed).
- Add devDependencies for ESLint:
  `"@eslint/eslintrc": "^3.0.0"`, `"eslint": "^9.0.0"`, `"eslint-config-next": "^15.5.0"`.
- Add `"engines": { "node": ">=18.18.0" }`.

Equivalent install command:

```
npm install -D eslint@^9 eslint-config-next@^15.5.0 @eslint/eslintrc@^3
npm uninstall @react-google-maps/api
```

## 3. tsconfig.app.json (separate browser TS from Deno)

Create at repo root. `tsconfig.json` includes `supabase/functions/**` via `**/*.ts`,
which mixes Deno errors into the browser typecheck. This app-only config excludes it:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "supabase"]
}
```

Then `npm run typecheck` uses `tsc --noEmit -p tsconfig.app.json`.

Note: the root `tsconfig.json` currently has `skipLibCheck: true` (declaration files only
— acceptable) and `allowJs: true`. Do not disable `strict`.

## 4. Edge Function Deno check

Edge functions import from `https://esm.sh/...` (Deno). Check them separately with the
Deno CLI (not the browser tsconfig):

```
deno check supabase/functions/*/index.ts
```

or the Supabase CLI (`supabase functions serve`). Do not run Deno files through the
application `tsc`.

## 5. .gitignore (missing — create it)

```
/node_modules
/.next/
/out/
/build
/dist
*.tsbuildinfo
next-env.d.ts
/coverage
.env
.env.*
!.env.example
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.DS_Store
*.pem
.vercel
.turbo
```

## 6. CI workflow (.github/workflows/ci.yml — missing — create it)

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main, master]
permissions:
  contents: read
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run build
      - run: npm audit --omit=dev --audit-level=high
  edge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - run: deno check supabase/functions/*/index.ts
```

Use `npm ci` only after committing `package-lock.json` (no lockfile currently exists).
Until then use `npm install`.

## 7. Known gaps

- No `package-lock.json` committed (supply-chain control gap) — run `npm install` locally
  and commit the generated lockfile.
- No test runner / no tests discovered.
- `next lint` is deprecated; replace with `eslint .` + the deps in step 2.
- The ~192 application type errors are pre-existing and belong to Phase 3 (3A-3D).