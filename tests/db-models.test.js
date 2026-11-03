// DB-1: the MongoDB schema (server/models), checked without a database.
// Covers: Mongoose models and database validators agree; naming rules; every reference is indexed; no redundant
// indexes; each validation rule accepts good documents and rejects bad ones; reference data from the real sheet
// files; and the Summary calculation (server/db/summary.js).
// tests/db/integration.test.js repeats the database-side checks against a real MongoDB (npm run test:db).
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { COLLECTIONS } from "../server/models/index.js";
import * as M from "../server/models/index.js";
import { buildSummary, hazardStatus, STATUS } from "../server/db/summary.js";
import { readSheetFiles, prepareReferenceData } from "../server/db/referenceData.js";
import { sheetHazards } from "../src/data/sheets/sheetContent.js";
import { checkValidator, toStored, bsonType } from "./helpers/validatorCheck.js";

const id = () => new mongoose.Types.ObjectId();
const sha = (n = 32, fill = 1) => Buffer.alloc(n, fill);
const workAndReference = COLLECTIONS.filter((c) => c.kind !== "account");
const schemaPaths = (model) => Object.keys(model.schema.paths).filter((p) => !p.includes("."));

// ---------- Models and validators describe the same documents ----------

test("DB-1.1 every collection's Mongoose model and database validator list the same fields", () => {
    for (const { model, validator } of workAndReference) {
        const mongooseFields = schemaPaths(model).sort();
        const validatorFields = Object.keys(validator.$jsonSchema.properties).sort();
        assert.deepEqual(mongooseFields, validatorFields, model.collection.collectionName);
    }
});

test("DB-1.2 the database validator requires every field (nullable ones must be present as null)", () => {
    for (const { model, validator } of workAndReference) {
        const required = new Set(validator.$jsonSchema.required);
        for (const field of schemaPaths(model).filter((p) => p !== "_id")) {
            assert.ok(required.has(field), `${model.collection.collectionName}.${field} not required`);
        }
        assert.equal(validator.$jsonSchema.additionalProperties, false, model.collection.collectionName);
    }
});

// ---------- Naming ----------

const singular = (collection) => collection.replace(/ies$/, "y").replace(/s$/, "");

test("DB-1.3 naming: camelCase plural collections, camelCase fields, booleans start with is/has, dates end in At/On", () => {
    for (const { model } of COLLECTIONS) {
        const name = model.collection.collectionName;
        assert.match(name, /^[a-z][a-zA-Z]*s$/, name);
        for (const field of schemaPaths(model)) {
            if (field === "_id" || field === "__v") continue;
            assert.match(field, /^[a-z][a-zA-Z0-9]*$/, `${name}.${field}`);
            const type = model.schema.path(field).instance;
            if (type === "Boolean") assert.match(field, /^(is|has)[A-Z]/, `${name}.${field}`);
            if (type === "Date") assert.match(field, /(At|On)$/, `${name}.${field}`);
        }
    }
});

test("DB-1.4 every reference is named <referenced collection, singular>Id and points to a model that exists", () => {
    const byModel = new Map(COLLECTIONS.map(({ model }) => [model.modelName, model.collection.collectionName]));
    let refs = 0;
    for (const { model } of COLLECTIONS) {
        for (const field of schemaPaths(model)) {
            const ref = model.schema.path(field).options.ref;
            if (!ref) continue;
            refs++;
            assert.ok(byModel.has(ref), `${model.modelName}.${field} -> ${ref}`);
            assert.equal(field, `${singular(byModel.get(ref))}Id`, `${model.modelName}.${field}`);
        }
    }
    assert.equal(refs, 16, "the ERD's 17 relationships, less sessions -> users, which connect-mongo owns");
});

// ---------- Indexes ----------

// includes path-level { unique: true } indexes
const indexesOf = (model) => model.schema.indexes();

