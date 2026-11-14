// TEST-1: src/pages/Hazard/suggestHazard.js, the browser side of the AI call, with fetch mocked.
// Checks that every failure turns into a message that is safe and useful to show the officer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestHazard } from "../src/pages/Hazard/suggestHazard.js";

const respond = (status, body) => async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

test("CLI-01 posts the text and photo as multipart to /api/ai/suggest-hazard", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", respond(200, { suggestion: "Unsecured Ladder" }));
    const photoFile = new File(["jpeg-bytes"], "site.jpg", { type: "image/jpeg" });

    assert.deepEqual(await suggestHazard({ text: "ladder", photoFile }), { suggestion: "Unsecured Ladder", matchId: null, description: "" });

    const [url, options] = fetch.mock.calls[0].arguments;
    assert.equal(url, "/api/ai/suggest-hazard");
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("text"), "ladder");
    assert.equal(options.body.get("photo").name, "site.jpg");
});

test("CLI-02 leaves out empty fields", async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", respond(200, { suggestion: "x" }));
    await suggestHazard({ text: "", photoFile: null });
    const { body } = fetch.mock.calls[0].arguments[1];
    assert.equal(body.has("text"), false);
    assert.equal(body.has("photo"), false);
});

for (const [status, error] of [
    [400, "Photos must be JPEG, PNG or WebP."],
    [401, "Not signed in."],
    [429, "Too many suggestions. Wait a few minutes and try again."],
    [502, "The AI suggestion service isn't available right now. Try again in a moment."],
]) {
    test(`CLI-03 ${status}: shows the server's message`, async (t) => {
        t.mock.method(globalThis, "fetch", respond(status, { error }));
        await assert.rejects(suggestHazard({ text: "x" }), { message: error });
    });
}

test("CLI-04 a response that isn't JSON (API down behind the proxy): generic message", async (t) => {
    t.mock.method(globalThis, "fetch", respond(502, "Bad Gateway"));
    await assert.rejects(suggestHazard({ text: "x" }), { message: "Couldn't get a suggestion. Try again." });
});

for (const browserText of ["Load failed", "Failed to fetch"]) {
    test(`CLI-05 no signal (fetch rejects with "${browserText}"): a plain message instead (B-10)`, async (t) => {
        t.mock.method(globalThis, "fetch", async () => {
            throw new TypeError(browserText);
        });
        await assert.rejects(suggestHazard({ text: "x" }), {
            message: "Couldn't reach the server. Check your connection and try again.",
        });
    });
}
