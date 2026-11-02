// inspectionChecklistItems: where each Planning step stands for one visit (matches STATUSES in src/pages/Planning/Planning.jsx).
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, objectId, date, oneOf } from "./schemaHelpers.js";

export const CHECKLIST_STATUSES = ["pending", "ready", "not_applicable"];

const inspectionChecklistItemSchema = new mongoose.Schema(
    {
        inspectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Inspection", required: true },
        checklistItemId: { type: String, ref: "ChecklistItem", required: true },
        status: { type: String, required: true, enum: CHECKLIST_STATUSES, default: "pending" },
        updatedAt: { type: Date, required: true, default: Date.now },
    },
    schemaOptions("inspectionChecklistItems", { timestamps: { createdAt: false, updatedAt: "updatedAt" } }),
);
inspectionChecklistItemSchema.index({ inspectionId: 1, checklistItemId: 1 }, { unique: true });
inspectionChecklistItemSchema.index({ checklistItemId: 1 });

export const validator = {
    $jsonSchema: jsonSchema({
        inspectionId: objectId,
        checklistItemId: { bsonType: "string", pattern: "^[a-z][a-z_]*$" },
        status: oneOf(...CHECKLIST_STATUSES),
        updatedAt: date,
    }),
};

export default mongoose.model("InspectionChecklistItem", inspectionChecklistItemSchema);
