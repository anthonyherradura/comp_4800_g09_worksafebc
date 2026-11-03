// DB-2: the MongoDB schema against a real server. Run with: npm run test:db
// Needs MONGODB_TEST_URI pointing at a replica set (a single-node one is fine), for example
//   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/?replicaSet=rs0
// Works in a new database named hiips360_test_<time>, which it drops at the end. Your hiips360 data is not touched.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import * as M from "../../server/models/index.js";
import { COLLECTIONS } from "../../server/models/index.js";
import { isReplicaSet, applySchema, loadSheets, manualSchemaControl } from "../../server/db/setup.js";
import * as ops from "../../server/db/operations.js";
import { getInspectionSummary } from "../../server/db/summary.js";
import { toStored } from "../helpers/validatorCheck.js";

const URI = process.env.MONGODB_TEST_URI;
const skip = URI ? false : "set MONGODB_TEST_URI to a MongoDB replica set to run these";
const VALIDATION_FAILED = 121;
const DUPLICATE_KEY = 11000;
const id = () => new mongoose.Types.ObjectId();
const digest = (seed) => Buffer.alloc(32, seed);
let photoSeed = 0;
const photoFor = (hazardRecordId) => ({ hazardRecordId, storageKey: `test/${++photoSeed}`, sha256: digest(photoSeed % 250), mimeType: "image/jpeg", byteSize: 1000 });
const raw = (Model) => mongoose.connection.db.collection(Model.collection.collectionName);

async function rejectsWith(promiseOrFn, check) {
    await assert.rejects(typeof promiseOrFn === "function" ? promiseOrFn : () => promiseOrFn, check);
}
const code = (n) => (err) => err.code === n || err.errorResponse?.code === n || err.cause?.code === n;
const ruleError = (err) => err instanceof ops.DataRuleError && err.code === "RULE";

let user;
async function newUser(tag = Math.random().toString(36).slice(2, 8)) {
    return M.User.create({ name: `Officer ${tag}`, email: `officer.${tag}@worksafebc.test`, passwordHash: "$2b$12$abcdefghijklmnopqrstuuJvFQ3Vf5tqGqv7Wq8q1kq6vYqM7y5Gm" });
}
async function newInspection({ sheet = "cu-766011" } = {}) {
    const job = await ops.openJobSite({ userId: user._id, label: `Site ${Math.random().toString(36).slice(2, 9)}` });
    const inspection = await ops.startInspection({ jobSiteId: job._id });
    if (sheet) await ops.selectSheet({ inspectionId: inspection._id, sheetId: sheet, selectedVia: "search", isPrimary: true });
    return { job, inspection: await M.Inspection.findById(inspection._id) };
}
const revisionOf = async (inspectionId) => (await M.Inspection.findById(inspectionId)).revision;

before(async () => {
    if (skip) return;
    manualSchemaControl();
    await mongoose.connect(URI, { dbName: `hiips360_test_${Date.now()}`, serverSelectionTimeoutMS: 5000 });
    assert.ok(await isReplicaSet(), "MONGODB_TEST_URI must point at a replica set (transactions need one)");
    await applySchema();
    await loadSheets();
    user = await newUser("main");
});

after(async () => {
    if (skip || mongoose.connection.readyState !== 1) return;
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
});

// ---------- Setup ----------

test("DB-2.1 every collection has its validator and every index from its model", { skip }, async () => {
    const infos = new Map((await mongoose.connection.db.listCollections().toArray()).map((c) => [c.name, c]));
    for (const { model } of COLLECTIONS) {
        const name = model.collection.collectionName;
        assert.ok(infos.get(name)?.options?.validator, `${name} has no validator`);
        const expected = model.schema.indexes().length + 1; // + _id
        assert.equal((await model.collection.indexes()).length, expected, `${name} indexes`);
    }
});

