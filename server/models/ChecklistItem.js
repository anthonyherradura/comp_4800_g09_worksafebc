// checklistItems: the Planning page's preparation steps. _id is a readable code ("equipment").
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, int, text } from "./schemaHelpers.js";

const checklistItemSchema = new mongoose.Schema(
    {
        _id: { type: String, match: /^[a-z][a-z_]*$/ },
        label: { type: String, required: true, unique: true, trim: true },
        sortOrder: { type: Number, required: true, unique: true, min: 1, validate: Number.isInteger },
    },
    schemaOptions("checklistItems"),
);

export const validator = {
    $jsonSchema: jsonSchema({ _id: { bsonType: "string", pattern: "^[a-z][a-z_]*$" }, label: text(), sortOrder: int(1) }),
};

export default mongoose.model("ChecklistItem", checklistItemSchema);
