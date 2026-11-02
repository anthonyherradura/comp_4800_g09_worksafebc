// inspections: one visit to a job site.
//   - At most one open inspection (completedAt: null) per job site, enforced by a partial unique index.
//   - revision goes up by one whenever a hazard, photo or selected sheet changes (server/db/operations.js),
//     so a Summary review can tell whether it still matches what is recorded.
//   - completedAt can only be set once the current revision has been reviewed (operations.completeInspection).
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, objectId, date, nullableDate, int } from "./schemaHelpers.js";

const inspectionSchema = new mongoose.Schema(
    {
        jobSiteId: { type: mongoose.Schema.Types.ObjectId, ref: "JobSite", required: true },
        startedAt: { type: Date, required: true, default: Date.now },
        // Always present (null while open) so the "one open inspection" index can see it
        completedAt: { type: Date, default: null },
        planningNotes: { type: String, default: "", maxlength: 5000 },
        revision: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
        updatedAt: { type: Date, required: true, default: Date.now },
    },
    schemaOptions("inspections", { timestamps: { createdAt: false, updatedAt: "updatedAt" } }),
);
inspectionSchema.index({ jobSiteId: 1 }, { unique: true, partialFilterExpression: { completedAt: { $type: "null" } }, name: "oneOpenPerJobSite" });
inspectionSchema.index({ jobSiteId: 1, startedAt: -1 });

export const validator = {
    $jsonSchema: jsonSchema({
        jobSiteId: objectId,
        startedAt: date,
        completedAt: nullableDate,
        planningNotes: { bsonType: "string", maxLength: 5000 },
        revision: int(0),
        updatedAt: date,
    }),
    $expr: { $or: [{ $eq: ["$completedAt", null] }, { $gte: ["$completedAt", "$startedAt"] }] },
};

export default mongoose.model("Inspection", inspectionSchema);
