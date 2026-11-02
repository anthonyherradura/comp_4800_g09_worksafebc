// aiSuggestions: each Gemini hazard-name suggestion and what the officer did with it.
// hazardRecordId is set only when accepted, and must be a hazard in the same inspection (server/db/operations.js).
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, objectId, date, bool, oneOf, MAX_AI_INPUT_CHARS } from "./schemaHelpers.js";

export const AI_OUTCOMES = ["accepted", "dismissed", "no_hazard", "error"];

const aiSuggestionSchema = new mongoose.Schema(
    {
        inspectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Inspection", required: true },
        hazardRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "HazardRecord", default: null },
        inputText: { type: String, default: null, maxlength: MAX_AI_INPUT_CHARS },
        hasPhoto: { type: Boolean, required: true },
        modelName: { type: String, default: null },
        suggestedName: { type: String, default: null },
        outcome: { type: String, required: true, enum: AI_OUTCOMES },
        latencyMs: { type: Number, default: null, min: 0 },
        createdAt: { type: Date, required: true, default: Date.now },
    },
    schemaOptions("aiSuggestions"),
);
aiSuggestionSchema.index({ inspectionId: 1, createdAt: 1 });
aiSuggestionSchema.index({ hazardRecordId: 1 }, { partialFilterExpression: { hazardRecordId: { $type: "objectId" } } });
aiSuggestionSchema.index({ createdAt: 1 });

export const validator = {
    $jsonSchema: jsonSchema({
        inspectionId: objectId,
        hazardRecordId: { bsonType: ["objectId", "null"] },
        inputText: { bsonType: ["string", "null"], maxLength: MAX_AI_INPUT_CHARS },
        hasPhoto: bool,
        modelName: { bsonType: ["string", "null"] },
        suggestedName: { bsonType: ["string", "null"] },
        outcome: oneOf(...AI_OUTCOMES),
        latencyMs: { bsonType: ["int", "null"], minimum: 0 },
        createdAt: date,
    }),
    $expr: {
        $and: [
            // the officer gave text or a photo
            { $or: [{ $ne: ["$inputText", null] }, "$hasPhoto"] },
            // accepted <=> linked to a hazard
            { $eq: [{ $eq: ["$outcome", "accepted"] }, { $ne: ["$hazardRecordId", null] }] },
            // anything but an error names the model and what it said
            { $or: [{ $eq: ["$outcome", "error"] }, { $and: [{ $ne: ["$modelName", null] }, { $ne: ["$suggestedName", null] }] }] },
        ],
    },
};

export default mongoose.model("AiSuggestion", aiSuggestionSchema);