test("DB-2.2 reference data loaded, and loading again changes nothing", { skip }, async () => {
    const counts = async () => Promise.all([M.Sheet, M.SheetSection, M.SheetChunk, M.Regulation, M.SheetChunkRegulation, M.ChecklistItem].map((m) => m.countDocuments()));
    const first = await counts();
    assert.deepEqual(first, [2, 21, 104, 64, 103, 4]);
    await loadSheets();
    assert.deepEqual(await counts(), first);
    assert.equal((await M.Sheet.findById("cu-766011")).title, "Long-term Care");
    assert.equal(await M.SheetChunk.countDocuments({ isHazard: true }), 54, "40 on Log Transport + 14 on Long-term Care");
    assert.equal(await M.SheetSection.countDocuments({ isHazardSection: { $exists: true } }), 0, "old section flag removed");
});

// ---------- The database rejects bad documents even when Mongoose is bypassed ----------

const badInserts = [
    ["sheet title repeating the CU number", M.Sheet, { _id: "cu-111111", cuNumber: "111111", title: "X (CU 111111)", issuedOn: new Date(), sourceFile: "x.pdf" }, {}],
    ["sheet id that doesn't match its CU number", M.Sheet, { _id: "cu-111111", cuNumber: "222222", title: "X", issuedOn: new Date(), sourceFile: "y.pdf" }, {}],
    ["hazard with both a sheet entry and a name", M.HazardRecord, { inspectionId: id(), customName: "A" }, { sheetChunkId: "cu-766011-003" }],
    ["hazard with neither a sheet entry nor a name", M.HazardRecord, { inspectionId: id(), customName: "A" }, { customName: null }],
    ["photo checksum of 31 bytes", M.Photo, photoFor(id()), { sha256: Buffer.alloc(31) }],
    ["photo over 10 MB", M.Photo, photoFor(id()), { byteSize: 10 * 1024 * 1024 + 1 }],
    ["GIF photo", M.Photo, photoFor(id()), { mimeType: "image/gif" }],
    ["accepted AI suggestion with no hazard", M.AiSuggestion, { inspectionId: id(), hasPhoto: true, modelName: "m", suggestedName: "n", outcome: "dismissed" }, { outcome: "accepted" }],
    ["AI input over 500 characters", M.AiSuggestion, { inspectionId: id(), hasPhoto: true, modelName: "m", suggestedName: "n", outcome: "dismissed" }, { inputText: "x".repeat(501) }],
    ["findings copied before the review", M.Summary, { inspectionId: id(), revision: 0 }, { copiedAt: new Date(0) }],
    ["inspection completed before it started", M.Inspection, { jobSiteId: id() }, { completedAt: new Date(0) }],
    ["inspection with no completedAt field", M.Inspection, { jobSiteId: id() }, { completedAt: undefined }],
    ["unknown field", M.HazardRecord, { inspectionId: id(), customName: "A" }, { status: "reviewed" }],
    ["job label with doubled spaces", M.JobSite, { userId: id(), label: "Oak" }, { label: "Oak  St" }],
];
for (const [why, Model, fields, change] of badInserts) {
    test(`DB-2.3 database rejects: ${why}`, { skip }, async () => {
        const doc = { ...toStored(Model, fields), ...change };
        for (const [k, v] of Object.entries(doc)) if (v === undefined) delete doc[k];
        await rejectsWith(raw(Model).insertOne(doc), code(VALIDATION_FAILED));
    });
}

test("DB-2.4 database rejects an upper-case email on users", { skip }, async () => {
    await rejectsWith(raw(M.User).insertOne({ name: "X", email: "Upper@WorkSafeBC.test", passwordHash: "$2b$12$x" }), code(VALIDATION_FAILED));
});

// ---------- Unique indexes ----------

