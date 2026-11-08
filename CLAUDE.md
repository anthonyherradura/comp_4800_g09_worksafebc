# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HIIPS360 is a BCIT student prototype (Fall 2026) for WorkSafeBC: a mobile-first officer tool that digitizes the Hazard Identification Inspection Protocol Sheets (HIIPS). The flow it supports is job site → protocol sheet (picked by search, AI text or site photo) → hazards → controls (in hierarchy-of-controls order) → governing regulation → per-hazard photos or "not applicable" → summary. See `README.md` for the full product rationale, and `PRD_AND_SPRINT.md` for the PRD digest and the current sprint's tasks.

Product rules from the README that should shape the code:
- **Suggestion, not decision.** Everything the tool proposes (matched sheet, hazards) must be confirmable, editable or dismissible by the officer.
- **Reachable without the photo.** Sheets must also be reachable by browsing, since photo matching can fail.
- **Offline first is deferred.** The team has decided device-first storage and sync are not a priority. New persistence goes to MongoDB through the API (Mongoose models + `requireAuth` routes). Don't add Dexie or sync logic unless the sprint asks for it. The device storage that already exists (hazards and photos in IndexedDB, jobs in localStorage, the cached session, the PWA shell, the offline search model) stays as it is until it is replaced by API calls.
- **Says what it is.** The UI should state plainly that this is a prototype.

## Commands

```bash
npm install
npm run dev:all   # API + Vite together (what you normally want)
npm run dev:phone # same, but Vite listens on the LAN so a phone can open it
npm run dev       # Vite dev server only; proxies /api to localhost:3001
npm run dev:api   # API only, restarts on change (node --watch, reads .env)
npm run api       # API only, no watch
npm run build     # production build to dist/
npm run preview   # serve the built app (also proxies /api)
npm run lint      # ESLint (flat config in eslint.config.js)
npm test          # node:test suites in tests/*.test.js (Gemini, fetch and DB mocked; no API, DB or key needed)
npm run test:db   # tests/db/ against a real MongoDB replica set; needs MONGODB_TEST_URI, skips without it
npm run db:setup  # applies collection validators + indexes and loads the sheets into MongoDB; safe to re-run
npm run test:ai-live  # real Gemini check through the running API; spends quota

# One test file:
node --test --experimental-test-module-mocks tests/sheet-content.test.js
```

Tests use Node's built-in `node:test` (Node 22.12+). Known bugs are written as `{ todo }` tests so they show without failing the run.

### MongoDB setup

MongoDB Server 8.0 runs locally as the Windows service `MongoDB` (`Start-Service MongoDB` from an admin PowerShell). Then `cp .env.example .env` and set `SESSION_SECRET`; the file explains how. No online account is needed. Atlas would only mean a different `MONGODB_URI`.

`server/db/operations.js` uses transactions, so MongoDB must run as a **single-node replica set** (`replSetName: rs0` in `mongod.cfg`, restart, `mongosh --eval "rs.initiate()"`). `npm run db:setup` checks this and prints these steps if it isn't. Auth alone works on a standalone server.

Hazard and sheet suggestions need `GEMINI_API_KEY` (each developer uses their own). Without a key the API still starts, and only `/api/ai/*` fails.

### Sheet data pipeline (rarely needed)

The sheet JSON, the search model and the embeddings are already committed. Re-run these only when adding a sheet PDF:
1. `python scripts/extract_sheets.py sheets-pdf src/data/sheets` (needs `pdfplumber`). It copies text word for word into chunks.
2. Put the PDF in `public/sheets-pdf/<sheetId>.pdf` (linked from Home and `/pdfs`).
3. `node scripts/download-model.mjs` (once, into `public/models/`), `node scripts/copy-ort.mjs` (into `public/ort/`), then `node scripts/build-embeddings.mjs` to rewrite `src/data/embeddings.json`.

## Architecture

