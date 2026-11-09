// Talks to the HIIPS360 jobs API (server/routes/jobs.js, photos.js, me.js) through /api, which Vite proxies in dev.
// Resolves to the JSON body (or null for 204). Throws an Error whose message is safe to show, with
// `status` set (0 when the server couldn't be reached).

export const photoUrl = (photoId) => `/api/photos/${photoId}`;

// keepalive lets a small save finish even if the officer closes the tab right after typing
export async function api(method, path, body, { keepalive = false } = {}) {
    const isForm = body instanceof FormData;
    let res;
    try {
        res = await fetch(`/api${path}`, {
            method,
            credentials: "same-origin",
            headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
            body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
            keepalive,
        });
    } catch {
        throw Object.assign(new Error("Couldn't reach the server, so this wasn't saved. Check your connection and try again."), { status: 0 });
    }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || "Couldn't save. Try again."), { status: res.status });
    return data;
}

// Saves that wait until typing pauses (comments, visit notes). Each key keeps only its newest save.
// flush() sends everything waiting and resolves once every save has finished, so a later change
// (picking a sheet, adding a photo) never reaches the server before an earlier one.
export function createSaveQueue(delayMs = 800) {
    const waiting = new Map(); // key -> { timer, run }
    const running = new Set();

    function send(key) {
        const entry = waiting.get(key);
        if (!entry) return Promise.resolve();
        clearTimeout(entry.timer);
        waiting.delete(key);
        const done = entry.run().finally(() => running.delete(done));
        running.add(done);
        return done;
    }

    return {
        // run: () => Promise. Replaces anything already waiting under the same key.
        schedule(key, run, delay = delayMs) {
            clearTimeout(waiting.get(key)?.timer);
            waiting.set(key, { run, timer: setTimeout(() => send(key), delay) });
        },
        send,
        async flush() {
            await Promise.allSettled([...waiting.keys()].map(send));
            await Promise.allSettled([...running]);
        },
    };
}
