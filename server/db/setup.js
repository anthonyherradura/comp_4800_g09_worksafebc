// Prepares the database: creates jobs and photos with their validators, then builds every model's indexes.
// Shared by scripts/db-setup.mjs and tests/db/. Safe to run again: an existing collection just gets
// its validator replaced (collMod), so changing limits.js and re-running brings MongoDB in step.
import mongoose from "mongoose";
import Job from "../models/Job.js";
import Photo from "../models/Photo.js";
import User from "../models/User.js";
import { jobsValidator, photosValidator } from "./validators.js";

const NAMESPACE_EXISTS = 48;

const VALIDATED = [
    { model: Job, validator: jobsValidator },
    { model: Photo, validator: photosValidator },
];

// Collections from the earlier 14-collection design. Nothing uses them now; db:setup reports them so they
// can be dropped by hand (it never deletes data on its own).
export const OLD_COLLECTIONS = [
    "sheets", "sheetSections", "sheetChunks", "regulations", "sheetChunkRegulations", "checklistItems",
    "jobSites", "inspections", "inspectionSheets", "inspectionChecklistItems", "hazardRecords",
    "aiSuggestions", "summaries",
];

async function applyValidator({ model, validator }) {
    const db = mongoose.connection.db;
    const name = model.collection.collectionName;
    try {
        await db.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" });
        return `${name}: created with validator`;
    } catch (err) {
        if (err.code !== NAMESPACE_EXISTS) throw err;
        await db.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
        return `${name}: validator updated`;
    }
}

// Returns one line per step, for the setup script to print
export async function applySchema() {
    const lines = [];
    for (const entry of VALIDATED) lines.push(await applyValidator(entry));
    for (const model of [User, Job, Photo]) {
        await model.syncIndexes();
        const names = Object.keys(await model.collection.indexInformation()).join(", ");
        lines.push(`${model.collection.collectionName}: indexes ${names}`);
    }
    return lines;
}

export async function oldCollectionsPresent() {
    const names = (await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    return OLD_COLLECTIONS.filter((n) => names.includes(n));
}
