import { createContext, useContext, useMemo, useRef, useState } from "react";
import { api, isTemporaryFailure, photoUrl } from "../data/api";
import { shrinkImage } from "../data/store";
import { useJobs } from "./JobContext";

const HazardContext = createContext(null);

// Accepts a File, a Blob, or a blob: / data: URL string.
async function toBlob(input) {
    if (input instanceof Blob) return input;
    return (await fetch(input)).blob();
}

// The current job's hazards, saved in MongoDB through the API (server/routes/jobs.js). They live inside the
// job document, so they come from JobContext's currentJob, and every change answers with the updated job.
// Photos are uploaded (shrunk first) and shown from /api/photos/<id>.
//
// Comment edits show at once and save when typing pauses. Until the server confirms them they are kept
// as drafts on top of the job, so another change's answer can't put old text back in the box. A save that
// fails keeps its draft, so what was typed stays on screen, and it is tried again.
export function HazardProvider({ children }) {
    const { currentJob, saveQueue, change, replaceCurrentJob, confirmSavedJob, reloadCurrentJob, reportError } = useJobs();
    const jobId = currentJob?.id ?? null;
    const [drafts, setDrafts] = useState({}); // hazard id -> { comment?, notApplicable? } not yet confirmed
    const unsent = useRef({}); // hazard id -> newest fields the server hasn't confirmed, for the save queue to send

    // What the pages see: hazards with drafts applied and a photos list of URLs
    const hazards = useMemo(
        () =>
            (currentJob?.hazards ?? []).map((h) => ({
                ...h,
                ...drafts[h.id],
                photos: h.photoIds.map(photoUrl),
            })),
        [currentJob, drafts],
    );

    // Drops the draft fields the server now has (unless they were typed over again since)
    const settle = (id, sent) =>
        setDrafts((all) => {
            const draft = { ...all[id] };
            for (const [field, value] of Object.entries(sent)) if (draft[field] === value) delete draft[field];
            const next = { ...all };
            if (Object.keys(draft).length) next[id] = draft;
            else delete next[id];
            return next;
        });

    const forget = (id) => {
        delete unsent.current[id];
        setDrafts((all) => {
            const next = { ...all };
            delete next[id];
            return next;
        });
    };

    const addPhotos = (id, inputs) =>
        change(async () => {
            const body = new FormData();
            for (const input of inputs) {
                try {
                    const original = await toBlob(input);
                    const small = (await shrinkImage(original).catch(() => original)) || original;
                    body.append("photos", small, "photo.jpg");
                } catch {
                    // skip a photo that cannot be read
                }
            }
            if (!body.has("photos")) return null;
            const { job } = await api("POST", `/jobs/${jobId}/hazards/${id}/photos`, body);
            replaceCurrentJob(job);
            return id;
        });

    // Resolves to the new hazard's id, or null if it couldn't be saved
    const addHazard = async ({ name, photo, comment = "" }) => {
        const id = await change(async () => {
            const { job, hazardId } = await api("POST", `/jobs/${jobId}/hazards`, { name, comment });
            replaceCurrentJob(job);
            return hazardId;
        });
        if (id && photo) await addPhotos(id, [photo]);
        return id;
    };

    // changes: { comment?, notApplicable?, photos? }. A photos list means "keep only these", so photos missing
    // from it are deleted.
    const updateHazard = (id, changes) => {
        const { photos, ...fields } = changes;
        const hazard = hazards.find((h) => h.id === id);

        if (Object.keys(fields).length) {
            setDrafts((all) => ({ ...all, [id]: { ...all[id], ...fields } }));
            unsent.current[id] = { ...unsent.current[id], ...fields };
            const key = `hazard:${jobId}:${id}`;
            const url = `/jobs/${jobId}/hazards/${id}`;
            const save = () => {
                const sent = { ...unsent.current[id] };
                if (!Object.keys(sent).length) return Promise.resolve(); // a newer save already delivered these
                return api("PATCH", url, sent, { keepalive: true })
                    .then(({ job }) => {
                        for (const [field, value] of Object.entries(sent)) {
                            if (unsent.current[id]?.[field] === value) delete unsent.current[id][field];
                        }
                        // The server's job has this save; drafts typed since stay on top of it
                        confirmSavedJob(job);
                        settle(id, sent);
                    })
                    .catch((err) => {
                        reportError(err);
                        if (err.status === 404) {
                            forget(id); // the hazard is gone, so show what the server has
                            reloadCurrentJob();
                        } else if (isTemporaryFailure(err)) {
                            saveQueue.retryLater(key, save);
                        }
                    });
            };
            saveQueue.schedule(key, save);
            // Typing waits for a pause; a button press (not applicable) saves now
            if (!("comment" in fields)) saveQueue.send(key);
        }

        if (photos && hazard) {
            const removed = hazard.photoIds.filter((pid) => !photos.includes(photoUrl(pid)));
            if (removed.length) {
                change(async () => {
                    for (const pid of removed) {
                        const { job } = await api("DELETE", `/jobs/${jobId}/hazards/${id}/photos/${pid}`);
                        replaceCurrentJob(job);
                    }
                    return id;
                });
            }
        }
    };

    const deleteHazard = (id) =>
        change(async () => {
            const { job } = await api("DELETE", `/jobs/${jobId}/hazards/${id}`);
            forget(id);
            replaceCurrentJob(job);
            return id;
        });

    return (
        <HazardContext.Provider value={{ hazards, addHazard, updateHazard, addPhotos, deleteHazard }}>
            {children}
        </HazardContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHazards() {
    const ctx = useContext(HazardContext);
    if (!ctx) throw new Error("useHazards must be used inside <HazardProvider>");
    return ctx;
}
