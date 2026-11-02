// What happens to a job's hazard list when its protocol sheet is picked, changed or cleared.
// Plain function over the saved hazards, so it can be tested without React.
//
// - The new sheet's hazards are added, unless the job already has them.
// - The old sheet's hazards are removed only if the officer hasn't worked on them yet
//   (no photo, no comment, not marked not applicable). Anything with work on it stays.
// - Hazards the officer added themselves are never touched.

const untouched = (h) => !(h.photoIds?.length > 0) && !h.comment?.trim() && !h.notApplicable;

// hazards: saved hazard records. sheetHazards: getSheetHazards(sheetId) (empty when clearing the sheet).
export function syncSheetHazards(hazards, { jobId, sheetId, sheetHazards, makeId, now = new Date() }) {
    const kept = hazards.filter(
        (h) => !(h.worksiteId === jobId && h.source === "sheet" && h.sheetId !== sheetId && untouched(h))
    );

    const have = new Set(
        kept.filter((h) => h.worksiteId === jobId && h.sheetId === sheetId).map((h) => h.sheetKey)
    );
    const added = sheetHazards
        .filter((s) => !have.has(s.key))
        .map((s) => ({
            id: makeId(),
            worksiteId: jobId,
            name: s.name,
            comment: "",
            photoIds: [],
            notApplicable: false,
            createdAt: now.toISOString(),
            source: "sheet", // the full guidance is read from the sheet by sheetId + sheetKey
            sheetId,
            sheetKey: s.key,
            stage: s.stage,
        }));

    return [...kept, ...added];
}
