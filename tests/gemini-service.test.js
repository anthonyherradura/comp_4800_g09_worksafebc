// TEST-1: server/services/gemini.js with the @google/genai client mocked out.
// Covers the answer clean-up, the fallback model, the 2.5 s hedge and the 8 s timeout.
import { test, mock } from "node:test";
import assert from "node:assert/strict";

process.env.GEMINI_API_KEY = "test-key";
process.env.GEMINI_MODEL = "primary-model";
process.env.GEMINI_FALLBACK_MODEL = "backup-model";
process.env.GEMINI_SECOND_FALLBACK_MODEL = "third-model";

// Each test sets how each model behaves: model name -> (abortSignal) => Promise<{ text }>
let models = {};
const calls = [];
mock.module("@google/genai", {
    namedExports: {
        GoogleGenAI: class {
            models = {
                generateContent: ({ model, contents, config }) => {
                    calls.push({ model, contents, config, signal: config.abortSignal });
                    return models[model](config.abortSignal);
                },
            };
        },
    },
});

const { suggestHazard, suggestHazardMatch, matchSheets } = await import("../server/services/gemini.js");

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

test("GEM-09 every model fails: rejects with the last error", async (t) => {
    setup(t, {
        "primary-model": fails("quota exceeded"),
        "backup-model": fails("503 overloaded"),
        "third-model": fails("503 high demand"),
    });
    await assert.rejects(suggestHazard({ text: "x" }), { message: "503 high demand" });
    assert.deepEqual(calls.map((c) => c.model), ["primary-model", "backup-model", "third-model"]);
});