test("DB-1.5 every reference field leads an index (fast lookups and cascading deletes)", () => {
    for (const { model } of COLLECTIONS) {
        for (const field of schemaPaths(model).filter((p) => model.schema.path(p).options.ref)) {
            const led = indexesOf(model).some(([keys]) => Object.keys(keys)[0] === field);
            assert.ok(led, `${model.collection.collectionName}.${field} has no index`);
        }
    }
});

test("DB-1.6 no redundant index (one whose keys are a prefix of another full index on the same collection)", () => {
    for (const { model } of COLLECTIONS) {
        const full = indexesOf(model).filter(([, o]) => !o?.partialFilterExpression && !o?.collation).map(([k]) => Object.keys(k));
        for (const a of full) for (const b of full) {
            if (a.length < b.length) assert.notDeepEqual(b.slice(0, a.length), a, `${model.collection.collectionName}: ${a} is covered by ${b}`);
        }
    }
});

test("DB-1.7 business rules carried by indexes are present", () => {
    const has = (model, keys, opts) =>
        indexesOf(model).some(([k, o]) => JSON.stringify(k) === JSON.stringify(keys) && Object.entries(opts).every(([p, v]) => JSON.stringify(o?.[p]) === JSON.stringify(v)));
    assert.ok(has(M.Inspection, { jobSiteId: 1 }, { unique: true, partialFilterExpression: { completedAt: { $type: "null" } } }), "one open inspection per job site");
    assert.ok(has(M.InspectionSheet, { inspectionId: 1 }, { unique: true, partialFilterExpression: { isPrimary: true } }), "one primary sheet per inspection");
    assert.ok(has(M.JobSite, { userId: 1, label: 1 }, { unique: true, collation: { locale: "en", strength: 2 } }), "job label unique per officer, any case");
    assert.ok(has(M.HazardRecord, { inspectionId: 1, sheetChunkId: 1 }, { unique: true }), "a sheet hazard once per inspection");
    assert.ok(has(M.Photo, { hazardRecordId: 1, sha256: 1 }, { unique: true }), "same image not attached twice");
    assert.ok(has(M.Summary, { inspectionId: 1, revision: 1 }, { unique: true }), "each revision reviewed once");
});

// ---------- Validation rules: good documents pass, bad ones fail, in both Mongoose and the database validator ----------

const VALIDATORS = new Map(COLLECTIONS.map(({ model, validator }) => [model, validator]));

function bothAccept(Model, fields) {
    const err = new Model(fields).validateSync();
    assert.equal(err, undefined, `Mongoose rejected a good ${Model.modelName}: ${err?.message}`);
    assert.deepEqual(checkValidator(VALIDATORS.get(Model), toStored(Model, fields)), [], `validator rejected a good ${Model.modelName}`);
}
function bothReject(Model, fields, why) {
    let mongooseRejects;
    try { mongooseRejects = new Model(fields).validateSync() !== undefined; } catch { mongooseRejects = true; }
    assert.ok(mongooseRejects, `Mongoose accepted: ${why}`);
    let stored;
    try { stored = toStored(Model, fields); } catch { stored = { ...fields }; }
    for (const [k, v] of Object.entries(fields)) if (!(k in stored)) stored[k] = v; // keep what a direct insert would send
    assert.notDeepEqual(checkValidator(VALIDATORS.get(Model), stored), [], `validator accepted: ${why}`);
}

const good = {
    sheet: { _id: "cu-766011", cuNumber: "766011", title: "Long-term Care", issuedOn: new Date("2023-07-07"), sourceFile: "x.pdf" },
    chunk: { _id: "cu-766011-003", sheetId: "cu-766011", sheetSectionId: 2, seq: 3, heading: "Heights", bodyText: "…" },
    inspection: { jobSiteId: id() },
    hazardFromSheet: { inspectionId: id(), sheetChunkId: "cu-766011-003" },
    hazardNamed: { inspectionId: id(), customName: "Unguarded table saw" },
    photo: { hazardRecordId: id(), storageKey: "gridfs/1", sha256: sha(), mimeType: "image/jpeg", byteSize: 350000 },
    ai: { inspectionId: id(), hasPhoto: true, modelName: "gemini", suggestedName: "Saw", outcome: "dismissed" },
    summary: { inspectionId: id(), revision: 3 },
};