test("DB-2.5 unique rules", { skip }, async () => {
    const { job, inspection } = await newInspection();
    await rejectsWith(raw(M.Inspection).insertOne(toStored(M.Inspection, { jobSiteId: job._id })), code(DUPLICATE_KEY));
    await rejectsWith(M.JobSite.create({ userId: user._id, label: job.label.toUpperCase() }), code(DUPLICATE_KEY));
    await rejectsWith(M.InspectionSheet.create({ inspectionId: inspection._id, sheetId: "cu-732044", selectedVia: "browse", isPrimary: true }), code(DUPLICATE_KEY));
    await M.HazardRecord.create({ inspectionId: inspection._id, sheetChunkId: "cu-766011-003" });
    await rejectsWith(M.HazardRecord.create({ inspectionId: inspection._id, sheetChunkId: "cu-766011-003" }), code(DUPLICATE_KEY));
    const h = await M.HazardRecord.create({ inspectionId: inspection._id, customName: "Saw" });
    await M.Photo.create({ ...photoFor(h._id), sha256: digest(251) });
    await rejectsWith(M.Photo.create({ ...photoFor(h._id), sha256: digest(251) }), code(DUPLICATE_KEY));
    await M.Summary.create({ inspectionId: inspection._id, revision: 7 });
    await rejectsWith(M.Summary.create({ inspectionId: inspection._id, revision: 7 }), code(DUPLICATE_KEY));
});

// ---------- Operations: references, revision, Summary, completion ----------

test("DB-2.6 re-adding a job label in another case and spacing reopens the same job site", { skip }, async () => {
    const a = await ops.openJobSite({ userId: user._id, label: "Oak St. tower" });
    const b = await ops.openJobSite({ userId: user._id, label: "  oak st.   TOWER " });
    assert.equal(String(a._id), String(b._id));
});

test("DB-2.7 references are checked: no hazard from an unselected sheet, no orphan writes", { skip }, async () => {
    const { inspection } = await newInspection();
    await rejectsWith(ops.addHazard({ inspectionId: inspection._id, sheetChunkId: "cu-732044-010" }), ruleError);
    await rejectsWith(ops.addHazard({ inspectionId: id(), customName: "X" }), (e) => e.code === "NOT_FOUND");
    await rejectsWith(ops.addPhoto(photoFor(id())), (e) => e.code === "NOT_FOUND");
    await rejectsWith(ops.selectSheet({ inspectionId: inspection._id, sheetId: "cu-999999", selectedVia: "search" }), (e) => e.code === "NOT_FOUND");
    await rejectsWith(async () => ops.recordAiSuggestion({ inspectionId: inspection._id, hasPhoto: true, outcome: "accepted" }), ruleError);
});

test("DB-2.8 Summary: every sheet hazard listed, counts follow photos and not-applicable", { skip }, async () => {
    const { inspection } = await newInspection();
    let s = await getInspectionSummary(inspection._id);
    assert.deepEqual([s.lines.length, s.unaddressed, s.reviewed, s.notApplicable], [14, 14, 0, 0]);

    const opened = await ops.addHazard({ inspectionId: inspection._id, sheetChunkId: "cu-766011-003" });
    await ops.addPhoto(photoFor(opened._id));
    const na = await ops.addHazard({ inspectionId: inspection._id, sheetChunkId: "cu-766011-002" });
    await ops.updateHazard(na._id, { isNotApplicable: true });
    await ops.addHazard({ inspectionId: inspection._id, customName: "Unguarded table saw" });
    s = await getInspectionSummary(inspection._id);
    assert.deepEqual([s.unaddressed, s.reviewed, s.notApplicable, s.photos], [13, 1, 1, 1]);
    await rejectsWith(ops.updateHazard(opened._id, { customName: "Renamed" }), ruleError);
});

test("DB-2.8b Summary for Log Transport lists the app's 40 hazards, not 42", { skip }, async () => {
    const { inspection } = await newInspection({ sheet: "cu-732044" });
    const s = await getInspectionSummary(inspection._id);
    assert.equal(s.lines.length, 40);
    assert.ok(!s.lines.some((l) => ["cu-732044-022", "cu-732044-041"].includes(l.sheetChunkId)));
});

test("DB-2.9 revision goes up once per change, including deletes", { skip }, async () => {
    const { inspection } = await newInspection();
    const r0 = await revisionOf(inspection._id);
    const h = await ops.addHazard({ inspectionId: inspection._id, customName: "Noise" });
    const p = await ops.addPhoto(photoFor(h._id));
    await ops.updateHazard(h._id, { comment: "loud" });
    await ops.deletePhoto(p._id);
    await ops.deleteHazard(h._id);
    assert.equal(await revisionOf(inspection._id), r0 + 5);
});

