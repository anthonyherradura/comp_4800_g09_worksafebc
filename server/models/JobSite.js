// jobSites: a site the officer works at (today kept in localStorage by src/context/JobContext.jsx).
// A label is unique per officer, ignoring case and extra spaces: re-adding "oak st.  TOWER" reopens "Oak St. tower".
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, objectId, date, normaliseLabel, caseInsensitive } from "./schemaHelpers.js";

const jobSiteSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        label: { type: String, required: true, maxlength: 200, set: normaliseLabel },
        createdAt: { type: Date, required: true, default: Date.now },
        lastOpenedAt: { type: Date, required: true, default: Date.now },
    },
    schemaOptions("jobSites"),
);
jobSiteSchema.index({ userId: 1, label: 1 }, { unique: true, collation: caseInsensitive });
jobSiteSchema.index({ userId: 1, lastOpenedAt: -1 });

export const validator = {
    $jsonSchema: jsonSchema({
        userId: objectId,
        // stored already trimmed with single spaces
        label: { bsonType: "string", minLength: 1, maxLength: 200, pattern: "^\\S(.*\\S)?$", not: { pattern: "\\s{2}" } },
        createdAt: date,
        lastOpenedAt: date,
    }),
    $expr: { $gte: ["$lastOpenedAt", "$createdAt"] },
};

export default mongoose.model("JobSite", jobSiteSchema);
