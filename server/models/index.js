// Every collection the API stores, in dependency order (a collection only refers to ones above it).
// scripts/db-setup.mjs applies each validator and builds each model's indexes from this list.
import User from "./User.js";
import Sheet, { validator as sheetValidator } from "./Sheet.js";
import SheetSection, { validator as sheetSectionValidator } from "./SheetSection.js";
import SheetChunk, { validator as sheetChunkValidator } from "./SheetChunk.js";
import Regulation, { validator as regulationValidator } from "./Regulation.js";
import SheetChunkRegulation, { validator as sheetChunkRegulationValidator } from "./SheetChunkRegulation.js";
import ChecklistItem, { validator as checklistItemValidator } from "./ChecklistItem.js";
import JobSite, { validator as jobSiteValidator } from "./JobSite.js";
import Inspection, { validator as inspectionValidator } from "./Inspection.js";
import InspectionSheet, { validator as inspectionSheetValidator } from "./InspectionSheet.js";
import InspectionChecklistItem, { validator as inspectionChecklistItemValidator } from "./InspectionChecklistItem.js";
import HazardRecord, { validator as hazardRecordValidator } from "./HazardRecord.js";
import Photo, { validator as photoValidator } from "./Photo.js";
import AiSuggestion, { validator as aiSuggestionValidator } from "./AiSuggestion.js";
import Summary, { validator as summaryValidator } from "./Summary.js";

// User.js predates this folder and is left unchanged; its validator lives here. It is looser than the others
// (existing documents carry Mongoose's __v), but still rejects a missing field, an upper-case email or a non-bcrypt hash.
const userValidator = {
    $jsonSchema: {
        bsonType: "object",
        required: ["name", "email", "passwordHash"],
        properties: {
            name: { bsonType: "string", minLength: 1 },
            email: { bsonType: "string", pattern: "^[^@\\sA-Z]+@[^@\\sA-Z]+\\.[^@\\sA-Z]+$" },
            passwordHash: { bsonType: "string", pattern: "^\\$2[aby]\\$" },
            createdAt: { bsonType: "date" },
            updatedAt: { bsonType: "date" },
        },
    },
};

// connect-mongo owns the "sessions" collection (created and indexed by express-session's store), so it isn't listed.
export const COLLECTIONS = [
    { model: User, validator: userValidator, kind: "account" },
    { model: Sheet, validator: sheetValidator, kind: "reference" },
    { model: SheetSection, validator: sheetSectionValidator, kind: "reference" },
    { model: SheetChunk, validator: sheetChunkValidator, kind: "reference" },
    { model: Regulation, validator: regulationValidator, kind: "reference" },
    { model: SheetChunkRegulation, validator: sheetChunkRegulationValidator, kind: "reference" },
    { model: ChecklistItem, validator: checklistItemValidator, kind: "reference" },
    { model: JobSite, validator: jobSiteValidator, kind: "work" },
    { model: Inspection, validator: inspectionValidator, kind: "work" },
    { model: InspectionSheet, validator: inspectionSheetValidator, kind: "work" },
    { model: InspectionChecklistItem, validator: inspectionChecklistItemValidator, kind: "work" },
    { model: HazardRecord, validator: hazardRecordValidator, kind: "work" },
    { model: Photo, validator: photoValidator, kind: "work" },
    { model: AiSuggestion, validator: aiSuggestionValidator, kind: "work" },
    { model: Summary, validator: summaryValidator, kind: "work" },
];

export {
    User, Sheet, SheetSection, SheetChunk, Regulation, SheetChunkRegulation, ChecklistItem,
    JobSite, Inspection, InspectionSheet, InspectionChecklistItem, HazardRecord, Photo, AiSuggestion, Summary,
};
