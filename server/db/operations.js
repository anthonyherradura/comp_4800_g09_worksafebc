// Writes that MongoDB can't protect on its own.
//
// PostgreSQL enforced these with foreign keys, cascades and triggers (see docs/database). MongoDB enforces types,
// required fields and unique indexes (server/models), but not references between collections or rules that span
// them. So every write that touches more than one collection goes through a function here, inside a transaction:
//   - references are checked before writing (no orphans),
//   - deletes cascade to everything underneath,
//   - inspections.revision goes up on every hazard, photo or selected-sheet change,
//   - a Summary review records the current revision, and an inspection can only be completed after one.
//
// Transactions need MongoDB running as a replica set (a single-node one is fine); scripts/db-setup.mjs checks this.
// Errors thrown on purpose are DataRuleError, with a message that is safe to show to the officer.

import mongoose from "mongoose";
import {
    Sheet, SheetChunk, JobSite, Inspection, InspectionSheet, InspectionChecklistItem, ChecklistItem,
    HazardRecord, Photo, AiSuggestion, Summary, User,
} from "../models/index.js";
import { normaliseLabel, caseInsensitive } from "../models/schemaHelpers.js";

export class DataRuleError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "DataRuleError";
        this.code = code; // NOT_FOUND | RULE | CONFLICT
    }
}
const notFound = (what) => new DataRuleError("NOT_FOUND", `That ${what} doesn't exist.`);
const rule = (message) => new DataRuleError("RULE", message);
const isDuplicateKey = (err) => err?.code === 11000;