The stack is Vite + React 19 + `react-router-dom` v7, written in plain JSX (no TypeScript). The backend is Express 5 + Mongoose, as ESM. Check `package.json` before assuming a dependency exists: `idb-keyval`, `minisearch` and `@huggingface/transformers` are installed; Dexie and Bootstrap/`wsbc.css` are not (`wsbc.css` comes from WorkSafeBC's CDN in `index.html`).

### What is stored where (today)

| Data | Where | File |
| --- | --- | --- |
| Session user | localStorage `hiips360.session` + Mongo `sessions` | `src/auth/` |
| Job sites, each job's `sheetId` and checklist status | localStorage `hiips360.jobs.<email>` | `src/context/JobContext.jsx` |
| Hazards and their photos | IndexedDB (`idb-keyval`, db `hiips360`, store `kv`): key `hiips360.hazards`, one `photo:<id>` record per photo. Shared by every officer on the device (bug B-13) | `src/context/HazardContext.jsx`, `src/data/store.js` |
| Recently viewed sheets on Home | IndexedDB key `hiips360.recentSheets`, also shared by every officer (bug B-21) | `src/pages/Homepage/Homepage.jsx` |
| Protocol sheets | JSON bundled in the app, read by the server too | `src/data/sheets/` |
| Users | MongoDB `users` | `server/models/User.js` |

The MongoDB schema for jobs, inspections, hazards, photos, AI suggestions and summaries exists in `server/` but **no API route uses it yet**. Moving device data to the server means adding routes over `server/db/operations.js` and then changing only `JobContext.jsx` / `HazardContext.jsx`. Both contexts are written so they are the only frontend files that need to change.

### Frontend

- `src/App.jsx`: all routes. Public pages (`/`, `/login`, `/register`) use `PublicLayout` (header, no nav). Signed-in pages are wrapped in `RequireAuth` → `JobProvider` → `HazardProvider`. `/jobs` uses `<Layout showNav={false}/>`. The rest use `<Layout/>`: `/home`, `/planning`, `/sheets`, `/sheets/:sheetId`, `/pdfs`, `/hazard`, `/hazard/new` and `/hazard/:id`. The Dashboard tab was removed (Oct 2026), and the separate Summary page was removed (Nov 2026, d8bb244) when the Hazards list took over its job. Don't add either back without asking the team. Routes that need a fixed path under `/hazard/` (e.g. `/hazard/search`) must be declared before `/hazard/:id`, or the detail page treats the word as a hazard id.
- `src/components/Layout.jsx`: the orange header (with a job button that goes to `/jobs`, and sign out), the `<Outlet/>`, and the bottom nav driven by `NAV_ITEMS` (Home, Planning, Hazards) with inline SVG icons. A new top-level page needs entries in both `App.jsx` and `NAV_ITEMS`.
- `src/pages/<Name>/<Name>.jsx` + `<Name>.css`: one folder per page. Page root classes vary: `page-content` (Homepage, auth pages, Landing, Sheets, Pdfs), `jobs-page`, `planning-page`, `hz-page` and `hl-page` (Hazards list). Never use a bare `content` class: `wsbc.css` defines `.content` as `position:absolute; inset:28px 0 0` with a grey border, which covers the header. `src/pages/Hazard/` holds `HazardList`, `HazardAdd`, `HazardDetail`, `HazardSearch` (a "coming soon" placeholder with no route yet, bug B-22), `SheetSearch` and `formatFindings.js`, sharing `Hazard.css` and `HazardIcons.jsx`.
- **Jobs** (`src/pages/Jobs/`): the first screen after sign-in, with a word search over saved jobs. `currentJob` is simply the most recently opened job, and adding a label that already exists reopens it. Opening or creating a job goes to `/home`.
- **Home** (`src/pages/Homepage/`): picks the protocol sheet for the current job. Three ways: word search over sheet names (`matchesWords` from `catalog.js`; says "0 of N sheets match" when nothing does), "Ask AI" with a text description (Enter in the search box also asks AI), or a site photo. The last two go through `matchSheets.js` → `POST /api/ai/match-sheet` and show up to three suggestions with a reason. The AI answer is not cleared when the text changes (bug B-20). With nothing typed, Home lists "Recently viewed" sheets (`MAX_RECENT` = 3, filled from `DEFAULT_RECENT` when the officer has viewed fewer). Picking a sheet calls `setJobSheet` and `applySheet`.
- **Sheet data** (`src/data/sheets/`): every `*.json` in the folder is loaded through `import.meta.glob`, so dropping in a file adds a sheet. `index.js` exposes `SHEETS`, `SHEET_CATALOG`, `getSheetHazards`, `getSheetHazard` and `getSheetChecklist`. `catalog.js` and `sheetContent.js` are plain ESM with no Vite features, because the server and `node --test` import them too. Keep them that way. `sheetContent.js` parses the two sheet layouts ("Hazard: … Control: … Legislation: …" blocks, and "Does this industry … contain hazards relating to X?" questions) into hazards and the Preparation / PPE / Arrival / Walk through checklist.
- `src/data/syncSheetHazards.js`: a pure function deciding what happens to a job's hazards when its sheet changes. It adds the new sheet's hazards (`source: "sheet"`, `sheetId`, `sheetKey`, `stage`), removes old sheet hazards only if nobody has worked on them (no photo, comment or not applicable), and never touches officer-added hazards.
- `src/context/HazardContext.jsx`: `hazards`, `addHazard`, `updateHazard`, `addPhotos`, `deleteHazard` and `applySheet`. It persists with `usePersistentState` (`src/hooks/`), which renders nothing until IndexedDB has loaded, so the empty initial value never overwrites saved data. Photos are shrunk (`shrinkImage`, 1600px JPEG) and stored as Blobs, and the exposed `photos` array is object URLs made from them. Passing `photos` to `updateHazard` means "keep only these". Pages only see hazards for the current job (`worksiteId === currentJob.id`); hazards without a `worksiteId` (from before jobs existed) show everywhere.
- `HazardDetail` has a Guidance tab that reads the stage, controls and legislation from the sheet by `sheetId` + `sheetKey`. It isn't copied into the hazard.
- **Planning** (`src/pages/Planning/`): the current sheet's checklist, with status per item (`pending` / `ready` / `not-applicable`) saved on the job by `setChecklistStatus`. Notes are not saved.
- `src/data/hazardStatus.js`: hazard status (`unaddressed`, `reviewed`, `na`) is derived, never stored. `notApplicable` wins, then any photo counts as reviewed. Use `getHazardStatus`/`groupByStatus`.
- **Hazards** (`/hazard`, `src/pages/Hazard/HazardList.jsx`): also the summary. It shows counts per status (Unaddressed / Reviewed / Not applicable), hazards grouped by status (`groupByStatus`), a "Not applicable" button per hazard, Search (links to `/hazard/search`, not routed yet) and Add hazard, and "Copy findings" (`formatFindings.js`, plain text for the officer's own report). It records findings only and never states compliance (PRD hard limits 1 and 2).
- `src/search/sheetSearch.js`: offline hybrid search over sheet chunks. It combines MiniSearch keyword matching with MiniLM embeddings (`@huggingface/transformers`, model under `public/models/`, vectors in `src/data/embeddings.json`), merged with reciprocal rank fusion. Keyword search still works if the model fails to load. It is only used by `SheetSearch` on `/sheets`, which nothing in the app links to. That page still lists weak matches and the same sheet more than once (B-18).
- `src/pages/Hazard/suggestHazard.js` and `src/pages/Homepage/matchSheets.js` are the only files that call `/api/ai`. Both post `FormData` (`text`, `photo`) and throw Errors with messages that are safe to show.
- `src/auth/`: `authService.js` is the only file that talks to `/api/auth` (`{ user: { name, email } }` or an Error with a message safe to show). The last signed-in user is cached in localStorage so an officer with no signal stays signed in, and a real 401 clears it. `validation.js` is shared by the browser **and** the server, so keep it free of browser APIs.
- `src/data/store.js` also has `newId()`. Use it instead of `crypto.randomUUID()`, which only exists over HTTPS/localhost and breaks when testing on a phone over LAN HTTP.
- PWA: `vite-plugin-pwa`, configured in `vite.config.js` (which keeps `/api/` out of the navigate fallback). The install prompt is `src/pwa/useInstallPrompt.js`, and icons in `public/` are generated from `pwa-assets.config.js` + `public/logo.svg`.
- `src/styles/tokens.css`: WorkSafeBC design tokens (`--wsbc-*` colours, `--font-*`, `--fs-*`). Page CSS depends on these, so don't use hard-coded colours.

### Backend (`server/`)

- `index.js` connects and listens. `app.js` holds the middleware, the session (httpOnly cookie `hiips360.sid` stored in the Mongo `sessions` collection via connect-mongo) and the JSON error handler. Errors are always `{ error }`.
- `middleware/requireAuth.js`: answers 401 `{ error: "Not signed in." }` when there is no session, and otherwise sets `req.userId`. Put it on any route that needs an officer.
- `routes/ai.js`: both routes are behind `requireAuth` and a shared limit of 30 requests per 15 minutes, and take multipart data: optional `text` (500 characters at most) and optional `photo` (one JPEG/PNG/WebP under 10 MB, in memory via multer). At least one is required.
  - `POST /api/ai/suggest-hazard` → `{ suggestion }` (one hazard name of 2–8 words, or `No hazard identified`). With an optional `hazards` field (JSON list of the job's `{ id, name }`) it also returns `matchId`: the hazard it is the same as, or null. Add Hazard then offers "Similar to …", and Accept adds to that hazard.
  - `POST /api/ai/match-sheet` → up to 3 `{ sheetId, reason }` from the catalogue. Unknown or repeated ids are dropped.
- `services/gemini.js`: the only place that talks to Gemini. It races `GEMINI_MODEL` against `GEMINI_FALLBACK_MODEL` and then `GEMINI_SECOND_FALLBACK_MODEL` when one is slow (>2.5 s) or fails. Set a fallback to empty in `.env` to turn it off. Officer text is treated as data, not instructions. `services/sheetCatalog.js` builds the catalogue Gemini picks from out of the same `src/data/sheets/*.json`.
- `models/`: the MongoDB schema, ported from a PostgreSQL ERD. `models/index.js` exports `COLLECTIONS` in dependency order, and each model exports a `$jsonSchema` `validator` that `db:setup` applies to the collection. `tests/db-models.test.js` checks that the Mongoose schema and the validator agree, so change both together.
- `db/operations.js`: **every write that touches more than one collection goes through here**, inside `inTransaction`. It checks references (no orphans), cascades deletes, and bumps `inspections.revision` on hazard, photo or sheet changes. An inspection can only be completed after a Summary review of the current revision. Rule violations throw `DataRuleError` (`NOT_FOUND` | `RULE` | `CONFLICT`) with officer-safe messages.
- `db/summary.js`: `buildSummary` is pure (testable without a DB). `getInspectionSummary` loads and runs it. `db/setup.js` + `db/referenceData.js` are shared by `scripts/db-setup.mjs` and `tests/db/integration.test.js`. Call `manualSchemaControl()` before connecting there, or Mongoose auto-creates collections without validators.

## Design system constraints

The UI follows the WorkSafeBC UX/UI Design System (README, "UI and design system"):
- Do not change the fonts (Halis headings, Noto/Verdana body) or the palette. Use the tokens.
- Use one primary button per page and outline secondary buttons. Action labels are sentence case.
- Target WCAG 2.1 AA. The README notes that some default pairings fail contrast, for example orange H2 text on white.
- For mobile patterns (action and tab bars, sliding cards, modals, collapse lists, snackbars), follow the MobileSafe component set.

## Gotchas

- Import paths are case-sensitive on Linux/CI but not on Windows, where this team develops. The component `HomePage` lives in `Homepage/Homepage.jsx`. `App.jsx` currently imports `./pages/sheets/SheetsPage` while the folder is `Sheets`, which would break a Linux build (B-16). `App.jsx` also declares `/sheets` and `/sheets/:sheetId` twice.
- `npm run build` currently fails (B-14): vite-plugin-pwa won't precache the onnxruntime `.wasm` files (17–28 MB each, over Workbox's 2 MiB limit). The fix belongs in the `workbox` options in `vite.config.js` (`globIgnores` for `*.wasm`, or a higher `maximumFileSizeToCacheInBytes`). `npm run lint` also has 3 known errors (B-15).
- Known bugs are tracked in the team's Google Sheet `S3_TestingLog_G09` (Test Cases, Test Runs, Bugs; IDs `TC-nn` and `B-nn`). Code comments and commits refer to those IDs.
- `npm run dev:api` uses `node --watch`, which also restarts when files in `node_modules` change (e.g. right after `npm install`). A 502 just after startup usually means the API is mid-restart; wait for "MongoDB connected".
- Use `mongodb://127.0.0.1`, not `localhost`, in `MONGODB_URI`. Node tries IPv6 `::1` first, and the Windows mongod only listens on IPv4.
- If Vite logs `http proxy error ... ECONNREFUSED` (502 in the browser), the API isn't running or hasn't finished connecting yet.
- `GEMINI_API_KEY` is never imported into `src/`. Anything under `src/` ends up in the public bundle. AI calls go through `/api/ai`.
- If you get model-not-found errors, check `GEMINI_MODEL` and the fallback names in `.env` against the Gemini models list. `.env` values win over the defaults in `gemini.js`.
- Outside production, the 502 from `/api/ai` includes the raw Gemini error message. In production it is hidden.
- `src/data/recentSheets.js` is now used only for `formatOpened` on the Jobs page. Home no longer has a recent-sheets list.
