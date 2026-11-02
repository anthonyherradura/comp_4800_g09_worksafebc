// sheetSections: section names such as "Regulations to Consider". isHazardSection marks the sections whose
// entries the Summary must account for. Read-only reference data.
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, int, text, bool } from "./schemaHelpers.js";

const sheetSectionSchema = new mongoose.Schema(
    {
        _id: { type: Number, min: 1, validate: Number.isInteger },
        name: { type: String, required: true, unique: true, trim: true },
        isHazardSection: { type: Boolean, required: true, default: false },
    },
    schemaOptions("sheetSections"),
);

export const validator = {
    $jsonSchema: jsonSchema({ _id: int(1), name: text(), isHazardSection: bool }),
};

export default mongoose.model("SheetSection", sheetSectionSchema);
