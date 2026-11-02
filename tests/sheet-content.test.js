// src/data/sheets/sheetContent.js (hazards and checklist from a sheet) and
// src/data/syncSheetHazards.js (what a job's hazard list does when its sheet changes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sheetChecklist, sheetHazards } from "../src/data/sheets/sheetContent.js";
import { syncSheetHazards } from "../src/data/syncSheetHazards.js";

const readSheet = (file) => JSON.parse(readFileSync(new URL(`../src/data/sheets/${file}.json`, import.meta.url)));
const logTransport = readSheet("cu-732044-log-transport");
const longTermCare = readSheet("cu-766011-long-term-care");

test("CON-01 control-table sheet: one hazard per Hazard block, with stage, controls and legislation", () => {
    const hazards = sheetHazards(logTransport);
    assert.equal(hazards.length, 40);
    assert.deepEqual(hazards[1], {
        key: "cu-732044-011",
        name: "Inappropriate or non–use of seatbelt",
        stage: "Site Prep – Driver Orientation",
        details: [],
        controls: ["Drivers are required by regulation and the law to wear seatbelts at all times"],
        legislation: hazards[1].legislation,
        regulations: ["OHSR 16.32", "OHSR 16.33"],
    });
    assert.match(hazards[1].legislation, /^OHSR Section 16\.32/);
});

test("CON-02 a block with only controls joins the hazard above it; a lone Note is skipped", () => {
    const hazards = sheetHazards(logTransport);
    const unguarded = hazards.find((h) => h.key === "cu-732044-021");
    assert.equal(unguarded.controls.length, 4);
    assert.match(unguarded.controls[3], /^Log deck piles should be safe/);
    assert.ok(!hazards.some((h) => h.key === "cu-732044-022" || h.key === "cu-732044-041"));
});

test("CON-03 extra hazard bullets become details, not part of the name", () => {
    const cab = sheetHazards(logTransport).find((h) => h.key === "cu-732044-015");
    assert.equal(cab.name, "Not maintaining a secure operators cab");
    assert.deepEqual(cab.details, ["In the event of a collision or rollover drivers can be struck by loose tools or equipment"]);
});

test("CON-04 question-style sheet: hazard names come from the questions, regulations are matched by topic", () => {
    const hazards = sheetHazards(longTermCare);
    assert.equal(hazards.length, 14);
    const names = hazards.map((h) => h.name);
    for (const name of ["Confined space entry", "Violence in the workplace", "Musculoskeletal injuries (MSI)", "Hazards requiring respiratory programs", "Latex"]) {
        assert.ok(names.includes(name), name);
    }
    assert.deepEqual(hazards.find((h) => h.name === "Working alone").regulations, ["OHSR 4.20.1-4.23"]);
    // "Working from heights" must not pick up the Working alone regulation
    assert.equal(hazards.find((h) => h.name === "Working from heights").legislation, "");
});

test("CON-05 checklist: Preparation, Arrival and Walk through items, grouped, with sub-bullets folded in", () => {
    const items = sheetChecklist(logTransport);
    assert.deepEqual([...new Set(items.map((i) => i.group))], ["Before you go", "On arrival", "Walking the site"]);
    assert.equal(items.length, 13);
    assert.equal(items[0].label, "Bring and wear all appropriate PPE. When climbing under the truck, wear safety eyewear.");
    assert.equal(new Set(items.map((i) => i.id)).size, items.length);
});

test("CON-06 checklist from a PPE section is split into sentences", () => {
    assert.deepEqual(
        sheetChecklist(longTermCare).map((i) => i.label),
        ["PPE according to the site’s ECPs and safe work procedures.", "Respiratory protection if unable to receive flu immunization."]
    );
});

// ---------- syncSheetHazards ----------
let counter = 0;
const makeId = () => `h${++counter}`;
const now = new Date("2026-11-02T18:00:00Z");
const A = [{ key: "a1", name: "Hazard A1", stage: "Loading" }, { key: "a2", name: "Hazard A2", stage: null }];
const B = [{ key: "b1", name: "Hazard B1", stage: null }];
const sync = (hazards, jobId, sheetId, sheet) => syncSheetHazards(hazards, { jobId, sheetId, sheetHazards: sheet, makeId, now });

test("SYNC-01 picking a sheet adds its hazards to that job, marked as from the sheet", () => {
    const result = sync([], "job1", "sheet-a", A);
    assert.deepEqual(result.map((h) => [h.name, h.worksiteId, h.source, h.sheetId, h.sheetKey, h.stage]), [
        ["Hazard A1", "job1", "sheet", "sheet-a", "a1", "Loading"],
        ["Hazard A2", "job1", "sheet", "sheet-a", "a2", null],
    ]);
    assert.ok(result.every((h) => h.comment === "" && h.photoIds.length === 0 && !h.notApplicable));
});

test("SYNC-02 picking the same sheet again adds nothing", () => {
    const once = sync([], "job1", "sheet-a", A);
    assert.equal(sync(once, "job1", "sheet-a", A).length, 2);
});

test("SYNC-03 changing sheet: untouched old hazards go, worked-on ones and the officer's own stay", () => {
    const start = sync([], "job1", "sheet-a", A);
    const [a1, a2] = start;
    const own = { id: "own", worksiteId: "job1", name: "Loose ladder", comment: "", photoIds: [], notApplicable: false };
    const worked = [{ ...a1, comment: "Seen at gate" }, a2, own];

    const result = sync(worked, "job1", "sheet-b", B);
    assert.deepEqual(result.map((h) => h.name), ["Hazard A1", "Loose ladder", "Hazard B1"]);
});

test("SYNC-04 photos or not applicable also count as work, and other jobs are never touched", () => {
    const job1 = sync([], "job1", "sheet-a", A);
    const job2 = sync([], "job2", "sheet-a", A);
    const marked = [{ ...job1[0], photoIds: ["p1"] }, { ...job1[1], notApplicable: true }, ...job2];

    const cleared = sync(marked, "job1", null, []);
    assert.equal(cleared.length, 4);
    assert.equal(cleared.filter((h) => h.worksiteId === "job2").length, 2);
});
