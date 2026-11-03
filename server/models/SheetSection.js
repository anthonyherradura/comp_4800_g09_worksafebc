// sheetSections: section names such as "Regulations to Consider". Read-only reference data.
// (Which entries are hazards is decided per entry: see sheetChunks.isHazard.)
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, int, text } from "./schemaHelpers.js";

const sheetSectionSchema = new mongoose.Schema(
    {
        _id: { type: Number, min: 1, validate: Number.isInteger },
        name: { type: String, required: true, unique: true, trim: true },
    },
    schemaOptions("sheetSections"),
);

export const validator = {
    $jsonSchema: jsonSchema({ _id: int(1), name: text() }),
};

export default mongoose.model("SheetSection", sheetSectionSchema);
