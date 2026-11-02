// photos: evidence attached to a hazard. Holds a storage key (GridFS id or object key), never the image bytes.
import mongoose from "mongoose";
import { schemaOptions, jsonSchema, objectId, date, nullableDate, int, nullable, text, oneOf, MAX_PHOTO_BYTES } from "./schemaHelpers.js";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const photoSchema = new mongoose.Schema(
    {
        hazardRecordId: { type: mongoose.Schema.Types.ObjectId, ref: "HazardRecord", required: true },
        storageKey: { type: String, required: true, unique: true },
        // raw 32-byte SHA-256 digest of the image
        sha256: { type: Buffer, required: true, validate: (b) => b?.length === 32 },
        mimeType: { type: String, required: true, enum: PHOTO_TYPES },
        byteSize: { type: Number, required: true, min: 1, max: MAX_PHOTO_BYTES, validate: Number.isInteger },
        widthPx: { type: Number, default: null, min: 1 },
        heightPx: { type: Number, default: null, min: 1 },
        takenAt: { type: Date, default: null },
        uploadedAt: { type: Date, required: true, default: Date.now },
    },
    schemaOptions("photos"),
);
// Also serves lookups by hazardRecordId alone, so no separate index is needed for that
photoSchema.index({ hazardRecordId: 1, sha256: 1 }, { unique: true });

export const validator = {
    $jsonSchema: jsonSchema({
        hazardRecordId: objectId,
        storageKey: text(),
        sha256: { bsonType: "binData" },
        mimeType: oneOf(...PHOTO_TYPES),
        byteSize: int(1, MAX_PHOTO_BYTES),
        widthPx: nullable(int(1)),
        heightPx: nullable(int(1)),
        takenAt: nullableDate,
        uploadedAt: date,
    }),
    $expr: { $eq: [{ $binarySize: "$sha256" }, 32] },
};

export default mongoose.model("Photo", photoSchema);
