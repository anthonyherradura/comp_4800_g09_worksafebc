// TEST-SCHEMA: server/models/Job.js, Photo.js and server/db/validators.js without a database.
// Checks the Mongoose rules, the shape the app receives, and that MongoDB's validator uses the same limits
// (tests/db/jobs-api.test.js checks the validator against a real server).
import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Job from "../server/models/Job.js";
import Photo from "../server/models/Photo.js";
import User from "../server/models/User.js";
import { LIMITS, PHOTO_TYPES } from "../server/db/limits.js";
import { jobsValidator, photosValidator } from "../server/db/validators.js";

const id = () => new mongoose.Types.ObjectId();
const job = (fields = {}) => new Job({ userId: id(), label: "Oak St.", ...fields });
const sheetHazard = (fields = {}) => ({ source: "sheet", sheetId: "cu-732044", sheetKey: "cu-732044-010", name: "Driver orientation", ...fields });
const officerHazard = (fields = {}) => ({ source: "officer", name: "Loose ladder", ...fields });
const errorsOf = (doc) => Object.keys(doc.validateSync()?.errors ?? {});

test("SCH-01 a new job gets every default the app reads", () => {
    const j = job();
    assert.deepEqual(errorsOf(j), []);
    assert.deepEqual(
        [j.sheetId, j.checklist.size, j.visitNotes, j.visitNotesUpdatedAt, j.hazards.length, j.rev],
        [null, 0, "", null, 0, 0],
    );
    assert.ok(j.lastOpenedAt instanceof Date);
});

test("SCH-02 labels: required, trimmed, capped", () => {
    assert.deepEqual(errorsOf(job({ label: "   " })), ["label"]);
    assert.deepEqual(errorsOf(job({ label: "x".repeat(LIMITS.labelChars + 1) })), ["label"]);
    assert.equal(job({ label: "  Mill Rd  " }).label, "Mill Rd");
});

test("SCH-03 a sheet hazard needs sheetId and sheetKey; an officer's hazard has neither", () => {
    assert.deepEqual(errorsOf(job({ hazards: [sheetHazard(), officerHazard()] })), []);
    assert.ok(errorsOf(job({ hazards: [sheetHazard({ sheetKey: undefined })] })).includes("hazards.0.source"));
    assert.ok(errorsOf(job({ hazards: [officerHazard({ sheetId: "cu-732044" })] })).includes("hazards.0.source"));
    assert.ok(errorsOf(job({ hazards: [{ name: "No source" }] })).includes("hazards.0.source"));
});

test("SCH-04 hazard text limits and defaults", () => {
    const j = job({ hazards: [officerHazard()] });
    assert.deepEqual([j.hazards[0].comment, j.hazards[0].notApplicable, j.hazards[0].photoIds.length], ["", false, 0]);
    assert.ok(errorsOf(job({ hazards: [officerHazard({ name: "" })] })).includes("hazards.0.name"));
    assert.ok(errorsOf(job({ hazards: [officerHazard({ name: "x".repeat(LIMITS.hazardNameChars + 1) })] })).includes("hazards.0.name"));
    assert.ok(errorsOf(job({ hazards: [officerHazard({ comment: "x".repeat(LIMITS.commentChars + 1) })] })).includes("hazards.0.comment"));
    assert.ok(errorsOf(job({ visitNotes: "x".repeat(LIMITS.visitNotesChars + 1) })).includes("visitNotes"));
});

test("SCH-05 the hazard, photo and recent-sheet limits come from limits.js", () => {
    const tooManyHazards = Array.from({ length: LIMITS.hazardsPerJob + 1 }, () => officerHazard());
    assert.ok(errorsOf(job({ hazards: tooManyHazards })).includes("hazards"));
    assert.deepEqual(errorsOf(job({ hazards: tooManyHazards.slice(1) })), []);
    const tooManyPhotos = Array.from({ length: LIMITS.photosPerHazard + 1 }, id);
    assert.ok(errorsOf(job({ hazards: [officerHazard({ photoIds: tooManyPhotos })] })).includes("hazards.0.photoIds"));
    const user = new User({ name: "A", email: "a@example.com", passwordHash: "x", recentSheetIds: ["a", "b", "c", "d"].slice(0, LIMITS.recentSheets + 1) });
    assert.ok(errorsOf(user).includes("recentSheetIds"));
});