test("GEM-10 no model answers: rejects after 8 s and cancels every request", async (t) => {
    setup(t, { "primary-model": hangs(), "backup-model": hangs(), "third-model": hangs() });
    const result = suggestHazard({ text: "x" });
    t.mock.timers.tick(2500);
    t.mock.timers.tick(2500);
    t.mock.timers.tick(3000);
    await assert.rejects(result, { message: "No answer from Gemini within 8 s" });
    assert.equal(calls.length, 3);
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

test("GEM-14 primary and backup fail: the second fallback answers at once", async (t) => {
    setup(t, {
        "primary-model": fails("429 quota"),
        "backup-model": fails("503 overloaded"),
        "third-model": answers("Unsecured Ladder"),
    });
    assert.equal(await suggestHazard({ text: "ladder" }), "Unsecured Ladder");
    assert.deepEqual(calls.map((c) => c.model), ["primary-model", "backup-model", "third-model"]);
});

test("GEM-15 primary and backup both slow: the second fallback starts at 5 s and its answer is used", async (t) => {
    setup(t, { "primary-model": hangs(), "backup-model": hangs(), "third-model": answers("Unguarded Table Saw") });
    const result = suggestHazard({ text: "table saw" });

    t.mock.timers.tick(2500);
    assert.equal(calls.length, 2);
    t.mock.timers.tick(2499);
    assert.equal(calls.length, 2);
    t.mock.timers.tick(1);
    assert.equal(calls.length, 3);

    assert.equal(await result, "Unguarded Table Saw");
    assert.ok(calls[0].signal.aborted && calls[1].signal.aborted);
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

// ---------- matchSheets ----------
const SHEETS = [
    { sheetId: "cu-732044", name: "Log Transport", cu: "CU 732044", summary: "Hauling logs by logging truck." },
    { sheetId: "cu-766011", name: "Long-term Care", cu: "CU 766011", summary: "Residential care facilities." },
];
const json = (value) => answers(JSON.stringify(value));

test("GEM-16 matchSheets sends the catalogue, the photo and the description, and asks for JSON", async (t) => {
    setup(t, { "primary-model": json({ matches: [] }) });
    const photo = { mimetype: "image/jpeg", buffer: Buffer.from("jpg") };
    await matchSheets({ text: "truck at the log dump", photo, sheets: SHEETS });

    const [catalogue, image, description] = calls[0].contents;
    assert.match(catalogue.text, /cu-732044 \| Log Transport \(CU 732044\) \| Hauling logs by logging truck\./);
    assert.match(catalogue.text, /cu-766011 \| Long-term Care/);
    assert.equal(image.inlineData.mimeType, "image/jpeg");
    assert.deepEqual(description, { text: "Site officer's description of the work: truck at the log dump" });
    assert.equal(calls[0].config.responseMimeType, "application/json");
});

test("GEM-17 matchSheets keeps Gemini's order, drops made-up and repeated sheets", async (t) => {
    setup(t, {
        "primary-model": json({
            matches: [
                { sheetId: "cu-766011", reason: " Care home " },
                { sheetId: "cu-999999", reason: "not a real sheet" },
                { sheetId: "cu-766011", reason: "again" },
                { sheetId: "cu-732044", reason: "Trucks" },
            ],
        }),
    });
    assert.deepEqual(await matchSheets({ text: "x", sheets: SHEETS }), [
        { sheetId: "cu-766011", reason: "Care home" },
        { sheetId: "cu-732044", reason: "Trucks" },
    ]);
});

test("GEM-18 matchSheets: an answer that isn't JSON counts as a failure and the fallback answers", async (t) => {
    setup(t, {
        "primary-model": answers("Log Transport"),
        "backup-model": json({ matches: [{ sheetId: "cu-732044", reason: "Logging truck" }] }),
    });
    assert.deepEqual(await matchSheets({ text: "logging truck", sheets: SHEETS }), [
        { sheetId: "cu-732044", reason: "Logging truck" },
    ]);
    assert.deepEqual(calls.map((c) => c.model), ["primary-model", "backup-model"]);
});

const JOB_HAZARDS = [{ id: "h1", name: "Falls from height" }, { id: "h2", name: "Chain binders" }];

test("GEM-19 suggestHazardMatch sends the job's hazards and returns the matching id", async (t) => {
    setup(t, { "primary-model": json({ name: "Unsecured Ladder", matchId: "h1" }) });
    assert.deepEqual(await suggestHazardMatch({ text: "ladder", hazards: JOB_HAZARDS }), {
        suggestion: "Unsecured Ladder",
        matchId: "h1",
    });
    assert.match(calls[0].contents[0].text, /h2 \| Chain binders/);
    assert.equal(calls[0].config.responseMimeType, "application/json");
});

test("GEM-20 suggestHazardMatch: no match or a made-up id means a new hazard", async (t) => {
    for (const matchId of ["", "h99"]) {
        setup(t, { "primary-model": json({ name: "Blocked Exit", matchId }) });
        const answer = await suggestHazardMatch({ text: "exit", hazards: JOB_HAZARDS });
        assert.deepEqual(answer, { suggestion: "Blocked Exit", matchId: null });
        t.mock.timers.reset();
    }
});

test("GEM-21 suggestHazardMatch: an answer that isn't JSON counts as a failure and the fallback answers", async (t) => {
    setup(t, {
        "primary-model": answers("Blocked Exit"),
        "backup-model": json({ name: "Blocked Exit", matchId: "h2" }),
    });
    assert.equal((await suggestHazardMatch({ text: "x", hazards: JOB_HAZARDS })).matchId, "h2");
});

test("GEM-22 every prompt tells Gemini to answer in English (B-23)", async (t) => {
    setup(t, { "primary-model": json({ name: "Blocked Exit", matchId: "", matches: [] }) });
    await suggestHazard({ text: "x" }).catch(() => {});
    await suggestHazardMatch({ text: "x", hazards: JOB_HAZARDS });
    await matchSheets({ text: "x", sheets: SHEETS });
    assert.equal(calls.length, 3);
    for (const call of calls) assert.match(call.config.systemInstruction, /Always write in English/);
});