test("DB-2.10 review → change → stale → re-review → complete", { skip }, async () => {
    const { inspection } = await newInspection();
    const h = await ops.addHazard({ inspectionId: inspection._id, sheetChunkId: "cu-766011-003" });
    const p = await ops.addPhoto(photoFor(h._id));

    let s = await getInspectionSummary(inspection._id);
    await rejectsWith(ops.recordSummaryReview({ inspectionId: inspection._id, revision: s.revision - 1 }), ruleError);
    const review = await ops.recordSummaryReview({ inspectionId: inspection._id, revision: s.revision });
    assert.equal((await getInspectionSummary(inspection._id)).reviewIsCurrent, true);

    await ops.deletePhoto(p._id); // a deletion leaves no timestamp, but still makes the review stale
    s = await getInspectionSummary(inspection._id);
    assert.equal(s.reviewIsCurrent, false);
    await rejectsWith(ops.completeInspection(inspection._id), ruleError);

    await ops.recordSummaryReview({ inspectionId: inspection._id, revision: s.revision });
    const done = await ops.completeInspection(inspection._id);
    assert.ok(done.completedAt);
    await rejectsWith(ops.completeInspection(inspection._id), ruleError);

    const copied = await ops.markFindingsCopied(review._id);
    assert.ok(copied.copiedAt >= copied.reviewedAt);
    // A recorded review can't be rewritten through the model (inspectionId, revision and reviewedAt are immutable)
    await M.Summary.updateOne({ _id: review._id }, { $set: { revision: 99, reviewedAt: new Date(0) } }).catch(() => {});
    const unchanged = await M.Summary.findById(review._id);
    assert.equal(unchanged.revision, review.revision);
    assert.equal(+unchanged.reviewedAt, +review.reviewedAt);
});

test("DB-2.11 an accepted AI suggestion creates its hazard in the same inspection, and origin is derived", { skip }, async () => {
    const { inspection } = await newInspection();
    const { hazard, suggestion } = await ops.acceptAiSuggestion({ inspectionId: inspection._id, suggestedName: "Unsecured Ladder", hasPhoto: true, modelName: "gemini-test", latencyMs: 1200 });
    assert.equal(String(suggestion.hazardRecordId), String(hazard._id));
    assert.equal(String(hazard.inspectionId), String(inspection._id));
    const line = (await getInspectionSummary(inspection._id)).lines.find((l) => String(l.hazardRecordId) === String(hazard._id));
    assert.equal(line.origin, "ai");
});

test("DB-2.12 a sheet can't be unselected while its hazards are recorded", { skip }, async () => {
    const { inspection } = await newInspection();
    await ops.addHazard({ inspectionId: inspection._id, sheetChunkId: "cu-766011-004" });
    await rejectsWith(ops.unselectSheet({ inspectionId: inspection._id, sheetId: "cu-766011" }), ruleError);
});

// ---------- Two devices at once ----------

test("DB-2.13 two devices start an inspection on the same job at once: exactly one succeeds", { skip }, async () => {
    const job = await ops.openJobSite({ userId: user._id, label: `Race ${Date.now()}` });
    const results = await Promise.allSettled([ops.startInspection({ jobSiteId: job._id }), ops.startInspection({ jobSiteId: job._id })]);
    assert.deepEqual(results.map((r) => r.status).sort(), ["fulfilled", "rejected"]);
    assert.equal(await M.Inspection.countDocuments({ jobSiteId: job._id, completedAt: null }), 1);
});

test("DB-2.13b two devices add the same job label, or review the same revision, at once: no duplicates", { skip }, async () => {
    const label = `Same ${Date.now()}`;
    const [a, b] = await Promise.all([ops.openJobSite({ userId: user._id, label }), ops.openJobSite({ userId: user._id, label: label.toLowerCase() })]);
    assert.equal(String(a._id), String(b._id));
    const { inspection } = await newInspection();
    const revision = await revisionOf(inspection._id);
    const [r1, r2] = await Promise.all([ops.recordSummaryReview({ inspectionId: inspection._id, revision }), ops.recordSummaryReview({ inspectionId: inspection._id, revision })]);
    assert.equal(String(r1._id), String(r2._id));
    assert.equal(await M.Summary.countDocuments({ inspectionId: inspection._id }), 1);
});