test("SCH-06 checklist answers are ready or not-applicable; pending is never stored", () => {
    assert.deepEqual(errorsOf(job({ checklist: { "cu-732044-062-1": "ready", "cu-732044-062-2": "not-applicable" } })), []);
    assert.ok(errorsOf(job({ checklist: { "cu-732044-062-1": "pending" } })).some((e) => e.startsWith("checklist")));
});

test("SCH-07 what the app receives: string ids under `id`, no userId, checklist as a plain object", () => {
    const j = job({ checklist: { "cu-732044-062-1": "ready" }, hazards: [sheetHazard({ photoIds: [id()] })] });
    const out = j.toJSON();
    assert.equal(out.id, String(j._id));
    assert.equal(out._id, undefined);
    assert.equal(out.userId, undefined);
    assert.deepEqual(out.checklist, { "cu-732044-062-1": "ready" });
    assert.equal(out.hazards[0].id, String(j.hazards[0]._id));
    assert.equal(out.hazards[0]._id, undefined);
    assert.equal(typeof out.hazards[0].photoIds[0], "string");
});

test("SCH-08 photos: type, size and owner are required", () => {
    const ok = { userId: id(), jobId: id(), hazardId: id(), contentType: "image/jpeg", data: Buffer.from("x"), size: 1 };
    assert.deepEqual(errorsOf(new Photo(ok)), []);
    assert.deepEqual(errorsOf(new Photo({ ...ok, contentType: "image/gif" })), ["contentType"]);
    assert.deepEqual(errorsOf(new Photo({ ...ok, size: LIMITS.photoBytes + 1 })), ["size"]);
    assert.deepEqual(errorsOf(new Photo({ ...ok, hazardId: undefined })), ["hazardId"]);
});

test("SCH-09 MongoDB's validator uses the same limits and allowed values as the models", () => {
    const js = jobsValidator.$jsonSchema.properties;
    const hz = js.hazards.items.properties;
    assert.equal(js.hazards.maxItems, LIMITS.hazardsPerJob);
    assert.equal(hz.photoIds.maxItems, LIMITS.photosPerHazard);
    assert.equal(js.label.maxLength, LIMITS.labelChars);
    assert.equal(hz.name.maxLength, LIMITS.hazardNameChars);
    assert.equal(hz.comment.maxLength, LIMITS.commentChars);
    assert.equal(js.visitNotes.maxLength, LIMITS.visitNotesChars);
    assert.deepEqual(js.checklist.additionalProperties.enum, Job.schema.path("checklist").$__schemaType.enumValues);
    assert.deepEqual(hz.source.enum, Job.schema.path("hazards").schema.path("source").enumValues);
    const ps = photosValidator.$jsonSchema.properties;
    assert.equal(ps.size.maximum, LIMITS.photoBytes);
    assert.deepEqual(ps.contentType.enum, PHOTO_TYPES);
});

test("SCH-10 every field a job stores is listed in MongoDB's validator (it refuses unknown fields)", () => {
    const stored = Object.keys(job({ hazards: [sheetHazard()] }).toObject());
    const allowed = Object.keys(jobsValidator.$jsonSchema.properties);
    const withTimestamps = [...stored, "createdAt", "updatedAt"];
    assert.deepEqual(withTimestamps.filter((k) => !allowed.includes(k)), []);
    const hazardFields = Object.keys(job({ hazards: [sheetHazard()] }).toObject().hazards[0]);
    const hazardAllowed = Object.keys(jobsValidator.$jsonSchema.properties.hazards.items.properties);
    assert.deepEqual(hazardFields.filter((k) => !hazardAllowed.includes(k)), []);
});
