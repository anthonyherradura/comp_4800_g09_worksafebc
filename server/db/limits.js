// Every size limit the inspection database enforces, in one place.
// To change one: edit the number here, then run `npm run db:setup` so MongoDB's own validators match,
// and restart the API. Nothing else needs to change (models, routes and validators all read from here).

export const LIMITS = Object.freeze({
    hazardsPerJob: 200, // also the most hazards the AI route accepts (server/routes/ai.js MAX_HAZARDS)
    photosPerHazard: 20,
    photoBytes: 10 * 1024 * 1024, // same as the AI route's photo limit
    labelChars: 200,
    hazardNameChars: 200, // the longest sheet hazard name is 131
    commentChars: 5000,
    visitNotesChars: 5000,
    recentSheets: 3,
});

export const PHOTO_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);

// Planning checklist answers. A missing item means "To review", so "pending" is never stored.
export const CHECKLIST_STATUSES = Object.freeze(["ready", "not-applicable"]);
