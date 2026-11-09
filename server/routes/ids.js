// Route ids are MongoDB ObjectIds (24 hex characters). Anything else can't be one of the officer's records,
// so it gets the same 404 as a record that belongs to someone else.
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export const notFound = (res, what) => res.status(404).json({ error: `${what} not found.` });

export function checkIds(router, names) {
    const what = { jobId: "Job", hazardId: "Hazard", photoId: "Photo" };
    for (const name of names) {
        router.param(name, (req, res, next, value) => (OBJECT_ID.test(value) ? next() : notFound(res, what[name])));
    }
}