test("DB-1.8 good documents pass Mongoose and the database validator", () => {
    bothAccept(M.Sheet, good.sheet);
    bothAccept(M.SheetChunk, good.chunk);
    bothAccept(M.Inspection, good.inspection);
    bothAccept(M.HazardRecord, good.hazardFromSheet);
    bothAccept(M.HazardRecord, good.hazardNamed);
    bothAccept(M.Photo, good.photo);
    bothAccept(M.AiSuggestion, good.ai);
    bothAccept(M.Summary, good.summary);
    bothAccept(M.JobSite, { userId: id(), label: "  Oak St.   tower " });
    bothAccept(M.InspectionSheet, { inspectionId: id(), sheetId: "cu-766011", selectedVia: "photo", isPrimary: true });
    bothAccept(M.InspectionChecklistItem, { inspectionId: id(), checklistItemId: "equipment", status: "ready" });
});

test("DB-1.9 job site labels are stored trimmed with single spaces", () => {
    assert.equal(toStored(M.JobSite, { userId: id(), label: "  Oak St.   tower " }).label, "Oak St. tower");
});

const RULES = [
    ["Sheet id must look like cu-NNNNNN", M.Sheet, { ...good.sheet, _id: "766011" }],
    ["Sheet title cannot repeat the CU number", M.Sheet, { ...good.sheet, title: "Long-term Care (CU 766011)" }],
    ["Sheet chunk id must be sheetId + 3-digit seq", M.SheetChunk, { ...good.chunk, seq: 4 }],
    ["Hazard needs a sheet entry or a name, not both", M.HazardRecord, { ...good.hazardFromSheet, customName: "Dup" }],
    ["Hazard needs a sheet entry or a name, not neither", M.HazardRecord, { inspectionId: id() }],
    ["Hazard comment capped at 2000 characters", M.HazardRecord, { ...good.hazardNamed, comment: "x".repeat(2001) }],
    ["Photo type limited to JPEG/PNG/WebP", M.Photo, { ...good.photo, mimeType: "image/gif" }],
    ["Photo size capped at 10 MB", M.Photo, { ...good.photo, byteSize: 10 * 1024 * 1024 + 1 }],
    ["Photo checksum must be exactly 32 bytes", M.Photo, { ...good.photo, sha256: sha(31) }],
    ["AI input text capped at 500 characters", M.AiSuggestion, { ...good.ai, inputText: "x".repeat(501) }],
    ["AI outcome constrained", M.AiSuggestion, { ...good.ai, outcome: "maybe" }],
    ["Checklist status constrained", M.InspectionChecklistItem, { inspectionId: id(), checklistItemId: "sheet", status: "done" }],
    ["Selection method constrained", M.InspectionSheet, { inspectionId: id(), sheetId: "cu-766011", selectedVia: "guess" }],
    ["Inspection revision can't be negative", M.Inspection, { ...good.inspection, revision: -1 }],
    ["Summary revision must be a whole number", M.Summary, { ...good.summary, revision: 1.5 }],
    ["Unknown fields are rejected", M.HazardRecord, { ...good.hazardNamed, status: "reviewed" }],
];
for (const [why, Model, fields] of RULES) {
    test(`DB-1.10 rejected: ${why}`, () => bothReject(Model, fields, why));
}

