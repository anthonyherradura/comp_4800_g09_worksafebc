// sheets: one HIIPS protocol sheet (one per classification unit). Read-only; loaded by scripts/db-setup.mjs.
// _id keeps the app's existing id ("cu-766011") so offline search (src/search) and the database agree.
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, date, nullable, text } from "./schemaHelpers.js";

const sheetSchema = new mongoose.Schema(
    {
        _id: { type: String, match: /^cu-\d{6}$/ },
        cuNumber: { type: String, required: true, unique: true, match: /^\d{6}$/ },
        // The CU number lives in cuNumber only, never repeated in the title
        title: { type: String, required: true, trim: true, validate: (v) => !/\(CU \d+\)/i.test(v) },
        issuedOn: { type: Date, required: true },
        copyright: { type: String, default: null },
        sourceFile: { type: String, required: true, unique: true },
    },
    schemaOptions("sheets"),
);

export const validator = {
    $jsonSchema: jsonSchema({
        _id: { bsonType: "string", pattern: "^cu-[0-9]{6}$" },
        cuNumber: { bsonType: "string", pattern: "^[0-9]{6}$" },
        title: { bsonType: "string", minLength: 1, not: { pattern: "\\(CU [0-9]+\\)" } },
        issuedOn: date,
        copyright: nullable(text()),
        sourceFile: text(),
    }),
    // _id is "cu-" + cuNumber
    $expr: { $eq: ["$_id", { $concat: ["cu-", "$cuNumber"] }] },
};

export default mongoose.model("Sheet", sheetSchema);
