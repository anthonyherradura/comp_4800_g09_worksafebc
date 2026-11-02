// regulations: one citation, e.g. OHSR 4.32-4.42 or WCA 21. Read-only reference data.
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, int, text, oneOf } from "./schemaHelpers.js";

export const INSTRUMENTS = ["OHSR", "WCA"];

const regulationSchema = new mongoose.Schema(
    {
        _id: { type: Number, min: 1, validate: Number.isInteger },
        instrument: { type: String, required: true, enum: INSTRUMENTS },
        reference: { type: String, required: true, trim: true },
    },
    schemaOptions("regulations"),
);
regulationSchema.index({ instrument: 1, reference: 1 }, { unique: true });

export const validator = {
    $jsonSchema: jsonSchema({ _id: int(1), instrument: oneOf(...INSTRUMENTS), reference: text() }),
};

export default mongoose.model("Regulation", regulationSchema);
