import { clear, createStore } from "idb-keyval";

// Job sites, hazards, photos and recent sheets are saved in MongoDB through the API now (src/data/api.js).
// This file keeps the photo shrinking and ids, and removes what older versions left on the device.

// crypto.randomUUID() only exists over HTTPS or localhost, so it breaks when you
// test on the phone over http://10.0.0.143. This works everywhere.
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Phone photos are 3 to 5 MB. Shrinking them keeps uploads and storage small.
export async function shrinkImage(file, maxSide = 1600, quality = 0.8) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// Fresh start (Nov 2026): the team chose not to move device-only test data to the database.
// Runs once per device and deletes the old copies: jobs in localStorage (hiips360.jobs.<email>), and the
// hazards, photos and recent sheets in IndexedDB (db "hiips360", store "kv"). The signed-in session is kept.
const CLEARED_KEY = "hiips360.deviceDataCleared";

export async function clearOldDeviceData() {
    try {
        if (localStorage.getItem(CLEARED_KEY)) return;
        Object.keys(localStorage)
            .filter((key) => key.startsWith("hiips360.jobs.") || key === "hiips360.lastOpened")
            .forEach((key) => localStorage.removeItem(key));
        await clear(createStore("hiips360", "kv"));
        localStorage.setItem(CLEARED_KEY, new Date().toISOString());
    } catch {
        // Storage blocked (private mode): nothing was saved there anyway
    }
}
