// MongoDB's own check on every write to jobs and photos ($jsonSchema). The Mongoose models are the main check;
// this is the backstop, so a script, a mongosh command or a teammate's new code can't save a malformed document.
// Built from limits.js, so `npm run db:setup` after changing a limit keeps both in step.
// `users` is left to the auth code's Mongoose model.
import { CHECKLIST_STATUSES, LIMITS, PHOTO_TYPES } from "./limits.js";

const str = (maxLength, minLength = 0) => ({ bsonType: "string", minLength, maxLength });
const date = { bsonType: "date" };
const id = { bsonType: "objectId" };

const hazard = {
    bsonType: "object",
    required: ["_id", "source", "name", "comment", "notApplicable", "photoIds", "createdAt"],
    properties: {
        _id: id,
        source: { enum: ["sheet", "officer"] },
        sheetId: { bsonType: "string", minLength: 1 },
        sheetKey: { bsonType: "string", minLength: 1 },
        name: str(LIMITS.hazardNameChars, 1),
        comment: str(LIMITS.commentChars),
        notApplicable: { bsonType: "bool" },
        photoIds: { bsonType: "array", maxItems: LIMITS.photosPerHazard, items: id },
        createdAt: date,
    },
    additionalProperties: false,
    // A sheet hazard says which sheet entry it is; an officer's hazard doesn't
    oneOf: [
        { properties: { source: { enum: ["sheet"] } }, required: ["sheetId", "sheetKey"] },
        { properties: { source: { enum: ["officer"] } }, not: { anyOf: [{ required: ["sheetId"] }, { required: ["sheetKey"] }] } },
    ],
};

export const jobsValidator = {
    $jsonSchema: {
        bsonType: "object",
        required: ["userId", "label", "sheetId", "checklist", "visitNotes", "visitNotesUpdatedAt", "hazards", "lastOpenedAt", "rev", "createdAt", "updatedAt"],
        properties: {
            _id: id,
            userId: id,
            label: str(LIMITS.labelChars, 1),
            sheetId: { bsonType: ["string", "null"] },
            checklist: { bsonType: "object", additionalProperties: { enum: [...CHECKLIST_STATUSES] } },
            visitNotes: str(LIMITS.visitNotesChars),
            visitNotesUpdatedAt: { bsonType: ["date", "null"] },
            hazards: { bsonType: "array", maxItems: LIMITS.hazardsPerJob, items: hazard },
            lastOpenedAt: date,
            rev: { bsonType: ["int", "long", "double"], minimum: 0 },
            createdAt: date,
            updatedAt: date,
        },
        additionalProperties: false,
    },
};

export const photosValidator = {
    $jsonSchema: {
        bsonType: "object",
        required: ["userId", "jobId", "hazardId", "contentType", "data", "size", "createdAt"],
        properties: {
            _id: id,
            userId: id,
            jobId: id,
            hazardId: id,
            contentType: { enum: [...PHOTO_TYPES] },
            data: { bsonType: "binData" },
            size: { bsonType: ["int", "long", "double"], minimum: 1, maximum: LIMITS.photoBytes },
            createdAt: date,
        },
        additionalProperties: false,
    },
};