// Rules that only the database validator can see (they compare two fields of a stored document)
test("DB-1.11 cross-field rules in the database validators", () => {
    const v = (Model, doc) => checkValidator(VALIDATORS.get(Model), doc);
    const t0 = new Date("2026-11-01T10:00:00Z"), t1 = new Date("2026-11-01T09:00:00Z");
    assert.notDeepEqual(v(M.Inspection, { _id: id(), jobSiteId: id(), startedAt: t0, completedAt: t1, planningNotes: "", revision: 0, updatedAt: t0 }), [], "completed before it started");
    assert.notDeepEqual(v(M.Summary, { _id: id(), inspectionId: id(), revision: 1, reviewedAt: t0, copiedAt: t1 }), [], "copied before reviewed");
    assert.notDeepEqual(v(M.JobSite, { _id: id(), userId: id(), label: "A", createdAt: t0, lastOpenedAt: t1 }), [], "opened before created");
    const ai = { _id: id(), inspectionId: id(), hazardRecordId: null, inputText: null, hasPhoto: true, modelName: "m", suggestedName: "n", outcome: "accepted", latencyMs: null, createdAt: t0 };
    assert.notDeepEqual(v(M.AiSuggestion, ai), [], "accepted without a hazard");
    assert.notDeepEqual(v(M.AiSuggestion, { ...ai, outcome: "error", hasPhoto: false, modelName: null, suggestedName: null }), [], "no text and no photo");
    assert.deepEqual(v(M.AiSuggestion, { ...ai, hazardRecordId: id() }), [], "accepted with a hazard is fine");
});

// ---------- Reference data from the real sheet files ----------

const sheetFiles = await readSheetFiles("src/data/sheets");
const ref = prepareReferenceData(sheetFiles);

test("DB-1.12 reference data: counts match the PostgreSQL seed", () => {
    assert.deepEqual(
        { sheets: ref.sheets.length, sections: ref.sections.length, chunks: ref.chunks.length, regulations: ref.regulations.length, links: ref.links.length },
        { sheets: 2, sections: 21, chunks: 104, regulations: 64, links: 103 },
    );
    assert.deepEqual(ref.sheets.map((s) => s.title).sort(), ["Log Transport", "Long-term Care"], "CU number removed from titles");
    assert.equal(ref.chunks.filter((c) => c.isHazard).length, 54, "40 on Log Transport + 14 on Long-term Care");
});

test("DB-1.13 reference data: every document passes its model and database validator", () => {
    const sets = [[M.Sheet, ref.sheets], [M.SheetSection, ref.sections], [M.SheetChunk, ref.chunks], [M.Regulation, ref.regulations],
        [M.SheetChunkRegulation, ref.links], [M.ChecklistItem, ref.checklistItems]];
    for (const [Model, docs] of sets) for (const d of docs) bothAccept(Model, d);
});

test("DB-1.14 reference data: re-preparing with the stored ids changes nothing (stable numeric ids)", () => {
    const again = prepareReferenceData(sheetFiles, {
        sections: new Map(ref.sections.map((s) => [s.name, s._id])),
        regulations: new Map(ref.regulations.map((r) => [`${r.instrument}|${r.reference}`, r._id])),
    });
    assert.deepEqual(again, ref);
});

// ---------- Summary calculation (same cases as the PostgreSQL Summary tests) ----------

const hazardChunksOf = (sheetId) => ref.chunks.filter((c) => c.sheetId === sheetId && c.isHazard);

test("DB-1.22 the database marks exactly the hazards the app lists, on every sheet (Log Transport: 40, not 42)", () => {
    for (const file of sheetFiles) {
        const appKeys = sheetHazards(file).map((h) => h.key);
        assert.deepEqual(hazardChunksOf(file.sheetId).map((c) => c._id), appKeys, file.sheetId);
    }
    const lt = ref.chunks.filter((c) => c.sheetId === "cu-732044");
    for (const continuation of ["cu-732044-022", "cu-732044-041"]) {
        assert.equal(lt.find((c) => c._id === continuation).isHazard, false, `${continuation} only continues the hazard above it`);
    }
    const s = buildSummary({ inspection: { _id: id(), revision: 0 }, hazardChunks: hazardChunksOf("cu-732044"), hazards: [], photoCounts: new Map() });
    assert.equal(s.lines.length, 40);
});
const hazard = (fields) => ({ _id: id(), comment: "", isNotApplicable: false, sheetChunkId: null, customName: null, ...fields });