test("DB-2.14 completing while a photo is saving never completes on an out-of-date review", { skip }, async () => {
    for (let i = 0; i < 10; i++) {
        const { inspection } = await newInspection();
        const h = await ops.addHazard({ inspectionId: inspection._id, customName: `Race ${i}` });
        const s = await getInspectionSummary(inspection._id);
        await ops.recordSummaryReview({ inspectionId: inspection._id, revision: s.revision });
        const [completed, photo] = await Promise.allSettled([ops.completeInspection(inspection._id), ops.addPhoto(photoFor(h._id))]);
        assert.equal(photo.status, "fulfilled"); // photos may still be added after completion (the review then shows as stale)
        if (completed.status === "rejected") assert.ok(completed.reason instanceof ops.DataRuleError, completed.reason.message);
        const final = await M.Inspection.findById(inspection._id);
        // completion only happened if it read the revision before the photo's increment, so completed => revision = reviewed + 1
        if (final.completedAt) assert.equal(final.revision, s.revision + 1);
    }
});

// ---------- Cascading delete ----------

test("DB-2.15 deleting an officer removes everything they recorded, leaving no orphans", { skip }, async () => {
    const saved = user;
    user = await newUser("leaving");
    const { inspection } = await newInspection();
    const h = await ops.addHazard({ inspectionId: inspection._id, sheetChunkId: "cu-766011-003" });
    await ops.addPhoto(photoFor(h._id));
    await ops.acceptAiSuggestion({ inspectionId: inspection._id, suggestedName: "Ladder", hasPhoto: true, modelName: "m" });
    await ops.setChecklistStatus({ inspectionId: inspection._id, checklistItemId: "equipment", status: "ready" });
    await ops.recordSummaryReview({ inspectionId: inspection._id, revision: await revisionOf(inspection._id) });
    await mongoose.connection.collection("sessions").insertOne({ _id: "sess-1", expires: new Date(Date.now() + 1e6), session: JSON.stringify({ userId: String(user._id) }) });

    await ops.deleteUser(user._id);
    const left = await Promise.all([
        M.JobSite.countDocuments({ userId: user._id }),
        M.Inspection.countDocuments({ _id: inspection._id }),
        M.HazardRecord.countDocuments({ inspectionId: inspection._id }),
        M.Photo.countDocuments({ hazardRecordId: h._id }),
        M.AiSuggestion.countDocuments({ inspectionId: inspection._id }),
        M.InspectionSheet.countDocuments({ inspectionId: inspection._id }),
        M.InspectionChecklistItem.countDocuments({ inspectionId: inspection._id }),
        M.Summary.countDocuments({ inspectionId: inspection._id }),
        mongoose.connection.collection("sessions").countDocuments({ _id: "sess-1" }),
        M.User.countDocuments({ _id: user._id }),
    ]);
    assert.deepEqual(left, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    user = saved;
});

// ---------- Performance smoke test ----------

test("DB-2.16 Summary and hazard queries use indexes and stay fast", { skip }, async () => {
    const { inspection } = await newInspection();
    for (let i = 2; i <= 15; i++) {
        const h = await ops.addHazard({ inspectionId: inspection._id, sheetChunkId: `cu-766011-${String(i).padStart(3, "0")}` });
        if (i % 2) await ops.addPhoto(photoFor(h._id));
    }
    const plan = await M.HazardRecord.find({ inspectionId: inspection._id }).explain("queryPlanner");
    assert.match(JSON.stringify(plan.queryPlanner.winningPlan), /IXSCAN/);
    const times = [];
    for (let i = 0; i < 50; i++) {
        const t = performance.now();
        await getInspectionSummary(inspection._id);
        times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    assert.ok(p95 < 50, `Summary p95 ${p95.toFixed(1)} ms`);
    console.log(`  Summary p50 ${times[25].toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`);
});
