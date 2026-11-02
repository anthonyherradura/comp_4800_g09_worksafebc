import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import usePersistentState from "../hooks/usePersistentState";
import { loadPhoto, newId, removePhoto, savePhoto, shrinkImage } from "../data/store";
import { getSheetHazards } from "../data/sheets";
import { syncSheetHazards } from "../data/syncSheetHazards";
import { useJobs } from "./JobContext";

const HazardContext = createContext(null);

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Accepts a File, a Blob, or a blob: / data: URL string.
async function toBlob(input) {
    if (input instanceof Blob) return input;
    return (await fetch(input)).blob();
}

// Hazards are saved on the device (IndexedDB), and each photo is saved as its own record.
// When the backend is ready, only this file needs to change.
// Each hazard belongs to a job (worksiteId = job id); the pages only see the current job's hazards.
export function HazardProvider({ children }) {
    const { currentJob } = useJobs();
    const jobId = currentJob?.id ?? null;
    const [stored, setHazards, loaded] = usePersistentState("hiips360.hazards", []);
    const [urls, setUrls] = useState({}); // photo id -> URL the browser can show
    const urlsRef = useRef(urls);
    urlsRef.current = urls;
    const pending = useRef(new Set());

    // After a reload, read each saved photo back from storage and make a URL for it.
    useEffect(() => {
        if (!loaded) return;
        stored.forEach((h) =>
            (h.photoIds ?? []).forEach((pid) => {
                if (urlsRef.current[pid] || pending.current.has(pid)) return;
                pending.current.add(pid);
                loadPhoto(pid).then((blob) => {
                    pending.current.delete(pid);
                    if (blob) setUrls((u) => ({ ...u, [pid]: URL.createObjectURL(blob) }));
                });
            })
        );
    }, [stored, loaded]);

    // What the rest of the app sees: the current job's hazards with a photos list of URLs.
    // Hazards saved before jobs existed have no worksiteId; they still show so nothing is lost.
    const hazards = useMemo(
        () =>
            stored
                .filter((h) => h.worksiteId == null || h.worksiteId === jobId)
                .map((h) => ({ ...h, photos: (h.photoIds ?? []).map((id) => urls[id]).filter(Boolean) })),
        [stored, urls, jobId]
    );

    const dropPhoto = (pid) => {
        removePhoto(pid);
        if (urls[pid]) URL.revokeObjectURL(urls[pid]);
        setUrls((u) => {
            const next = { ...u };
            delete next[pid];
            return next;
        });
    };

    const addPhotos = async (id, inputs) => {
        const newIds = [];
        for (const input of inputs) {
            try {
                const original = await toBlob(input);
                const small = (await shrinkImage(original).catch(() => original)) || original;
                const photoId = newId();
                await savePhoto(photoId, small);
                setUrls((u) => ({ ...u, [photoId]: URL.createObjectURL(small) }));
                newIds.push(photoId);
            } catch {
                // skip a photo that cannot be read
            }
        }
        if (newIds.length) {
            setHazards((prev) =>
                prev.map((h) => (h.id === id ? { ...h, photoIds: [...(h.photoIds ?? []), ...newIds] } : h))
            );
        }
    };

    const addHazard = ({ name, photo }) => {
        const id = makeId();
        setHazards((prev) => [
            ...prev,
            {
                id,
                worksiteId: jobId,
                name,
                comment: "",
                photoIds: [],
                notApplicable: false,
                createdAt: new Date().toISOString(),
            },
        ]);
        if (photo) addPhotos(id, [photo]);
        return id;
    };

    const updateHazard = (id, changes) => {
        const { photos, ...rest } = changes;
        const current = stored.find((h) => h.id === id);
        let photoIds;
        if (photos && current) {
            // A photos list means "keep only these", so photos missing from it are deleted.
            const ids = current.photoIds ?? [];
            photoIds = ids.filter((pid) => photos.includes(urls[pid]));
            ids.filter((pid) => !photoIds.includes(pid)).forEach(dropPhoto);
        }
        setHazards((prev) =>
            prev.map((h) => (h.id === id ? { ...h, ...rest, ...(photoIds ? { photoIds } : {}) } : h))
        );
    };

    // Called when the officer picks, changes or clears a job's protocol sheet (sheetId null to clear)
    const applySheet = (forJobId, sheetId) =>
        setHazards((prev) =>
            syncSheetHazards(prev, { jobId: forJobId, sheetId, sheetHazards: getSheetHazards(sheetId), makeId })
        );

    const deleteHazard = (id) => {
        stored.find((h) => h.id === id)?.photoIds?.forEach(dropPhoto);
        setHazards((prev) => prev.filter((h) => h.id !== id));
    };

    return (
        <HazardContext.Provider value={{ hazards, addHazard, updateHazard, addPhotos, deleteHazard, applySheet }}>
            {loaded ? children : null}
        </HazardContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHazards() {
    const ctx = useContext(HazardContext);
    if (!ctx) throw new Error("useHazards must be used inside <HazardProvider>");
    return ctx;
}