// What the Summary screen shows, calculated on request and never stored (the summaries collection only records
// that the officer reviewed it). Equivalent to the hazard_status, summary_line and inspection_summary views in
// docs/database/hiips360_schema.sql.
//
// buildSummary is pure (data in, summary out) so it can be tested without a database;
// getInspectionSummary loads the data with indexed queries and calls it.

import mongoose from "mongoose";
import { Inspection, InspectionSheet, SheetSection, SheetChunk, HazardRecord, Photo, AiSuggestion, Summary } from "../models/index.js";

export const STATUS = { UNADDRESSED: "unaddressed", REVIEWED: "reviewed", NOT_APPLICABLE: "not_applicable" };

// Same rule as src/data/hazardStatus.js: not applicable wins, then a photo counts as reviewed
export function hazardStatus(hazard, photoCount) {
    if (hazard.isNotApplicable) return STATUS.NOT_APPLICABLE;
    return photoCount > 0 ? STATUS.REVIEWED : STATUS.UNADDRESSED;
}

// Where a hazard came from. Derived, so it can't disagree with the data it's based on.
export function hazardOrigin(hazard, acceptedHazardIds) {
    if (hazard.sheetChunkId) return "sheet";
    return acceptedHazardIds.has(String(hazard._id)) ? "ai" : "officer";
}

/**
 * @param inspection        { _id, revision }
 * @param hazardChunks      every sheet entry in a hazard section of the selected sheets: [{ _id, heading, sheetId }], in sheet order
 * @param otherChunks       sheet entries outside hazard sections that the officer recorded anyway: [{ _id, heading, sheetId }]
 * @param hazards           the inspection's hazardRecords, in creation order
 * @param photoCounts       Map hazardRecordId -> number of photos
 * @param acceptedHazardIds Set of hazardRecordIds created from an accepted AI suggestion
 * @param latestReview      the newest summaries document for the inspection, or null
 */
export function buildSummary({ inspection, hazardChunks, otherChunks = [], hazards, photoCounts, acceptedHazardIds = new Set(), latestReview = null }) {
    const byChunk = new Map(hazards.filter((h) => h.sheetChunkId).map((h) => [h.sheetChunkId, h]));
    const covered = new Set(hazardChunks.map((c) => c._id));
    const headings = new Map([...hazardChunks, ...otherChunks].map((c) => [c._id, c]));

    const line = (hazard, chunk) => {
        const photos = hazard ? photoCounts.get(String(hazard._id)) ?? 0 : 0;
        return {
            hazardRecordId: hazard?._id ?? null, // null: on the sheet but never opened
            sheetChunkId: chunk?._id ?? null,
            sheetId: chunk?.sheetId ?? null,
            name: chunk?.heading ?? hazard.customName,
            origin: hazard ? hazardOrigin(hazard, acceptedHazardIds) : "sheet",
            status: hazard ? hazardStatus(hazard, photos) : STATUS.UNADDRESSED,
            photoCount: photos,
            comment: hazard?.comment ?? "",
        };
    };

    const lines = [
        // every hazard on the selected sheets, opened or not, so nothing on the sheet can be walked past unseen
        ...hazardChunks.map((chunk) => line(byChunk.get(chunk._id), chunk)),
        // plus hazards the officer added that aren't in a sheet's hazard section
        ...hazards.filter((h) => !h.sheetChunkId || !covered.has(h.sheetChunkId)).map((h) => line(h, headings.get(h.sheetChunkId))),
    ];

    const count = (status) => lines.filter((l) => l.status === status).length;
    return {
        inspectionId: inspection._id,
        revision: inspection.revision,
        lines,
        unaddressed: count(STATUS.UNADDRESSED),
        reviewed: count(STATUS.REVIEWED),
        notApplicable: count(STATUS.NOT_APPLICABLE),
        photos: lines.reduce((n, l) => n + l.photoCount, 0),
        lastReviewedRevision: latestReview?.revision ?? null,
        lastReviewedAt: latestReview?.reviewedAt ?? null,
        reviewIsCurrent: latestReview?.revision === inspection.revision,
    };
}

export async function getInspectionSummary(inspectionId, { session = null } = {}) {
    const inspection = await Inspection.findById(inspectionId, { revision: 1 }).session(session).lean();
    if (!inspection) return null;
    const id = new mongoose.Types.ObjectId(String(inspectionId));

    const [sheetIds, hazardSectionIds, hazards, latestReview] = await Promise.all([
        InspectionSheet.find({ inspectionId: id }).session(session).distinct("sheetId"),
        SheetSection.find({ isHazardSection: true }).session(session).distinct("_id"),
        HazardRecord.find({ inspectionId: id }).sort({ createdAt: 1 }).session(session).lean(),
        Summary.findOne({ inspectionId: id }).sort({ revision: -1 }).session(session).lean(),
    ]);
    const hazardIds = hazards.map((h) => h._id);
    const recordedChunkIds = hazards.map((h) => h.sheetChunkId).filter(Boolean);

    const [hazardChunks, otherChunks, photoGroups, accepted] = await Promise.all([
        SheetChunk.find({ sheetId: { $in: sheetIds }, sheetSectionId: { $in: hazardSectionIds } }, { heading: 1, sheetId: 1 })
            .sort({ sheetId: 1, seq: 1 }).session(session).lean(),
        SheetChunk.find({ _id: { $in: recordedChunkIds }, sheetSectionId: { $nin: hazardSectionIds } }, { heading: 1, sheetId: 1 }).session(session).lean(),
        Photo.aggregate([{ $match: { hazardRecordId: { $in: hazardIds } } }, { $group: { _id: "$hazardRecordId", n: { $sum: 1 } } }]).session(session),
        AiSuggestion.find({ hazardRecordId: { $in: hazardIds }, outcome: "accepted" }).session(session).distinct("hazardRecordId"),
    ]);

    return buildSummary({
        inspection,
        hazardChunks,
        otherChunks,
        hazards,
        photoCounts: new Map(photoGroups.map((g) => [String(g._id), g.n])),
        acceptedHazardIds: new Set(accepted.map(String)),
        latestReview,
    });
}
