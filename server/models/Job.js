// A job site and everything recorded at it: the protocol sheet, the Planning checklist, visit notes and the hazards.
// The hazards are embedded (a job has at most LIMITS.hazardsPerJob and every screen reads them together),
// so picking a sheet or deleting a job changes one document and can never leave half its data behind.
// Photos are too big to embed; each one is its own document in `photos` (models/Photo.js).
import mongoose from "mongoose";
import { CHECKLIST_STATUSES, LIMITS } from "../db/limits.js";

const { ObjectId } = mongoose.Schema.Types;

// Case-insensitive, accent-sensitive: "Oak St" and "oak st" are the same job site
export const LABEL_COLLATION = Object.freeze({ locale: "en", strength: 2 });

const maxItems = (max, what) => ({ validator: (list) => list.length <= max, message: `At most ${max} ${what}.` });

const hazardSchema = new mongoose.Schema(
    {
        source: { type: String, required: true, enum: ["sheet", "officer"] },
        // Only for sheet hazards: which sheet entry it is. The guidance is read from the sheet with these.
        sheetId: { type: String, default: undefined },
        sheetKey: { type: String, default: undefined },
        name: { type: String, required: true, trim: true, minlength: 1, maxlength: LIMITS.hazardNameChars },
        comment: { type: String, default: "", maxlength: LIMITS.commentChars },
        notApplicable: { type: Boolean, default: false },
        photoIds: { type: [ObjectId], default: [], validate: maxItems(LIMITS.photosPerHazard, "photos per hazard") },
        createdAt: { type: Date, default: Date.now },
    },
    { minimize: false },
);

// A sheet hazard says which sheet entry it is; a hazard the officer added doesn't
hazardSchema.path("source").validate(function sheetFields(source) {
    const hasSheet = Boolean(this.sheetId) && Boolean(this.sheetKey);
    const hasNone = this.sheetId == null && this.sheetKey == null;
    return source === "sheet" ? hasSheet : hasNone;
}, "A sheet hazard needs sheetId and sheetKey, and an officer's hazard has neither.");

const jobSchema = new mongoose.Schema(
    {
        userId: { type: ObjectId, ref: "User", required: true },
        label: { type: String, required: true, trim: true, minlength: 1, maxlength: LIMITS.labelChars },
        sheetId: { type: String, default: null },
        // Planning checklist: item id -> "ready" | "not-applicable". Missing means "To review".
        checklist: { type: Map, of: { type: String, enum: CHECKLIST_STATUSES }, default: () => ({}) },
        visitNotes: { type: String, default: "", maxlength: LIMITS.visitNotesChars },
        visitNotesUpdatedAt: { type: Date, default: null },
        hazards: { type: [hazardSchema], default: [], validate: maxItems(LIMITS.hazardsPerJob, "hazards per job") },
        lastOpenedAt: { type: Date, required: true, default: Date.now },
        // Goes up by one on every change, so a write based on an old copy can be refused (see routes/jobs.js)
        rev: { type: Number, default: 0 },
    },
    { timestamps: true, minimize: false, versionKey: false },
);

// One label per officer, ignoring case. The database refuses a duplicate even if two requests race.
jobSchema.index({ userId: 1, label: 1 }, { unique: true, collation: LABEL_COLLATION });
// The Jobs page: my jobs, most recently opened first (the first one is the current job)
jobSchema.index({ userId: 1, lastOpenedAt: -1 });

// Every update bumps rev
jobSchema.pre(["updateOne", "findOneAndUpdate", "updateMany"], function bumpRev() {
    const update = this.getUpdate();
    if (Array.isArray(update)) return; // pipeline updates aren't used on jobs
    update.$inc = { ...update.$inc, rev: 1 };
});

// What the app receives: ids as strings under `id`, no userId
const toClient = (doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.userId;
    if (ret.hazards) {
        ret.hazards = ret.hazards.map(({ _id, photoIds, ...h }) => ({ id: String(_id), ...h, photoIds: photoIds.map(String) }));
    }
    if (ret.checklist instanceof Map) ret.checklist = Object.fromEntries(ret.checklist);
    return ret;
};
jobSchema.set("toJSON", { transform: toClient, flattenMaps: true });

export default mongoose.model("Job", jobSchema);
