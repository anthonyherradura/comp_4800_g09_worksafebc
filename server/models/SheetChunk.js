// sheetChunks: one hazard row or text block from a sheet, copied word for word by scripts/extract_sheets.py.
// _id keeps the app's id ("cu-766011-003" = sheetId + 3-digit seq). Read-only reference data.
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, int, text, nullable } from "./schemaHelpers.js";

const sheetChunkSchema = new mongoose.Schema(
    {
        _id: { type: String, match: /^cu-\d{6}-\d{3}$/ },
        sheetId: { type: String, ref: "Sheet", required: true },
        sheetSectionId: { type: Number, ref: "SheetSection", required: true },
        seq: {
            type: Number,
            required: true,
            min: 1,
            max: 999,
            // whole number, and _id is sheetId + "-" + seq padded to 3 digits
            validate: {
                validator(value) { return Number.isInteger(value) && this._id === `${this.sheetId}-${String(value).padStart(3, "0")}`; },
                message: "Sheet entry id must be the sheet id plus its 3-digit number.",
            },
        },
        heading: { type: String, required: true },
        bodyText: { type: String, required: true },
        pageNo: { type: Number, min: 1, default: null },
    },
    schemaOptions("sheetChunks"),
);
sheetChunkSchema.index({ sheetId: 1, seq: 1 }, { unique: true });
sheetChunkSchema.index({ sheetId: 1, sheetSectionId: 1 });
sheetChunkSchema.index({ sheetSectionId: 1 });

// "cu-766011" + "-" + seq padded to 3 digits
const paddedSeq = { $substrCP: [{ $concat: ["00", { $toString: "$seq" }] }, { $subtract: [{ $strLenCP: { $concat: ["00", { $toString: "$seq" }] } }, 3] }, 3] };

export const validator = {
    $jsonSchema: jsonSchema({
        _id: { bsonType: "string", pattern: "^cu-[0-9]{6}-[0-9]{3}$" },
        sheetId: { bsonType: "string", pattern: "^cu-[0-9]{6}$" },
        sheetSectionId: int(1),
        seq: int(1, 999),
        heading: text(),
        bodyText: text(),
        pageNo: nullable(int(1)),
    }),
    $expr: { $eq: ["$_id", { $concat: ["$sheetId", "-", paddedSeq] }] },
};

export default mongoose.model("SheetChunk", sheetChunkSchema);
