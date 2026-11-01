# HIIPS360
An officer support/guidance tool.

> **Read this first.** HIIPS360 is a prototype built to learn whether officers would use a digitized version of the HIIPS sheets. It does not connect to WorkSafeBC systems, it does not write the inspection report, and everything it shows is a suggestion the officer confirms, edits or sets aside. It supports the officer's judgement. It does not replace it, and it does not change the inspection process, the officer's authority or the regulation.

---

## Table of contents

1. [The problem](#the-problem)
2. [What HIIPS360 does](#what-hiips360-does)
3. [A walk through a site visit](#a-walk-through-a-site-visit)
4. [How it fits with the inspection report](#how-it-fits-with-the-inspection-report)
5. [Scope: MVP and what comes later](#scope-mvp-and-what-comes-later)
6. [Project status](#project-status)
7. [Who it is for](#who-it-is-for)
8. [Design principles](#design-principles)
9. [Technical overview](#technical-overview)
10. [Getting started](#getting-started)
11. [Working on the code](#working-on-the-code)
12. [Content and ownership](#content-and-ownership)
13. [How we will know whether it worked](#how-we-will-know-whether-it-worked)
14. [Risks and known limitations](#risks-and-known-limitations)
15. [Project documents](#project-documents)

---



## The problem

Prevention Field Services officers produce roughly 50,000 inspection reports a year, about a quarter of them in construction. On every visit the officer has to establish two things: what hazards the work carries, and whether the employer has identified and controlled them.

WorkSafeBC already has the answers written down.

- The **Hazard Identification Inspection Protocol Sheets (HIIPS)** are organized by classification unit. Each one pairs a hazard with the control expected and the regulation that governs it, and sets out the officer's own protective equipment and on-site practices.
- The **OHS Regulation app** searches the law by keyword.

Neither is reachable in the way an inspection needs:

- Each sheet is a PDF of twenty pages or more.
- The library cannot be searched as a set.
- The sheets are not linked to the regulation text they cite.
- The OHS Regulation app knows nothing about the hazards of a particular site.

So the officer bridges the two from memory. That works for familiar work and less well for everything else. A newer officer, or one assigned outside their usual area, has no accumulated pattern to draw on. Hazards that cross into other parts of the regulation are the hardest to catch. A wood framing site brings machine and equipment lockout through saw blade changes and temporary power, and an officer would not think to look for that under framing.

**The cost shows up as uneven inspection quality, not as a visible failure.** A hazard that is passed is a control the employer is never asked about.

## What HIIPS360 does

HIIPS360 makes what the sheets already contain available at the moment it is needed. It connects four things the officer currently holds together from memory:

```
  Type of work  ──▶  Hazards  ──▶  Controls expected  ──▶  Governing regulation
  (from a photo)     (incl. those      (with questions        (Act, OHS Regulation,
                     crossing in        to ask and the         policies, guidelines,
                     from other         order to consider      standards)
                     parts of the       them)
                     regulation)
```

| Capability | What the officer gets |
|---|---|
| **Identify the work** | Photograph the site and be offered the protocol sheet that applies. Confirm it or change it. |
| **Hazard guidance** | A list of the hazards for that work to walk the site against, including cross-over hazards that are easy to walk past. Detail stays out of the way until a hazard is opened. |
| **Controls and risk** | For an opened hazard: questions for the employer and workers, the controls that should be present, the order controls should be considered in, and what raises or lowers the risk. |
| **Regulation reference** | Move from a hazard directly to the wording of the requirement that governs it, without searching the law separately. |
| **Evidence and summary** | Attach photos to a hazard, or mark it not applicable to this site. Review a summary showing every hazard on the sheet was addressed before leaving. |

The hierarchy is where the value sits. Recognizing that a ladder carries a fall risk is the easy part. What follows is the order of consideration (aerial lift, then scaffold or work platform, then ladder) with the requirements for inspection, training and safe access. The sheets hold that reasoning. HIIPS360 delivers it at the site, so a hazard the officer can name becomes an inspection they can defend.

## A walk through a site visit

An officer pulls up to a residential construction site. It was booked as framing, but the crew is also forming concrete and there is a scaffold up the side of the building.

1. **Arrive and photograph.** HIIPS360 offers the protocol sheet for framing or residential forming and flags scaffolds as related work. The officer accepts both.
2. **Glance at the plan.** The sheet lists the protective equipment for this kind of site, which the officer already has, and raises questions about engineered drawings and fall protection.
3. **Walk the site.** Perimeter fall protection is in place, so the officer records a photo showing it was reviewed.
4. **Open a hazard that looks wrong.** A ladder to the second floor is not secured and sits at the wrong angle. The sheet shows the questions to ask, the controls that should be there, the angle and extension requirements, and the regulation behind them. The officer photographs it from two angles.
5. **Mark what does not apply.** Confined space does not arise, so the officer marks it not applicable.
6. **Catch the hazard that crosses in.** Table saws are running without guarding. The sheet raised this under lockout and safeguarding even though the site was booked as framing. The officer would not have looked for it. Another photo goes against that hazard.
7. **Review before leaving.** In the truck, the summary shows every hazard on the sheet is either reviewed with evidence attached or marked not applicable. Nothing was missed.
8. **Write the report as usual.** The officer moves on and writes the inspection report in the usual way, outside HIIPS360.

## How it fits with the inspection report

HIIPS360 sits *before and alongside* the report, not in it. The sample inspection report in this project (a fall protection stop-work inspection at a two-storey townhouse under construction with roofing underway) shows the chain of reasoning HIIPS360 is meant to support:

| Officer's observation | Governing requirement cited |
|---|---|
| Workers on a 5:12 sloped roof with no fall protection, exposed to a 24 ft fall onto hard ground | OHS Regulation 11.2(1)(a): a fall protection system is required when a fall of 3 m (10 ft) or more may occur |
| Damaged or untagged equipment, workers unable to inspect a harness, a supervisor who did not correct unsafe conditions | Workers Compensation Act 21(2)(e): instruction, training and supervision |
| High risk of serious injury or death | Workers Compensation Act 90(1)(a): stop-work order |

That hazard-to-control-to-requirement reasoning is what HIIPS360 makes reachable on site. The observations, the judgement and the orders remain entirely the officer's, and the report is still written in the usual way.

## Scope: MVP and what comes later

The MVP is the smallest version worth using. It runs from arrival to leaving the site, and an officer can start an inspection, work through it and finish it without leaving the tool.

**First release (MVP)**

- Identify the work from a photo taken on site, and confirm or change the sheet offered
- Show the hazards for that work, including those that cross in from other parts of the regulation
- Show the controls expected for each hazard, and the regulation that governs it
- Attach one or more photos to a hazard, or mark it not applicable
- Review the summary before leaving the site

See [Project status](#project-status) for how much of this is built.

**Left for later**

- Inspection preparation before the officer leaves: the plan, the protective equipment and site practices, and describing a job in words (typed or spoken) instead of photographing it
- Wider legal search across the Act, the Regulation, policies and guidelines together
- Employer conversation features: plain-language explanations of requirements, showing the employer a photo, and pointing to where a requirement is published

Each is useful, and none is needed to prove the concept holds.

## Project status

The app shell, sign-in and offline install are in place. The inspection flow itself (sheets, hazards, controls, regulation, photos, summary) is not built yet.

**Built so far**

| Area | What exists |
|---|---|
| App shell | Vite + React 19 app with an orange header, a sign-out button and a bottom icon nav (Home, Planning, Hazard, Summary). The layout is fluid rather than fixed-size. |
| Landing page (`/`) | Says plainly that this is a prototype, lists what the tool does, and offers to install the app. iOS gets "Add to Home Screen" help instead of an install button. |
| Sign-in | Register (`/register`) and sign-in (`/login`) pages backed by a real API. Every app route requires a signed-in user. |
| Auth API | Express 5 + Mongoose in `server/`: register, log in, log out and "who am I". Passwords are bcrypt hashes, failed sign-ins are rate-limited, and sessions are an httpOnly cookie stored in MongoDB. |
| Install | Installable PWA with a service worker. The last signed-in user is cached on the device, so an officer with no signal stays signed in. |
| Design tokens | WorkSafeBC colours and type as CSS custom properties in `src/styles/tokens.css`. |
| AI tests | `npm test` runs automated tests of the hazard suggestion feature (API route, Gemini service, browser helper) with Gemini mocked. `npm run test:ai-live` checks the real Gemini API. Results go in the team's Testing Log. |

**Still to build**

| Page or piece | State |
|---|---|
| Home (`/home`) | Page component exists but is empty |
| Planning (`/planning`) | Page component exists, placeholder text only |
| HIIPS content (sheets, hazards, controls, regulations) | Not modelled yet; no seed data |
| Photo matching | Not started |
| Saving inspections (hazards, photos, job sites) in MongoDB | Not built. Hazards are in memory and job sites are in localStorage |
| On-device inspection storage (Dexie/IndexedDB) | Deferred; see [Design principles](#design-principles) |
| `wsbc.css` / Bootstrap | Not installed; styling uses the local tokens for now |
| Automated tests for the rest of the app | Only the AI feature has them; auth and the pages are still tested by hand (see the Testing Log) |

## Who it is for

**Prevention officer.** Inspects workplaces across the range of work their region covers. Some of it they see constantly and know without thinking. Some they meet a few times a year, or for the first time. On any inspection they need the hazards that belong to the work in front of them, the controls that should be there, and the regulation behind both. The tool most helps a newer officer or one working outside their usual area, and it narrows the distance between an officer's strongest area and their least familiar one.

**Employers benefit indirectly.** Employers carry no written hazard assessment requirement, so the officer's ability to discuss hazards, controls and requirements is what moves their practice. An officer holding the hazard, the control and the requirement together can explain why something matters, not just cite the rule. That supports consult, educate and enforce.

## Design principles

- **Suggestion, not decision.** Every result can be confirmed, edited or set aside by the officer.
- **Reachable without the photo.** Identifying work from a photograph is the least certain part of the technology, so the guidance must be reachable by browsing the sheet library even when photo matching fails.
- **The site is the context.** Detail stays out of the way until the officer opens a hazard, and the officer should never be searching while standing in front of the work.
- **Works where the work is (deferred).** Field sites have poor or no connectivity, so a production tool would store inspection state on the device first and treat the network as optional. The team has deferred this for the prototype: inspections are saved to MongoDB through the API, and device-first storage and sync come later.
- **Follows the WorkSafeBC design system.** See [UI and design system](#ui-and-design-system).
- **Says what it is.** The prototype states plainly, at every showing, that it is a prototype and not a product.

## Technical overview

| Layer | Choice | Status | Why |
|---|---|---|---|
| Front end | React 19 + Vite, `react-router-dom` v7, plain JSX (no TypeScript) | Built | Component-based UI, and the design system's classes work with React (`react-bootstrap` or plain markup) |
| Install and offline shell | `vite-plugin-pwa` (Workbox service worker, web manifest) | Built | Officers add it to their home screen and it opens with no signal |
| API | Express 5 + Mongoose (ESM) in `server/` | Built, auth only | Holds accounts and sessions today; will hold the HIIPS content and the officer's inspections |
| Database | MongoDB 8.0, run locally per developer | Built, auth only | No online account needed. Atlas would only mean a different `MONGODB_URI` |
| On-device storage | Dexie.js (IndexedDB) | Deferred | Would let the tool keep working with no signal. Not a priority for the prototype |
| Styling | `src/styles/tokens.css` now; `wsbc.css` (Bootstrap 5.3 plus the WorkSafeBC layer) planned | Partial | Keeps the prototype visually and behaviourally consistent with WorkSafeBC applications |

### Project structure

```
server/
  index.js            Connects to MongoDB and starts the API
  app.js              Middleware, session, JSON error handler
  config.js           Reads and checks .env
  models/User.js      User model (name, email, bcrypt password hash)
  routes/auth.js      /api/auth: register, login, logout, me
  routes/ai.js        /api/ai: hazard suggestion from a photo and/or description
  services/gemini.js  The only file that talks to Gemini (main model + fallback)
tests/                Automated tests (node:test), run with npm test
scripts/
  ai-smoke.mjs        Live Gemini check, run with npm run test:ai-live
src/
  App.jsx             Every route, nested under the public and signed-in layouts
  components/
    Layout.jsx        Signed-in shell: header, <Outlet/>, bottom nav (NAV_ITEMS)
    PublicLayout.jsx  Header only, for the landing, login and register pages
    RequireAuth.jsx   Sends signed-out users to /login
    FormField.jsx     Labelled input with error message
  auth/
    authService.js    The only file that calls /api/auth
    AuthProvider.jsx  Session state; useAuth.js reads it
    validation.js     Form rules shared by the browser and the server
  pages/<Name>/       <Name>.jsx + <Name>.css, one folder per page
  pwa/useInstallPrompt.js
  styles/
    tokens.css        WorkSafeBC design tokens (--wsbc-*, --font-*, --fs-*)
    forms.css         Shared form styles
```

### Auth API

All routes are under `/api/auth`. Errors are always `{ error }` with a message that is safe to show the officer.

| Request | Body | Response |
|---|---|---|
| `POST /register` | `{ name, email, password }` | `201 { user }`, or `409` if the email is taken |
| `POST /login` | `{ email, password }` | `200 { user }`, or `401` |
| `POST /logout` | | `204` |
| `GET /me` | | `200 { user }`, or `401` |

`user` is `{ name, email }`. Sessions are an httpOnly cookie (`hiips360.sid`) stored in the `sessions` collection, and the session id is regenerated on every sign-in. Failed register and sign-in attempts are limited to 20 per 15 minutes. Passwords are capped at 72 characters because bcrypt ignores anything longer.

In development, Vite proxies `/api` to `localhost:3001`, so the browser only ever talks to one origin and no CORS setup is needed. The service worker never answers `/api` requests with the app shell.

### Data flow (planned)

The diagram shows the intended inspection flow. Only the MongoDB side exists so far, and it holds accounts, not HIIPS content. The app reads and saves through the API; on-device storage and sync are deferred.

```
 Site photo ─▶ Work matcher ─▶ Suggested sheet ─▶ Officer confirms / changes
                                                        │
                                                        ▼
            HIIPS content and inspections (MongoDB, via /api)
                                                        │
                        Hazard list ─▶ Hazard detail ─▶ Regulation text
                                                        │
                                      Photos / "not applicable" per hazard
                                                        │
                                                        ▼
                                              Inspection summary
```

### Core data (illustrative, not built yet)

**MongoDB collections** (illustrative)

```
sheets         id, classificationUnit, workType
hazards        id, sheetId, name              includes cross-over hazards
controls       id, hazardId, order            order = hierarchy of controls
regulations    id, citation                   e.g. "OHS 11.2(1)(a)"
inspections    id, userId, jobId, sheetId, updatedAt
hazardRecords  inspectionId + hazardId, state, officerAdded
photos         id, inspectionId, hazardId
```

**Per-hazard state** on an inspection is one of: *not yet addressed*, *reviewed with evidence attached*, or *not applicable to this site*. The summary is a view over these states, and any hazard still "not yet addressed" is listed so nothing is left behind.

### Where content comes from

All hazard, control, and regulation content comes from the existing HIIPS sheets and the published Act, Regulation, policies and guidelines. HIIPS360 does not author safety guidance.

### UI and design system

Built against the [WorkSafeBC UX/UI Design System](https://ux-static.online.dv.worksafebc.com/) (`wsbc.css` and Font Awesome 4.7).

- **Templates:** use one of the three provided (fixed, fluid or mixed). A mobile-first inspection flow will lean on the MobileSafe component set (action and tab bars, sliding cards, half and full modals, collapse lists, snackbars).
- **Typography and colour:** Halis headings with Noto Sans or Verdana body text, and the warm grey palette. Do not change fonts or colours. In code, use the variables in `src/styles/tokens.css` rather than hard-coded colours.
- **Buttons:** one primary per page, secondary buttons outlined, sentence-case action labels.
- **Feedback:** the autosave snackbar for save confirmation, and alerts at the top of the page with the alert icon.
- **Accessibility:** target WCAG 2.1 AA. Some default palette pairings fall short of AA contrast, for example white text on the standard blue button, white on orange, and orange text on white. The landing page uses black on orange (8.3:1) and a body-copy outline button (10.4:1) instead. Review these pairings with the UX team before release.
- **Touch targets:** at least 44px, and press feedback respects reduced motion.

## Getting started

Everything runs locally. No MongoDB Atlas account or other online service is needed, and each developer has their own database. [AUTH_BACKEND_SETUP.md](AUTH_BACKEND_SETUP.md) has the step-by-step version, including what the terminal should print and a full troubleshooting table.

**Prerequisites**

- Node.js 22.12 or newer
- MongoDB Community Server 8.0, installed as the Windows service `MongoDB`
- A modern mobile or desktop browser

```bash
# 1. Clone the repository
git clone https://github.com/anthonyherradura/comp_4800_g09_worksafebc_HIIPS360.git
cd comp_4800_g09_worksafebc_HIIPS360

# 2. Install dependencies
npm install

# 3. Make sure MongoDB is running (admin PowerShell, once)
#    Start-Service MongoDB

# 4. Configure environment, then set SESSION_SECRET in .env
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 5. Start the API and the app together
npm run dev:all
```

Open http://localhost:5173 and choose **Create an account**.

**Scripts**

| Command | Runs |
|---|---|
| `npm run dev:all` | API and Vite together (normal use) |
| `npm run dev:phone` | Same as `dev:all`, but Vite also listens on your network so a phone can open it. See **Trying it on a phone** below |
| `npm run dev` | Vite dev server only; proxies `/api` to `localhost:3001` |
| `npm run dev:api` | API only, restarts when `server/` changes |
| `npm run api` | API only, no restart on change |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serves the build (also proxies `/api`). Use this to test install and offline behaviour |
| `npm run lint` | ESLint |
| `npm test` | Automated tests in `tests/`. Gemini and the network are mocked, so they need no API, database or key, and use no quota |
| `npm run test:ai-live` | Sends about 10 real requests through the running API to Gemini and prints a results table. Start the API first. Uses your Gemini quota |

There is no `npm run seed` yet.

**Environment (`.env`)**

| Variable | Value |
|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/hiips360`. Use `127.0.0.1`, not `localhost`: Node tries IPv6 first and the Windows MongoDB only listens on IPv4. |
| `SESSION_SECRET` | A random 64-character hex string, different for each developer. |
| `PORT` | `3001`. `vite.config.js` proxies `/api` here. |
| `GEMINI_API_KEY` | Your own key from Google AI Studio. Only hazard suggestions need it; the API starts without it. |
| `GEMINI_MODEL` | The main model. Check the name against Google's models list if you get model-not-found errors. |
| `GEMINI_FALLBACK_MODEL` | Tried when the main model fails or takes more than 2.5 s. Leave it empty to turn the fallback off. |

`.env` is git-ignored. Never commit it, and don't share your secret or your key.

**Gemini free tier.** A free key allows about 5 requests a minute and 20 a day per model (Nov 2026). The fallback model has its own allowance, but a slow answer uses quota on both models. Once the allowance is used up, every suggestion fails with "The AI suggestion service isn't available right now" until it resets (daily at midnight Pacific time). Before a demo, don't spend your quota on `npm run test:ai-live`, or use a separate key.

**Testing**

`npm test` runs the automated tests (Node's built-in test runner, so there is nothing extra to install). Tests named `todo` cover known bugs: they show the bug without failing the run, and start passing once the bug is fixed. Each test name starts with an ID (`AI-`, `GEM-`, `CLI-`) that the Testing Log refers to.

`npm run test:ai-live` signs in as a local test account (`ai-smoke@hiips360.test`, created on the first run) and checks real Gemini answers against the reference scenario. It waits 13 s between requests to stay under the free-tier limit; set `AI_SMOKE_DELAY_MS=0` to turn the wait off. Pass a folder to also send your own photos: `npm run test:ai-live -- path/to/photos`.

**Trying it on a phone**

1. Put the phone and the laptop on the same Wi-Fi. Campus Wi-Fi usually stops devices from reaching each other; if the phone can't load the page, turn on the phone's hotspot and connect the laptop to it.
2. On Windows, set that network to **Private** (Settings > Network & internet > your connection > Network profile type). If Windows Firewall asks about Node.js, allow it on private networks.
3. Run `npm run dev:phone` and open the `Network:` address that Vite prints (for example `http://192.168.1.68:5173`) on the phone. Only port 5173 needs to be reachable; Vite passes `/api` on to the API.
4. Sign in and use the app. The camera works through the photo box on Add hazard. Installing to the home screen and offline use need HTTPS, so test those with a deployed build instead.

**Common problems**

| You see | Fix |
|---|---|
| `http proxy error ... ECONNREFUSED` in Vite, or a 502 | The API isn't running, or was still connecting. Use `npm run dev:all`. |
| `Could not connect to MongoDB` | Check `Get-Service MongoDB`; start it from an admin PowerShell. |
| Still signed in after stopping the API | Intended. The device remembers the last signed-in user for offline use. |
| `EADDRINUSE` on port 3001 or 5173 | An old server is still running, sometimes with no terminal open. Find it with `Get-NetTCPConnection -LocalPort 3001 -State Listen` and stop it with `Stop-Process -Id <OwningProcess>`. |
| Every hazard suggestion says the service isn't available | Look at the API terminal. A `429 RESOURCE_EXHAUSTED` means the Gemini free-tier allowance is used up (see above); a `503` means Gemini is busy, so try again shortly. |
| The phone can't open the page | Check that both devices are on the same network, that the network is Private, and that you used `npm run dev:phone`. See **Trying it on a phone** above. |

**Demo scenario (once the inspection flow is built):** Start a new inspection, choose (or photograph) a residential framing site, accept the suggested sheet, open the ladder hazard, attach a photo, mark confined space not applicable, then open the summary.

## Working on the code

- **Adding a page.** Create `src/pages/<Name>/<Name>.jsx` and `<Name>.css`, with `<div className="page-content">` as the root element. Don't use `content`: `wsbc.css` defines it for its tab panels (absolutely positioned, grey border), and it covers the header. Check a new generic class name against `wsbc.css` before using it. Add its route in `src/App.jsx`. If it belongs in the bottom nav, add an entry and an inline SVG icon to `NAV_ITEMS` in `src/components/Layout.jsx`.
- **Talking to the API.** Only `src/auth/authService.js` calls `/api/auth`. It returns `{ user }` or throws an Error whose message is safe to show.
- **Validation.** `src/auth/validation.js` is imported by both the forms and the server, so keep it free of browser APIs.
- **Match filename casing in imports.** Windows ignores case but Linux and CI don't, so `./HomePage.css` will break a build if the file is `Homepage.css`.
- **Check `package.json` before assuming a dependency exists.** `wsbc.css` and Bootstrap are planned but not installed; Dexie is deferred.
- **Keep the product rules in the code.** Anything the tool proposes must be editable or dismissible, sheets must be reachable without a photo, and the UI should say it is a prototype. Save inspection data through the API to MongoDB; offline first is deferred.

## Content and ownership

- **The content is WorkSafeBC's.** The tool makes existing HIIPS guidance reachable. It does not create or change it.
- **Named owner needed.** A production tool needs a business area to run it and a named owner and maintenance cycle for the content. Guidance that is quietly out of date is worse than a PDF an officer knows to check.
- **Every sheet names the type of work it covers.** That is what makes matching a photo or description to a sheet possible.

| Role | Name |
|---|---|
| Sponsor | _To be confirmed_ |
| Content owner | _To be confirmed_ |
| Prototype author | Stewart Rogers, Innovation Strategy & Services |
| Build team | BCIT Industry Sponsored Student Projects, Fall 2026 |

## How we will know whether it worked

The prototype exists to prompt a decision, not to prove a hypothesis. Three signals tell us whether it worked:

1. **The idea reads without explanation.** Officers follow the flow from work type to hazard to control to regulation unprompted. A demonstration that needs a preamble has not shown anything.
2. **Officers recognize their own work in it.** The signal that the concept holds is an officer naming a hazard they would otherwise have passed. Hearing that it only shows them what they already know is the signal that it does not.
3. **It attracts an owner.** A named sponsor or a request for a pilot is the outcome worth having. Polite enthusiasm that goes nowhere is a finding too.

## Risks and known limitations

- **The uncertainty is need, not technology.** Officers manage without this tool today, and the sheets are already written. Whether they would use a digitized version often enough, in the moments that matter, cannot be answered from a desk.
- **Most likely failure:** a tool that is useful in principle and unused in practice. If officers say it only shows them what they know, the value is in the content, not the delivery. That is worth learning early and cheaply.
- **Photo identification is uncertain.** Guidance must remain reachable without it.
- **A prototype can be mistaken for a product.** Say so plainly at every showing.
- **A convincing wrong answer would undermine the idea** in front of the people whose support it needs, so officers should review the demonstration scenarios first.
- **Cost beyond the prototype is unknown.** The student program carries the build. What a production version would cost and save cannot be estimated until the shape of the thing is known.
- **Ownership is unresolved.** See [Content and ownership](#content-and-ownership).

## Project documents

| Document | Purpose |
|---|---|
| Innovation Intake: HIIPS360 (September 2026) | The problem, value proposition, validation plan, risks and recommendation |
| Product Requirements Document (V11) | Personas, the site-visit scenario, MVP scope, and user stories by capability |
| Sample inspection report: fall protection stop-work | Example of the reasoning (observation, control, requirement) HIIPS360 supports |
| WorkSafeBC UX/UI Design System | Components, tokens and usage rules the UI must follow |
| [AUTH_BACKEND_SETUP.md](AUTH_BACKEND_SETUP.md) | Installing MongoDB, creating `.env`, running the API, and troubleshooting |

---

*HIIPS360 supports the officer's judgement and does not replace it. Prevention officers enforce the Workers Compensation Act and the OHS Regulation. This tool helps them connect what they see to the rule that governs it, and does not make that connection for them.*
