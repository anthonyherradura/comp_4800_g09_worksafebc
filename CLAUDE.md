# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HIIPS360 is a BCIT student prototype (Fall 2026) for WorkSafeBC: a mobile-first officer tool that digitizes the Hazard Identification Inspection Protocol Sheets (HIIPS). The flow it supports is job site → protocol sheet (picked by search, AI text or site photo) → hazards → controls (in hierarchy-of-controls order) → governing regulation → per-hazard photos or "not applicable" → summary. See `README.md` for the full product rationale. The current sprint's tasks are on the Trello board `COMP4800-GROUP9-SETM` (Sprint 4 as of Nov 2026). `PRD_AND_SPRINT.md`, where a developer has it, is a local PRD digest that isn't in the repo.

Product rules from the README that should shape the code:
- **Suggestion, not decision.** Everything the tool proposes (matched sheet, hazards) must be confirmable, editable or dismissible by the officer.
- **Reachable without the photo.** Sheets must also be reachable by browsing, since photo matching can fail.
- **Offline first is deferred.** The team has decided device-first storage and sync are not a priority. Persistence goes to MongoDB through the API (Mongoose models + `requireAuth` routes). Don't add Dexie or sync logic unless the sprint asks for it. What stays on the device: the cached session, the PWA shell and the offline search model. Saving needs a connection. A failed save shows a message under the header; comments and visit notes stay on screen and are retried every 15 seconds, held in memory only.
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
npm run test:db   # tests/db/ against a real MongoDB (plain local server is fine); needs MONGODB_TEST_URI, skips without it
npm run db:setup  # applies the jobs/photos validators + all indexes; safe to re-run, and needed after changing server/db/limits.js
npm run test:ai-live  # real Gemini check through the running API; spends quota

# One test file:
node --test --experimental-test-module-mocks tests/sheet-content.test.js