test("DB-1.15 Summary: a new inspection lists every hazard on the sheet, including ones never opened", () => {
    const chunks = hazardChunksOf("cu-766011");
    const h = hazard({ sheetChunkId: "cu-766011-003" });
    const s = buildSummary({ inspection: { _id: id(), revision: 1 }, hazardChunks: chunks, hazards: [h], photoCounts: new Map() });
    assert.equal(chunks.length, 14);
    assert.deepEqual([s.unaddressed, s.reviewed, s.notApplicable, s.photos], [14, 0, 0, 0]);
    assert.equal(s.lines.filter((l) => l.hazardRecordId === null).length, 13, "13 never opened");
});

test("DB-1.16 Summary: after 1 photo, 1 not applicable and 1 off-sheet hazard", () => {
    const opened = hazard({ sheetChunkId: "cu-766011-003" });
    const na = hazard({ sheetChunkId: "cu-766011-002", isNotApplicable: true });
    const saw = hazard({ customName: "Unguarded table saw" });
    const s = buildSummary({
        inspection: { _id: id(), revision: 4 }, hazardChunks: hazardChunksOf("cu-766011"),
        hazards: [opened, na, saw], photoCounts: new Map([[String(opened._id), 1]]),
    });
    assert.deepEqual([s.unaddressed, s.reviewed, s.notApplicable, s.photos], [13, 1, 1, 1]);
    assert.equal(s.lines.at(-1).name, "Unguarded table saw");
});

test("DB-1.17 Summary: a review is current only for the revision it recorded", () => {
    const base = { inspection: { _id: id(), revision: 5 }, hazardChunks: [], hazards: [], photoCounts: new Map() };
    assert.equal(buildSummary({ ...base, latestReview: { revision: 5 } }).reviewIsCurrent, true);
    assert.equal(buildSummary({ ...base, latestReview: { revision: 4 } }).reviewIsCurrent, false);
    assert.equal(buildSummary(base).reviewIsCurrent, false, "never reviewed");
});

test("DB-1.18 Summary: origin is derived (sheet / ai / officer) and status follows hazardStatus.js", () => {
    const ai = hazard({ customName: "Unsecured ladder" });
    const own = hazard({ customName: "Noise" });
    const s = buildSummary({ inspection: { _id: id(), revision: 0 }, hazardChunks: [], hazards: [ai, own], photoCounts: new Map(), acceptedHazardIds: new Set([String(ai._id)]) });
    assert.deepEqual(s.lines.map((l) => l.origin), ["ai", "officer"]);
    assert.equal(hazardStatus({ isNotApplicable: true }, 3), STATUS.NOT_APPLICABLE, "not applicable wins over photos");
    assert.equal(hazardStatus({ isNotApplicable: false }, 1), STATUS.REVIEWED);
});

test("DB-1.19 Summary: a recorded sheet entry that isn't a hazard still appears, under its sheet heading", () => {
    const outside = ref.chunks.find((c) => c.sheetId === "cu-766011" && !c.isHazard);
    const h = hazard({ sheetChunkId: outside._id });
    const s = buildSummary({ inspection: { _id: id(), revision: 0 }, hazardChunks: hazardChunksOf("cu-766011"), otherChunks: [outside], hazards: [h], photoCounts: new Map() });
    assert.equal(s.lines.length, 15);
    assert.equal(s.lines.at(-1).name, outside.heading);
});

test("DB-1.21 a recorded review can't be rewritten: inspectionId, revision and reviewedAt are immutable", () => {
    for (const field of ["inspectionId", "revision", "reviewedAt"]) assert.equal(M.Summary.schema.path(field).options.immutable, true, field);
    assert.notEqual(M.Summary.schema.path("copiedAt").options.immutable, true, "copiedAt is filled in later");
});

test("DB-1.20 validator types match what the driver stores (whole numbers as int, ids as objectId, digests as binData)", () => {
    const stored = toStored(M.Photo, good.photo);
    assert.equal(bsonType(stored.byteSize), "int");
    assert.equal(bsonType(stored.hazardRecordId), "objectId");
    assert.equal(bsonType(stored.sha256), "binData");
});
