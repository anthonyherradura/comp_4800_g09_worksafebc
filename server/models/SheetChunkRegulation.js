// sheetChunkRegulations: which regulations a sheet chunk cites (many-to-many). Replaces the regulations[] array in the JSON.
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, int } from "./schemaHelpers.js";

const sheetChunkRegulationSchema = new mongoose.Schema(
    {
        sheetChunkId: { type: String, ref: "SheetChunk", required: true },
        regulationId: { type: Number, ref: "Regulation", required: true },
    },
    schemaOptions("sheetChunkRegulations"),
);
sheetChunkRegulationSchema.index({ sheetChunkId: 1, regulationId: 1 }, { unique: true });
sheetChunkRegulationSchema.index({ regulationId: 1 });

export const validator = {
    $jsonSchema: jsonSchema({ sheetChunkId: { bsonType: "string", pattern: "^cu-[0-9]{6}-[0-9]{3}$" }, regulationId: int(1) }),
};

export default mongoose.model("SheetChunkRegulation", sheetChunkRegulationSchema);