// Runs work(session) in a transaction. The driver retries the whole function on transient conflicts
// (for example two devices writing the same inspection at once), so work must only use the session it is given.
export async function inTransaction(work) {
    const session = await mongoose.startSession();
    try {
        let result;
        await session.withTransaction(async () => {
            result = await work(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
}

async function mustFind(Model, id, what, session) {
    const doc = await Model.findById(id).session(session);
    if (!doc) throw notFound(what);
    return doc;
}

// Any change the Summary shows makes earlier reviews out of date
function bumpRevision(inspectionIds, session) {
    const ids = [...new Set(inspectionIds.map(String))];
    return Inspection.updateMany({ _id: { $in: ids } }, { $inc: { revision: 1 }, $set: { updatedAt: new Date() } }, { session });
}

// ---------- Job sites ----------

// Matches JobContext.addJob: re-adding an existing label (any case or spacing) reopens that job instead of duplicating it.
// If two devices add the same label at once, the unique index stops the second insert and it reopens the first.
export async function openJobSite({ userId, label }) {
    try {
        return await openJobSiteOnce({ userId, label });
    } catch (err) {
        if (!isDuplicateKey(err)) throw err;
        return openJobSiteOnce({ userId, label });
    }
}

function openJobSiteOnce({ userId, label }) {
    return inTransaction(async (session) => {
        await mustFind(User, userId, "account", session);
        const clean = normaliseLabel(label);
        const now = new Date();
        const existing = await JobSite.findOne({ userId, label: clean }).collation(caseInsensitive).session(session);
        if (existing) {
            existing.lastOpenedAt = now;
            return existing.save({ session });
        }
        const [created] = await JobSite.create([{ userId, label: clean, createdAt: now, lastOpenedAt: now }], { session });
        return created;
    });
}

// ---------- Inspections ----------

export function startInspection({ jobSiteId }) {
    return inTransaction(async (session) => {
        await mustFind(JobSite, jobSiteId, "job site", session);
        try {
            const [created] = await Inspection.create([{ jobSiteId }], { session });
            return created;
        } catch (err) {
            if (isDuplicateKey(err)) throw rule("This job site already has an inspection in progress.");
            throw err;
        }
    });
}

export function selectSheet({ inspectionId, sheetId, selectedVia, isPrimary = false }) {
    return inTransaction(async (session) => {
        await mustFind(Inspection, inspectionId, "inspection", session);
        await mustFind(Sheet, sheetId, "protocol sheet", session);
        try {
            const [created] = await InspectionSheet.create([{ inspectionId, sheetId, selectedVia, isPrimary }], { session });
            await bumpRevision([inspectionId], session);
            return created;
        } catch (err) {
            if (isDuplicateKey(err)) {
                throw rule(isPrimary ? "This inspection already has a primary sheet, or this sheet is already selected." : "This sheet is already selected.");
            }
            throw err;
        }
    });
}

export function unselectSheet({ inspectionId, sheetId }) {
    return inTransaction(async (session) => {
        const chunkIds = await SheetChunk.find({ sheetId }).session(session).distinct("_id");
        if (await HazardRecord.exists({ inspectionId, sheetChunkId: { $in: chunkIds } }).session(session)) {
            throw rule("Hazards from this sheet are still recorded on this inspection. Remove them first.");
        }
        const { deletedCount } = await InspectionSheet.deleteOne({ inspectionId, sheetId }, { session });
        if (deletedCount === 0) throw notFound("selected sheet");
        await bumpRevision([inspectionId], session);
    });
}

export function setChecklistStatus({ inspectionId, checklistItemId, status }) {
    return inTransaction(async (session) => {
        await mustFind(Inspection, inspectionId, "inspection", session);
        await mustFind(ChecklistItem, checklistItemId, "checklist step", session);
        return InspectionChecklistItem.findOneAndUpdate(
            { inspectionId, checklistItemId },
            { $set: { status, updatedAt: new Date() } },
            { upsert: true, new: true, runValidators: true, session },
        );
    });
}

// ---------- Hazards and photos ----------

export function addHazard({ inspectionId, sheetChunkId = null, customName = null }) {
    return inTransaction((session) => addHazardIn(session, { inspectionId, sheetChunkId, customName }));
}

async function addHazardIn(session, { inspectionId, sheetChunkId, customName }) {
    await mustFind(Inspection, inspectionId, "inspection", session);
    if (sheetChunkId) {
        const chunk = await mustFind(SheetChunk, sheetChunkId, "sheet entry", session);
        // A sheet hazard can only come from a sheet confirmed for this inspection
        if (!(await InspectionSheet.exists({ inspectionId, sheetId: chunk.sheetId }).session(session))) {
            throw rule("That hazard is from a sheet that isn't selected for this inspection.");
        }
    }
    try {
        const [created] = await HazardRecord.create([{ inspectionId, sheetChunkId, customName }], { session });
        await bumpRevision([inspectionId], session);
        return created;
    } catch (err) {
        if (isDuplicateKey(err)) throw rule("That sheet hazard is already on this inspection.");
        throw err;
    }
}

const EDITABLE_HAZARD_FIELDS = ["comment", "isNotApplicable", "customName"];

export function updateHazard(hazardRecordId, changes) {
    return inTransaction(async (session) => {
        const hazard = await mustFind(HazardRecord, hazardRecordId, "hazard", session);
        for (const key of Object.keys(changes)) {
            if (!EDITABLE_HAZARD_FIELDS.includes(key)) throw rule(`${key} can't be changed.`);
            if (key === "customName" && hazard.sheetChunkId) throw rule("A sheet hazard takes its name from the sheet.");
            hazard[key] = changes[key];
        }
        await hazard.save({ session });
        await bumpRevision([hazard.inspectionId], session);
        return hazard;
    });
}

export function deleteHazard(hazardRecordId) {
    return inTransaction(async (session) => {
        const hazard = await mustFind(HazardRecord, hazardRecordId, "hazard", session);
        await Photo.deleteMany({ hazardRecordId }, { session });
        await AiSuggestion.deleteMany({ hazardRecordId }, { session });
        await HazardRecord.deleteOne({ _id: hazardRecordId }, { session });
        await bumpRevision([hazard.inspectionId], session);
    });
}

export function addPhoto({ hazardRecordId, ...photo }) {
    return inTransaction(async (session) => {
        const hazard = await mustFind(HazardRecord, hazardRecordId, "hazard", session);
        try {
            const [created] = await Photo.create([{ hazardRecordId, ...photo }], { session });
            await bumpRevision([hazard.inspectionId], session);
            return created;
        } catch (err) {
            if (isDuplicateKey(err)) throw rule("This photo is already attached to this hazard.");
            throw err;
        }
    });
}

export function deletePhoto(photoId) {
    return inTransaction(async (session) => {
        const photo = await mustFind(Photo, photoId, "photo", session);
        const hazard = await mustFind(HazardRecord, photo.hazardRecordId, "hazard", session);
        await Photo.deleteOne({ _id: photoId }, { session });
        await bumpRevision([hazard.inspectionId], session);
    });
}

// ---------- AI suggestions ----------

// Logs a suggestion the officer dismissed, or one that failed or found no hazard
export function recordAiSuggestion({ inspectionId, ...suggestion }) {
    if (suggestion.outcome === "accepted") throw rule("Use acceptAiSuggestion for an accepted suggestion.");
    return inTransaction(async (session) => {
        await mustFind(Inspection, inspectionId, "inspection", session);
        const [created] = await AiSuggestion.create([{ inspectionId, ...suggestion, hazardRecordId: null }], { session });
        return created;
    });
}

// The officer accepted Gemini's hazard name: the hazard and the log entry are written together,
// so an accepted suggestion always points to a hazard in the same inspection.
export function acceptAiSuggestion({ inspectionId, suggestedName, inputText = null, hasPhoto, modelName, latencyMs = null }) {
    return inTransaction(async (session) => {
        const hazard = await addHazardIn(session, { inspectionId, sheetChunkId: null, customName: suggestedName });
        const [suggestion] = await AiSuggestion.create(
            [{ inspectionId, hazardRecordId: hazard._id, inputText, hasPhoto, modelName, suggestedName, outcome: "accepted", latencyMs }],
            { session },
        );
        return { hazard, suggestion };
    });
}

// ---------- Summary review and completion ----------

// revision is the one the officer was looking at (from getInspectionSummary).
// Reviewing the same revision twice returns the first review. (A duplicate-key error aborts a MongoDB transaction,
// so the existing review is looked up first, and again after the transaction if two devices raced.)
export async function recordSummaryReview({ inspectionId, revision }) {
    try {
        return await inTransaction(async (session) => {
            const inspection = await mustFind(Inspection, inspectionId, "inspection", session);
            if (inspection.revision !== revision) {
                throw rule("Something changed since you opened the Summary. Review it again.");
            }
            const existing = await Summary.findOne({ inspectionId, revision }).session(session);
            if (existing) return existing;
            const [created] = await Summary.create([{ inspectionId, revision }], { session });
            return created;
        });
    } catch (err) {
        if (isDuplicateKey(err)) return Summary.findOne({ inspectionId, revision });
        throw err;
    }
}

export function markFindingsCopied(summaryId) {
    return Summary.findOneAndUpdate({ _id: summaryId, copiedAt: null }, { $set: { copiedAt: new Date() } }, { new: true });
}

// "Before I leave the site": completing needs a review of the current revision. The conditional update writes the
// inspection document, so a photo saved at the same moment conflicts with it and the transaction re-runs and re-checks.
export function completeInspection(inspectionId) {
    return inTransaction(async (session) => {
        const inspection = await mustFind(Inspection, inspectionId, "inspection", session);
        if (inspection.completedAt) throw rule("This inspection is already complete.");
        if (!(await Summary.exists({ inspectionId, revision: inspection.revision }).session(session))) {
            throw rule("Review the Summary before completing the inspection.");
        }
        const now = new Date();
        const { modifiedCount } = await Inspection.updateOne(
            { _id: inspectionId, revision: inspection.revision, completedAt: null },
            { $set: { completedAt: now, updatedAt: now } },
            { session },
        );
        if (modifiedCount !== 1) throw new DataRuleError("CONFLICT", "The inspection changed while completing. Try again.");
        return Inspection.findById(inspectionId).session(session);
    });
}

// ---------- Deletes (cascade, like ON DELETE CASCADE in the ERD) ----------

async function deleteInspectionsIn(session, inspectionIds) {
    if (inspectionIds.length === 0) return;
    const hazardIds = await HazardRecord.find({ inspectionId: { $in: inspectionIds } }).session(session).distinct("_id");
    await Photo.deleteMany({ hazardRecordId: { $in: hazardIds } }, { session });
    await AiSuggestion.deleteMany({ inspectionId: { $in: inspectionIds } }, { session });
    await HazardRecord.deleteMany({ inspectionId: { $in: inspectionIds } }, { session });
    await Summary.deleteMany({ inspectionId: { $in: inspectionIds } }, { session });
    await InspectionSheet.deleteMany({ inspectionId: { $in: inspectionIds } }, { session });
    await InspectionChecklistItem.deleteMany({ inspectionId: { $in: inspectionIds } }, { session });
    await Inspection.deleteMany({ _id: { $in: inspectionIds } }, { session });
}

export function deleteInspection(inspectionId) {
    return inTransaction(async (session) => {
        await mustFind(Inspection, inspectionId, "inspection", session);
        await deleteInspectionsIn(session, [inspectionId]);
    });
}

export function deleteJobSite(jobSiteId) {
    return inTransaction(async (session) => {
        await mustFind(JobSite, jobSiteId, "job site", session);
        const inspectionIds = await Inspection.find({ jobSiteId }).session(session).distinct("_id");
        await deleteInspectionsIn(session, inspectionIds);
        await JobSite.deleteOne({ _id: jobSiteId }, { session });
    });
}

// Removes an officer and everything they recorded. Their sign-in sessions are removed too: connect-mongo stores each
// session as a JSON string, so they are matched on the userId inside it.
export function deleteUser(userId) {
    return inTransaction(async (session) => {
        await mustFind(User, userId, "account", session);
        const jobSiteIds = await JobSite.find({ userId }).session(session).distinct("_id");
        const inspectionIds = await Inspection.find({ jobSiteId: { $in: jobSiteIds } }).session(session).distinct("_id");
        await deleteInspectionsIn(session, inspectionIds);
        await JobSite.deleteMany({ userId }, { session });
        await mongoose.connection.collection("sessions").deleteMany({ session: { $regex: `"userId":"${String(userId)}"` } }, { session });
        await User.deleteOne({ _id: userId }, { session });
    });
}
