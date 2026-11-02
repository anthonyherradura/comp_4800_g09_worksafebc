import { createStore, del, get, set } from "idb-keyval";

const store = createStore("hiips360", "kv");

export const load = (key, fallback) =>
    get(key, store).then((v) => v ?? fallback).catch(() => fallback);

export const save = (key, value) => set(key, value, store).catch(() => {});

// Photos are kept one per record so saving a comment never rewrites the images.
export const savePhoto = (id, blob) => save(`photo:${id}`, blob);
export const loadPhoto = (id) => load(`photo:${id}`, null);
export const removePhoto = (id) => del(`photo:${id}`, store).catch(() => {});

// crypto.randomUUID() only exists over HTTPS or localhost, so it breaks when you
// test on the phone over http://10.0.0.143. This works everywhere.
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Phone photos are 3 to 5 MB. Shrinking them keeps the storage small.
export async function shrinkImage(file, maxSide = 1600, quality = 0.8) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// Asks the browser not to clear this data when space runs low.
export const requestPersistence = () => navigator.storage?.persist?.();