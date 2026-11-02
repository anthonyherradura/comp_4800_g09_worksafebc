// inspectionSheets: the protocol sheets an officer confirmed for a visit (framing + scaffolds), and how each was chosen.
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, objectId, date, bool, oneOf } from "./schemaHelpers.js";

export const SELECTED_VIA = ["photo", "search", "browse"];

const inspectionSheetSchema = new mongoose.Schema(
    {
        inspectionId: { type: mongoose.Schema.Types.ObjectId, ref: "Inspection", required: true },
        sheetId: { type: String, ref: "Sheet", required: true },
        selectedVia: { type: String, required: true, enum: SELECTED_VIA },
        isPrimary: { type: Boolean, required: true, default: false },
        confirmedAt: { type: Date, required: true, default: Date.now },
    },
    schemaOptions("inspectionSheets"),
);
inspectionSheetSchema.index({ inspectionId: 1, sheetId: 1 }, { unique: true });
inspectionSheetSchema.index({ inspectionId: 1 }, { unique: true, partialFilterExpression: { isPrimary: true }, name: "onePrimaryPerInspection" });
inspectionSheetSchema.index({ sheetId: 1 });

export const validator = {
    $jsonSchema: jsonSchema({
        inspectionId: objectId,
        sheetId: { bsonType: "string", pattern: "^cu-[0-9]{6}$" },
        selectedVia: oneOf(...SELECTED_VIA),
        isPrimary: bool,
        confirmedAt: date,
    }),
};

export default mongoose.model("InspectionSheet", inspectionSheetSchema);
