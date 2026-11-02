// summaries: the officer's review of the Summary screen before leaving the site.
// Stores only the act of reviewing: which revision of the inspection they saw, and when.
// What the Summary shows is calculated (server/db/summary.js), so it can never disagree with the hazards and photos.
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, objectId, date, nullableDate, int } from "./schemaHelpers.js";

const summarySchema = new mongoose.Schema(
    {
        // A review is a record of what happened: only copiedAt may be filled in afterwards
        inspectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Inspection", required: true, immutable: true },
        revision: { type: Number, required: true, min: 0, validate: Number.isInteger, immutable: true },
        reviewedAt: { type: Date, required: true, default: Date.now, immutable: true },
        copiedAt: { type: Date, default: null },
    },
    schemaOptions("summaries"),
);
summarySchema.index({ inspectionId: 1, revision: 1 }, { unique: true });

export const validator = {
    $jsonSchema: jsonSchema({ inspectionId: objectId, revision: int(0), reviewedAt: date, copiedAt: nullableDate }),
    $expr: { $or: [{ $eq: ["$copiedAt", null] }, { $gte: ["$copiedAt", "$reviewedAt"] }] },
};

export default mongoose.model("Summary", summarySchema);
