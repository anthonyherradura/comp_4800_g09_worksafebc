// TEST-1: POST /api/ai/suggest-hazard (server/routes/ai.js) with Gemini mocked out.
// Run with `npm test`. Covers sign-in, input validation, photo rules, Gemini failures and the rate limit.
import { test, mock, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";

// Each test sets what the mocked Gemini service does
let fakeSuggest;
const serviceCalls = [];
mock.module("../server/services/gemini.js", {
    namedExports: {
        suggestHazard: async (input) => {
            serviceCalls.push(input);
            return fakeSuggest(input);
        },
    },
});

const { default: aiRoutes } = await import("../server/routes/ai.js");

const MB = 1024 * 1024;
const servers = [];

// The real app needs MongoDB for sessions, so this stands in a fake session and the same error handler as app.js
async function startApp(routes, { signedIn = true } = {}) {
    const app = express();
    app.use((req, res, next) => {
        req.session = signedIn ? { userId: "officer-1" } : {};
        next();
    });
    app.use("/api/ai", routes);
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => res.status(500).json({ error: "Something went wrong on our side. Try again." }));

    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}/api/ai/suggest-hazard`;
}

function form({ text, photos = [] } = {}) {
    const body = new FormData();
    if (text !== undefined) body.append("text", text);
    for (const { type = "image/jpeg", bytes = 1024, name = "site.jpg", field = "photo" } of photos) {
        body.append(field, new Blob([new Uint8Array(bytes)], { type }), name);
    }
    return body;
}

async function post(url, body) {
    const res = await fetch(url, { method: "POST", body });
    return { status: res.status, body: await res.json() };
}

let url;
let signedOutUrl;
before(async () => {
    url = await startApp(aiRoutes);
    signedOutUrl = await startApp(aiRoutes, { signedIn: false });
});
after(() => servers.forEach((s) => s.close()));

const reset = (impl = async () => "Unsecured Ladder") => {
    fakeSuggest = impl;
    serviceCalls.length = 0;
};

test("AI-01 signed out: 401 and Gemini is never called", async () => {
    reset();
    const res = await post(signedOutUrl, form({ text: "ladder not tied off" }));
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: "Not signed in." });
    assert.equal(serviceCalls.length, 0);
});

test("AI-02 text only: 200 with the suggestion, text is trimmed", async () => {
    reset();
    const res = await post(url, form({ text: "  extension ladder at a steep angle, not tied off  " }));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { suggestion: "Unsecured Ladder" });
    assert.equal(serviceCalls[0].text, "extension ladder at a steep angle, not tied off");
    assert.equal(serviceCalls[0].photo, undefined);
});

for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    test(`AI-03 photo only (${type}): 200 and the photo reaches Gemini`, async () => {
        reset();
        const res = await post(url, form({ photos: [{ type, bytes: 2048 }] }));
        assert.equal(res.status, 200);
        assert.equal(serviceCalls[0].photo.mimetype, type);
        assert.equal(serviceCalls[0].photo.buffer.length, 2048);
        assert.equal(serviceCalls[0].text, "");
    });
}

test("AI-04 text and photo together: 200", async () => {
    reset();
    const res = await post(url, form({ text: "table saw, no guard", photos: [{}] }));
    assert.equal(res.status, 200);
    assert.equal(serviceCalls[0].text, "table saw, no guard");
    assert.ok(serviceCalls[0].photo);
});

test("AI-05 empty request: 400 asks for a photo or description", async () => {
    reset();
    for (const body of [form(), form({ text: "" }), form({ text: "    " })]) {
        const res = await post(url, body);
        assert.equal(res.status, 400);
        assert.deepEqual(res.body, { error: "Add a photo or describe the hazard first." });
    }
    assert.equal(serviceCalls.length, 0);
});

test("AI-06 description length: 500 characters accepted, 501 rejected", async () => {
    reset();
    assert.equal((await post(url, form({ text: "a".repeat(500) }))).status, 200);

    const res = await post(url, form({ text: "a".repeat(501) }));
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: "Keep the description under 500 characters." });
});

for (const [type, name] of [
    ["image/heic", "IMG_0001.HEIC"],
    ["image/gif", "site.gif"],
    ["application/pdf", "sheet.pdf"],
]) {
    test(`AI-07 unsupported photo type (${type}): 400`, async () => {
        reset();
        const res = await post(url, form({ photos: [{ type, name }] }));
        assert.equal(res.status, 400);
        assert.deepEqual(res.body, { error: "Photos must be JPEG, PNG or WebP." });
        assert.equal(serviceCalls.length, 0);
    });
}

test("AI-08 photo size: exactly 10 MB accepted, 10 MB + 1 byte rejected", async () => {
    reset();
    assert.equal((await post(url, form({ photos: [{ bytes: 10 * MB }] }))).status, 200);

    const res = await post(url, form({ photos: [{ bytes: 10 * MB + 1 }] }));
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: "The photo must be under 10 MB." });
});

test(
    "AI-09 two photos in one request: 400 asks for one at a time",
    { todo: "Bug: multer's LIMIT_FILE_COUNT isn't handled, so the officer gets a 500" },
    async () => {
        reset();
        const res = await post(url, form({ photos: [{}, {}] }));
        assert.equal(res.status, 400);
        assert.deepEqual(res.body, { error: "Send one photo at a time." });
    }
);

test("AI-10 Gemini fails: 502 with a safe message, raw detail only outside production", async (t) => {
    reset(async () => {
        throw new Error("503 model overloaded");
    });
    t.mock.method(console, "error", () => {});

    const dev = await post(url, form({ text: "scaffold missing guardrail" }));
    assert.equal(dev.status, 502);
    assert.match(dev.body.error, /^The AI suggestion service isn't available right now\. Try again in a moment\./);
    assert.match(dev.body.error, /503 model overloaded/);

    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
        const prod = await post(url, form({ text: "scaffold missing guardrail" }));
        assert.equal(prod.status, 502);
        assert.deepEqual(prod.body, {
            error: "The AI suggestion service isn't available right now. Try again in a moment.",
        });
    } finally {
        process.env.NODE_ENV = previous;
    }
});

test("AI-11 rate limit: the 31st request in 15 minutes gets 429", async () => {
    reset();
    // A fresh copy of the router, so this test has its own limiter and doesn't eat into the others'
    const { default: freshRoutes } = await import("../server/routes/ai.js?rate-limit-test");
    const limitedUrl = await startApp(freshRoutes);

    for (let i = 1; i <= 30; i++) {
        assert.equal((await post(limitedUrl, form({ text: `request ${i}` }))).status, 200, `request ${i}`);
    }
    const res = await post(limitedUrl, form({ text: "request 31" }));
    assert.equal(res.status, 429);
    assert.deepEqual(res.body, { error: "Too many suggestions. Wait a few minutes and try again." });
    assert.equal(serviceCalls.length, 30);
});
