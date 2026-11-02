// hazardRecords: a hazard the officer is tracking on a visit.
//   - Its name comes from exactly one place: the sheet (sheetChunkId) or the officer/AI (customName).
//   - A sheet hazard appears at most once per inspection.
//   - Status (unaddressed / reviewed / not applicable) and origin (sheet / ai / officer) are derived,
//     never stored: see server/db/summary.js.
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, objectId, date, bool, MAX_COMMENT_CHARS } from "./schemaHelpers.js";

const hazardRecordSchema = new mongoose.Schema(
    {
        inspectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Inspection", required: true },
        sheetChunkId: { type: String, ref: "SheetChunk", default: null },
        customName: {
            type: String,
            default: null,
            trim: true,
            maxlength: 120,
            // the name comes from exactly one place: the sheet entry or this field
            validate: {
                validator(value) { return (this.sheetChunkId == null) !== (value == null); },
                message: "A hazard needs either a sheet entry or a name, not both.",
            },
        },
        comment: { type: String, default: "", maxlength: MAX_COMMENT_CHARS },
        isNotApplicable: { type: Boolean, required: true, default: false },
        createdAt: { type: Date, required: true, default: Date.now },
        updatedAt: { type: Date, required: true, default: Date.now },
    },
    schemaOptions("hazardRecords", { timestamps: true }),
);
hazardRecordSchema.index(
    { inspectionId: 1, sheetChunkId: 1 },
    { unique: true, partialFilterExpression: { sheetChunkId: { $type: "string" } }, name: "sheetHazardOncePerInspection" },
);
hazardRecordSchema.index({ inspectionId: 1, createdAt: 1 });
hazardRecordSchema.index({ sheetChunkId: 1 }, { partialFilterExpression: { sheetChunkId: { $type: "string" } } });

export const validator = {
    $jsonSchema: jsonSchema({
        inspectionId: objectId,
        sheetChunkId: { bsonType: ["string", "null"], pattern: "^cu-[0-9]{6}-[0-9]{3}$" },
        customName: { bsonType: ["string", "null"], minLength: 1, maxLength: 120 },
        comment: { bsonType: "string", maxLength: MAX_COMMENT_CHARS },
        isNotApplicable: bool,
        createdAt: date,
        updatedAt: date,
    }),
    // exactly one of sheetChunkId / customName
    $expr: { $ne: [{ $eq: ["$sheetChunkId", null] }, { $eq: ["$customName", null] }] },
};

export default mongoose.model("HazardRecord", hazardRecordSchema);
