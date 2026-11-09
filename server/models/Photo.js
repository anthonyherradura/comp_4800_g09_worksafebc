// One photo of one hazard. The job's hazard keeps the id in `photoIds`; the bytes live here so reading the
// hazard list never downloads images. userId and jobId let the API check ownership and delete a job's photos at once.
import mongoose from "mongoose";
import { LIMITS, PHOTO_TYPES } from "../db/limits.js";

const { ObjectId } = mongoose.Schema.Types;

const photoSchema = new mongoose.Schema(
    {
        userId: { type: ObjectId, ref: "User", required: true },
        jobId: { type: ObjectId, ref: "Job", required: true },
        hazardId: { type: ObjectId, required: true },
        contentType: { type: String, required: true, enum: PHOTO_TYPES },
        data: { type: Buffer, required: true },
        size: { type: Number, required: true, min: 1, max: LIMITS.photoBytes },
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

// Deleting a job (jobId) or one hazard (jobId + hazardId) removes their photos with this index
photoSchema.index({ jobId: 1, hazardId: 1 });

export default mongoose.model("Photo", photoSchema);
