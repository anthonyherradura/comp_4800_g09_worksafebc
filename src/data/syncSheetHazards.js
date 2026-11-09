// What happens to a job's hazard list when its protocol sheet is picked, changed or cleared.
// Plain function over one job's hazards, so the server (server/routes/jobs.js) and the tests use the same rule.
//
// - The new sheet's hazards are added, unless the job already has them.
// - The old sheet's hazards are removed only if the officer hasn't worked on them yet
//   (no photo, no comment, not marked not applicable). Anything with work on it stays.
// - Hazards the officer added themselves are never touched.
//
// New hazards come back without an id; the caller gives them one.

const untouched = (h) => !(h.photoIds?.length > 0) && !h.comment?.trim() && !h.notApplicable;

// hazards: the job's hazards. sheetHazards: the sheet's hazards [{ key, name }] (empty when clearing the sheet).
export function syncSheetHazards(hazards, { sheetId, sheetHazards, now = new Date() }) {
    const kept = hazards.filter((h) => !(h.source === "sheet" && h.sheetId !== sheetId && untouched(h)));

    const have = new Set(kept.filter((h) => h.source === "sheet" && h.sheetId === sheetId).map((h) => h.sheetKey));
    const added = sheetHazards
        .filter((s) => !have.has(s.key))
        .map((s) => ({
            source: "sheet", // the guidance (stage, controls, legislation) is read from the sheet by sheetId + sheetKey
            sheetId,
            sheetKey: s.key,
            name: s.name,
            comment: "",
            photoIds: [],
            notApplicable: false,
            createdAt: now,
        }));

    return [...kept, ...added];
}