# One DB test (needs MONGODB_TEST_URI):
node --env-file-if-exists=.env --test --test-name-pattern="DB-20b" tests/db/jobs-api.test.js
```

Tests use Node's built-in `node:test` (Node 22.12+). Write a known bug as a `{ todo }` test so it shows without failing the run (none are open right now).

### MongoDB setup

MongoDB Server 8.0 runs locally as the Windows service `MongoDB` (`Start-Service MongoDB` from an admin PowerShell). Then `cp .env.example .env` and set `SESSION_SECRET`; the file explains how. No online account is needed. Atlas would only mean a different `MONGODB_URI`.

Run `npm run db:setup` once, and again after pulling changes. No replica set is needed: every write changes one document (a job holds its hazards), so nothing uses transactions.

`MONGODB_TEST_URI` is commented out in `.env.example`, so set it in `.env` or the shell. `node --env-file` doesn't override variables already set, so setting `MONGODB_URI` in the shell points the app at a separate database and keeps test accounts out of `hiips360`.

Hazard and sheet suggestions need `GEMINI_API_KEY` (each developer uses their own). Without a key the API still starts, and only `/api/ai/*` fails.

### Sheet data pipeline (rarely needed)

The sheet JSON, the search model and the embeddings are already committed. Re-run these only when adding a sheet PDF:
1. `python scripts/extract_sheets.py sheets-pdf src/data/sheets` (needs `pdfplumber`). It copies text word for word into chunks.
2. Put the PDF in `public/sheets-pdf/<sheetId>.pdf` (linked from Home and `/pdfs`).
3. `node scripts/download-model.mjs` (once, into `public/models/`), `node scripts/copy-ort.mjs` (into `public/ort/`), then `node scripts/build-embeddings.mjs` to rewrite `src/data/embeddings.json`.

## Architecture

The stack is Vite + React 19 + `react-router-dom` v7, written in plain JSX (no TypeScript). The backend is Express 5 + Mongoose, as ESM. Check `package.json` before assuming a dependency exists: `idb-keyval`, `minisearch` and `@huggingface/transformers` are installed; Dexie and Bootstrap/`wsbc.css` are not (`wsbc.css` comes from WorkSafeBC's CDN in `index.html`).

### What is stored where

| Data | Where | File |
| --- | --- | --- |
| Session user | localStorage `hiips360.session` + Mongo `sessions` | `src/auth/` |
| Job sites, each with its `sheetId`, checklist, visit notes and **hazards (embedded)** | MongoDB `jobs`, one document per job site, per officer | `server/models/Job.js`, `server/routes/jobs.js`, `src/context/JobContext.jsx` |
| Photos | MongoDB `photos`, one document per photo (bytes + `userId`, `jobId`, `hazardId`); the hazard keeps `photoIds` | `server/models/Photo.js`, `server/routes/photos.js` |
| Recently viewed sheets on Home | MongoDB `users.recentSheetIds` (3, newest first) | `server/routes/me.js`, `src/hooks/useRecentSheets.js` |
| Protocol sheets | JSON bundled in the app, read by the server too (never in the database) | `src/data/sheets/`, `server/services/sheetCatalog.js` |
| Users | MongoDB `users` | `server/models/User.js` |

Not stored, always worked out: hazard status, photo counts, a sheet hazard's stage/controls/legislation (read from the sheet by `sheetId` + `sheetKey`), Copy findings text, AI suggestions.

Older versions kept jobs in localStorage and hazards/photos in IndexedDB. `clearOldDeviceData()` (`src/data/store.js`, called from `main.jsx`) deletes them once per device: the team chose a fresh start over migrating test data.

### Frontend

- `src/App.jsx`: all routes. Public pages (`/`, `/login`, `/register`) use `PublicLayout` (header, no nav). Signed-in pages are wrapped in `RequireAuth` → `JobProvider` → `HazardProvider`. `/jobs` uses `<Layout showNav={false}/>`; the rest use `<Layout/>`. The Dashboard tab was removed (Oct 2026), and the separate Summary page was removed (Nov 2026, d8bb244) when the Hazards list took over its job. Don't add either back without asking the team. Routes that need a fixed path under `/hazard/` must be declared before `/hazard/:id`, or the detail page treats the word as a hazard id.
- `src/components/Layout.jsx`: the header, the `<Outlet/>`, and the bottom nav driven by `NAV_ITEMS`. A new top-level page needs entries in both `App.jsx` and `NAV_ITEMS`.
- `src/pages/<Name>/<Name>.jsx` + `<Name>.css`: one folder per page. Never use a bare `content` class: `wsbc.css` defines `.content` as `position:absolute; inset:28px 0 0` with a grey border, which covers the header.
- **Sheet data** (`src/data/sheets/`): every `*.json` in the folder is loaded through `import.meta.glob`, so dropping in a file adds a sheet. `catalog.js` and `sheetContent.js` are plain ESM with no Vite features, because the server and `node --test` import them too. Keep them that way. `sheetContent.js` parses the two sheet layouts ("Hazard: … Control: … Legislation: …" blocks, and "Does this industry … contain hazards relating to X?" questions, where a named topic listed after the "other specific hazards" question is a hazard too) into hazards and the Preparation / PPE / Arrival / Walk through checklist.
- `src/data/syncSheetHazards.js`: a pure function over one job's hazards deciding what happens when its sheet changes. It adds the new sheet's hazards (`source: "sheet"`, `sheetId`, `sheetKey`), removes old sheet hazards only if nobody has worked on them (no photo, comment or not applicable), and never touches officer-added hazards (`source: "officer"`). The server runs it (`PUT /api/jobs/:jobId/sheet`); keep it plain ESM.
- `src/context/JobContext.jsx` holds `jobs` and `currentJob` (the most recently opened job, with its hazards), and renders a loading/"Try again" screen until the jobs have loaded. All calls go through `src/data/api.js`.
- **Saving.** Saves that wait for typing to pause (comments, visit notes) share one `createSaveQueue()`, and every other change flushes it first, so changes reach the server in order. A save that fails for a temporary reason (no connection, 5xx) goes back in with `retryLater`. Answers to queued saves must go through `confirmSavedJob`, not `replaceCurrentJob`: a late retry must never change which job is current.
- `src/context/HazardContext.jsx`: hazards come from `currentJob.hazards`, and each change answers with the updated job. Comment and not-applicable edits show at once as drafts on top of the job until the server confirms them, and a failed save keeps its draft so the text stays in the box. Photos are shrunk (`shrinkImage`, 1600px JPEG) before upload, and `photos` is a list of `/api/photos/<id>` URLs. Passing `photos` to `updateHazard` means "keep only these".
- **Planning visit notes** are shown from `currentJob.visitNotes`, with unconfirmed drafts applied by `JobContext`. Don't keep a second copy in the page: it goes stale when the page remounts.
- `src/data/hazardStatus.js`: hazard status (`unaddressed`, `reviewed`, `na`) is derived, never stored. `notApplicable` wins, then any photo counts as reviewed. Use `getHazardStatus`/`groupByStatus`.
- **Hazards** (`/hazard`) is also the summary. It records findings only and never states compliance (PRD hard limits 1 and 2). "Copy findings" is plain text for the officer's own report.
- `src/search/sheetSearch.js`: offline hybrid search over sheet chunks, merging MiniSearch keyword matches with MiniLM embeddings by reciprocal rank fusion. Keyword search still works if the model fails to load. It is only used on `/sheets`, which nothing in the app links to. Matches below `MIN_SIMILARITY` are hidden, but that page can still list the same sheet more than once (B-18).
- `src/pages/Hazard/suggestHazard.js` and `src/pages/Homepage/matchSheets.js` are the only files that call `/api/ai`. Both post `FormData` (`text`, `photo`) and throw Errors with messages that are safe to show.
- `src/auth/`: `authService.js` is the only file that talks to `/api/auth`. The last signed-in user is cached in localStorage so an officer with no signal stays signed in, and a real 401 clears it. `validation.js` is shared by the browser **and** the server, so keep it free of browser APIs.
- `src/data/store.js` has `newId()`. Use it instead of `crypto.randomUUID()`, which only exists over HTTPS/localhost and breaks when testing on a phone over LAN HTTP.
- PWA: `vite-plugin-pwa`, configured in `vite.config.js` (which keeps `/api/` out of the navigate fallback). Icons in `public/` are generated from `pwa-assets.config.js` + `public/logo.svg`.
- `src/styles/tokens.css`: WorkSafeBC design tokens (`--wsbc-*` colours, `--font-*`, `--fs-*`). Page CSS depends on these, so don't use hard-coded colours.

### Backend (`server/`)

- `index.js` connects and listens. `app.js` holds the middleware, the session (httpOnly cookie `hiips360.sid` stored in the Mongo `sessions` collection via connect-mongo) and the JSON error handler. Errors are always `{ error }`.
- `middleware/requireAuth.js`: answers 401 `{ error: "Not signed in." }` when there is no session, and otherwise sets `req.userId`. Put it on any route that needs an officer.
- `routes/ai.js`: both routes use `requireAuth`, share a limit of 30 requests per 15 minutes, and take multipart `text` and/or `photo`. `POST /api/ai/suggest-hazard` returns one hazard name, plus `matchId` when given the job's hazards, which powers Log hazard's "Similar to …". `POST /api/ai/match-sheet` returns up to 3 `{ sheetId, reason }` from the catalogue, and drops unknown or repeated ids.
- `services/gemini.js`: the only place that talks to Gemini. It races `GEMINI_MODEL` against `GEMINI_FALLBACK_MODEL` and then `GEMINI_SECOND_FALLBACK_MODEL` when one is slow (>2.5 s) or fails. Set a fallback to empty in `.env` to turn it off. Officer text is treated as data, not instructions. `services/sheetCatalog.js` builds the catalogue Gemini picks from out of the same `src/data/sheets/*.json`.
- `routes/jobs.js`, `routes/photos.js`, `routes/me.js`: the data API (route list at the top of each file). Every route uses `requireAuth`, and every query includes the session's `userId`, so another officer's job, hazard or photo answers 404. Changes answer with the whole updated job `{ job }`. Ids in URLs that aren't ObjectIds also get 404 (`routes/ids.js`). `tests/db/jobs-api.test.js` covers each route, ownership, races and the limits.
- `routes/photos.js` answers `private, no-cache` with an `ETag` on purpose: a long `max-age` would let the browser cache get around the ownership check on a shared device.
- `models/Job.js`: one document per job site with its hazards **embedded** (a sheet change or a delete touches one document, so it can't half-happen). Unique `{ userId, label }` ignoring case (collation strength 2) and `{ userId, lastOpenedAt: -1 }` for the list. `rev` goes up on every update; `PUT /sheet` writes only if `rev` hasn't moved since it read the job, and otherwise redoes the sync on the fresh copy.
- `db/limits.js`: every limit (200 hazards per job, 20 photos per hazard, 10 MB per photo, text lengths, 3 recent sheets). Models, routes and validators read it; after changing a number run `npm run db:setup`. `db/validators.js`: MongoDB `$jsonSchema` validators for `jobs` and `photos` built from the limits, as a backstop under the Mongoose rules. `tests/db-schema.test.js` checks the two agree. `db/setup.js` applies them, builds indexes, and lists collections left from the earlier 14-collection design so they can be dropped by hand.
- Write order when two collections are involved: a photo is saved before its id goes on the hazard (and deleted again if that fails); on delete, the hazard/job goes first and its photos after. A failure in between leaves only an unreachable photo, never a broken image.

## Design system constraints

The UI follows the WorkSafeBC UX/UI Design System (README, "UI and design system"):
- Do not change the fonts (Halis headings, Noto/Verdana body) or the palette. Use the tokens.
- Use one primary button per page and outline secondary buttons. Action labels are sentence case.
- Target WCAG 2.1 AA. The README notes that some default pairings fail contrast, for example orange H2 text on white.
- For mobile patterns (action and tab bars, sliding cards, modals, collapse lists, snackbars), follow the MobileSafe component set.

## Gotchas

- Import paths are case-sensitive on Linux/CI but not on Windows, where this team develops. The component `HomePage` lives in `Homepage/Homepage.jsx`. `App.jsx` also declares `/sheets` and `/sheets/:sheetId` twice.
- `npm run build` currently fails (B-14): vite-plugin-pwa won't precache the onnxruntime `.wasm` files (17–28 MB each, over Workbox's 2 MiB limit). The fix belongs in the `workbox` options in `vite.config.js` (`globIgnores` for `*.wasm`, or a higher `maximumFileSizeToCacheInBytes`). `npm run lint` also has 2 known errors (B-15).
- Known bugs are tracked in the team's Google Sheet `S3_TestingLog_G09` (Test Cases, Test Runs, Bugs; IDs `TC-nn` and `B-nn`). Code comments and commits refer to those IDs.
- `npm run dev:api` uses `node --watch`, which also restarts when files in `node_modules` change (e.g. right after `npm install`). A 502 just after startup usually means the API is mid-restart; wait for "MongoDB connected".
- Use `mongodb://127.0.0.1`, not `localhost`, in `MONGODB_URI`. Node tries IPv6 `::1` first, and the Windows mongod only listens on IPv4.
- If Vite logs `http proxy error ... ECONNREFUSED` (502 in the browser), the API isn't running or hasn't finished connecting yet.
- `GEMINI_API_KEY` is never imported into `src/`. Anything under `src/` ends up in the public bundle. AI calls go through `/api/ai`.
- If you get model-not-found errors, check `GEMINI_MODEL` and the fallback names in `.env` against the Gemini models list. `.env` values win over the defaults in `gemini.js`.
- Outside production, the 502 from `/api/ai` includes the raw Gemini error message. In production it is hidden.
- `src/data/recentSheets.js` is now used only for `formatOpened` on the Jobs page. Home's "Recently viewed" list comes from `src/hooks/useRecentSheets.js` (the API).
