// TEST-API: the app's API helper and its save queue (src/data/api.js). Fetch is mocked; no API or DB needed.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { api, createSaveQueue, isTemporaryFailure } from "../src/data/api.js";

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

const answer = (status) => async () => new Response("not json", { status });
const noSignal = async () => {
    throw new TypeError("Failed to fetch");
};
const failure = (method) => api(method, "/jobs").catch((err) => err);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("API-01 a failed read says it couldn't load, and a failed save says it wasn't saved", async () => {
    globalThis.fetch = answer(502);
    assert.equal((await failure("GET")).message, "Couldn't load this. Try again.");
    assert.equal((await failure("PUT")).message, "Couldn't save. Try again.");

    globalThis.fetch = noSignal;
    assert.match((await failure("GET")).message, /couldn't be loaded/);
    assert.doesNotMatch((await failure("GET")).message, /saved/);
    assert.match((await failure("PATCH")).message, /wasn't saved/);
});

test("API-02 only no connection and server faults are worth retrying", () => {
    for (const status of [0, 500, 502, 503]) assert.equal(isTemporaryFailure({ status }), true, String(status));
    for (const status of [400, 401, 404, 409]) assert.equal(isTemporaryFailure({ status }), false, String(status));
});

test("API-03 a failed save is sent again later", async () => {
    const queue = createSaveQueue(1, 5);
    let runs = 0;
    const save = async () => {
        runs++;
        if (runs === 1) queue.retryLater("k", save);
    };
    queue.schedule("k", save);
    await wait(40);
    assert.equal(runs, 2);
    assert.equal(queue.hasWaiting(), false);
});

test("API-04 a retry doesn't replace newer typing waiting under the same key", async () => {
    const queue = createSaveQueue(5, 1);
    const sent = [];
    queue.schedule("k", async () => sent.push("newest"));
    queue.retryLater("k", async () => sent.push("old"));
    await wait(30);
    assert.deepEqual(sent, ["newest"]);
});

test("API-05 flush sends a waiting retry and doesn't loop when it fails again", async () => {
    const queue = createSaveQueue(1000, 1000);
    let runs = 0;
    const save = async () => {
        runs++;
        queue.retryLater("k", save);
    };
    queue.retryLater("k", save);
    await queue.flush();
    assert.equal(runs, 1);
    assert.equal(queue.hasWaiting(), true);
    queue.clear();
});

test("API-06 clear forgets everything waiting, so nothing runs after sign out", async () => {
    const queue = createSaveQueue(1, 1);
    let runs = 0;
    queue.schedule("a", async () => runs++);
    queue.retryLater("b", async () => runs++);
    queue.clear();
    await wait(20);
    assert.equal(runs, 0);
    assert.equal(queue.hasWaiting(), false);
});
