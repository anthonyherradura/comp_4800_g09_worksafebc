// TEST-1: server/services/gemini.js with the @google/genai client mocked out.
// Covers the answer clean-up, the fallback model, the 2.5 s hedge and the 8 s timeout.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_MODEL = "primary-model";
process.env.GEMINI_FALLBACK_MODEL = "backup-model";

// Each test sets how each model behaves: model name -> (abortSignal) => Promise<{ text }>
let models = {};
const calls = [];
mock.module("@google/genai", {
    namedExports: {
        GoogleGenAI: class {
            models = {
                generateContent: ({ model, contents, config }) => {
                    calls.push({ model, contents, signal: config.abortSignal });
                    return models[model](config.abortSignal);
                },
            };
        },
    },
});

const { suggestHazard } = await import("../server/services/gemini.js");

const answers = (text) => () => Promise.resolve({ text });
const fails = (message) => () => Promise.reject(new Error(message));
const hangs = () => (signal) =>
    new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));

function setup(t, behaviour) {
    models = behaviour;
    calls.length = 0;
    t.mock.timers.enable({ apis: ["setTimeout"] });
    t.mock.method(console, "warn", () => {});
}

test("GEM-01 returns the primary model's answer and never starts the fallback", async (t) => {
    setup(t, { "primary-model": answers("Unsecured Ladder"), "backup-model": answers("unused") });
    assert.equal(await suggestHazard({ text: "ladder" }), "Unsecured Ladder");
    t.mock.timers.tick(10_000); // the hedge timer must have been cleared
    assert.deepEqual(calls.map((c) => c.model), ["primary-model"]);
});

test("GEM-02 sends the photo as inline base64 with its type, plus the officer's description", async (t) => {
    setup(t, { "primary-model": answers("Missing Guardrail") });
    const photo = { mimetype: "image/png", buffer: Buffer.from("png-bytes") };
    await suggestHazard({ text: "scaffold deck", photo });
    assert.deepEqual(calls[0].contents, [
        { inlineData: { mimeType: "image/png", data: Buffer.from("png-bytes").toString("base64") } },
        { text: "Site officer's description: scaffold deck" },
    ]);
});

test("GEM-03 photo with no description asks for the main hazard in the photo", async (t) => {
    setup(t, { "primary-model": answers("Missing Guardrail") });
    await suggestHazard({ text: "", photo: { mimetype: "image/jpeg", buffer: Buffer.from("x") } });
    assert.deepEqual(calls[0].contents[1], { text: "Identify the main hazard in this photo." });
});

test("GEM-04 strips quotes, whitespace and a trailing full stop from the answer", async (t) => {
    setup(t, { "primary-model": answers('  "Fall From Height."\n') });
    assert.equal(await suggestHazard({ text: "roof edge" }), "Fall From Height");
});

test("GEM-05 caps a runaway answer at 120 characters", async (t) => {
    setup(t, { "primary-model": answers("Hazard ".repeat(50)) });
    assert.ok((await suggestHazard({ text: "x" })).length <= 120);
});

test("GEM-06 primary fails: the fallback starts at once, without waiting 2.5 s", async (t) => {
    setup(t, { "primary-model": fails("404 model not found"), "backup-model": answers("Unguarded Table Saw") });
    assert.equal(await suggestHazard({ text: "table saw" }), "Unguarded Table Saw");
    assert.deepEqual(calls.map((c) => c.model), ["primary-model", "backup-model"]);
});

test("GEM-07 empty answer counts as a failure and the fallback answers", async (t) => {
    setup(t, { "primary-model": answers("   "), "backup-model": answers("Confined Space Entry") });
    assert.equal(await suggestHazard({ text: "tank entry" }), "Confined Space Entry");
});

test("GEM-08 primary slow: fallback starts at 2.5 s, first answer wins, the slow one is cancelled", async (t) => {
    setup(t, { "primary-model": hangs(), "backup-model": answers("Unsecured Ladder") });
    const result = suggestHazard({ text: "ladder" });

    t.mock.timers.tick(2499);
    assert.equal(calls.length, 1);
    t.mock.timers.tick(1);
    assert.equal(calls.length, 2);

    assert.equal(await result, "Unsecured Ladder");
    assert.equal(calls[0].signal.aborted, true);
});

test("GEM-09 both models fail: rejects with the last error", async (t) => {
    setup(t, { "primary-model": fails("quota exceeded"), "backup-model": fails("503 overloaded") });
    await assert.rejects(suggestHazard({ text: "x" }), { message: "503 overloaded" });
});

test("GEM-10 neither model answers: rejects after 8 s and cancels both requests", async (t) => {
    setup(t, { "primary-model": hangs(), "backup-model": hangs() });
    const result = suggestHazard({ text: "x" });
    t.mock.timers.tick(2500);
    t.mock.timers.tick(5500);
    await assert.rejects(result, { message: "No answer from Gemini within 8 s" });
    assert.ok(calls.every((c) => c.signal.aborted));
});

test("GEM-11 missing API key: fails before calling any model", async (t) => {
    setup(t, { "primary-model": answers("unused") });
    const key = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
        await assert.rejects(suggestHazard({ text: "x" }), { message: "GEMINI_API_KEY is not set" });
        assert.equal(calls.length, 0);
    } finally {
        process.env.GEMINI_API_KEY = key;
    }
});

test("GEM-12 a model that explains itself over several lines: only the hazard name is kept (B-09)", async (t) => {
    setup(t, {
        "primary-model": answers("Unsecured Ladder\n\nThe ladder is not tied off and is set at a steep angle."),
    });
    assert.equal(await suggestHazard({ text: "ladder" }), "Unsecured Ladder");

    models = { "primary-model": answers('\n  "Missing Guardrail."\r\nBecause the deck is open.') };
    assert.equal(await suggestHazard({ text: "scaffold" }), "Missing Guardrail");
});

test("GEM-13 Gemini can't read the photo: BAD_PHOTO error and the fallback is not tried (B-03)", async (t) => {
    const unreadable = () =>
        Promise.reject(
            Object.assign(new Error('{"error":{"code":400,"message":"Unable to process input image.","status":"INVALID_ARGUMENT"}}'), {
                status: 400,
            })
        );
    setup(t, { "primary-model": unreadable, "backup-model": answers("unused") });
    const photo = { mimetype: "image/jpeg", buffer: Buffer.from("not really a jpeg") };
    await assert.rejects(suggestHazard({ text: "", photo }), { code: "BAD_PHOTO" });
    assert.deepEqual(calls.map((c) => c.model), ["primary-model"]);
});
