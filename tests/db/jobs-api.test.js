// TEST-DB: the jobs, hazards, photos and recent-sheets API against a real MongoDB (server/routes/jobs.js, photos.js, me.js).
// Run with `npm run test:db`. Needs MONGODB_TEST_URI (a plain local server is enough, no replica set);
// skips without it. Creates its own hiips360_test_<random> database and drops it afterwards.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const BASE_URI = process.env.MONGODB_TEST_URI;
const skip = BASE_URI ? false : "set MONGODB_TEST_URI to run (see .env.example)";

const LOG = "cu-732044"; // Log Transport: 40 hazards, 13 checklist items
const LTC = "cu-766011"; // Long-term Care: 14 hazards

let mongoose, Job, Photo, LIMITS, base, server;

function testUri() {
    const url = new URL(BASE_URI);
    url.pathname = `/hiips360_test_${randomBytes(4).toString("hex")}`;
    return url.toString();
}

before(async () => {
    if (skip) return;
    process.env.MONGODB_URI = testUri();
    process.env.SESSION_SECRET ||= "test-secret";
    mongoose = (await import("mongoose")).default;
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    const { applySchema } = await import("../../server/db/setup.js");
    await applySchema();
    ({ default: Job } = await import("../../server/models/Job.js"));
    ({ default: Photo } = await import("../../server/models/Photo.js"));
    ({ LIMITS } = await import("../../server/db/limits.js"));
    const { createApp } = await import("../../server/app.js");
    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
    if (skip) return;
    server?.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

// A signed-in officer: a fetch that keeps its session cookie
async function officer(name = "Officer") {
    let cookie = "";
    const call = async (method, path, body, headers) => {
        const isForm = body instanceof FormData;
        const res = await fetch(base + path, {
            method,
            headers: { ...headers, ...(cookie && { cookie }), ...(body && !isForm && { "content-type": "application/json" }) },
            body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
        });
        const set = res.headers.get("set-cookie");
        if (set) cookie = set.split(";")[0];
        const type = res.headers.get("content-type") ?? "";
        const data = type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
        return { status: res.status, data, headers: res.headers };
    };
    const email = `${name.toLowerCase()}-${randomBytes(3).toString("hex")}@example.com`;
    const reg = await call("POST", "/auth/register", { name, email, password: "a-long-password-1" });
    assert.equal(reg.status, 201, JSON.stringify(reg.data));
    return call;
}

function photoForm(count = 1, { type = "image/jpeg", bytes = 2048 } = {}) {
    const form = new FormData();
    for (let i = 0; i < count; i++) form.append("photos", new Blob([new Uint8Array(bytes).fill(i)], { type }), `p${i}.jpg`);
    return form;
}

async function newJob(call, label = `Site ${randomBytes(3).toString("hex")}`) {
    const res = await call("POST", "/jobs", { label });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    return res.data.job;
}

// ---------- jobs ----------

test("DB-01 a new job has every field the app reads, and no userId leaves the API", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call, "  Oak   St. yard ");
    assert.equal(job.label, "Oak St. yard");
    assert.deepEqual(
        [job.sheetId, job.checklist, job.visitNotes, job.visitNotesUpdatedAt, job.hazards],
        [null, {}, "", null, []],
    );
    assert.match(job.id, /^[0-9a-f]{24}$/);
    assert.equal(job.userId, undefined);
    assert.equal(job._id, undefined);
});

test("DB-02 the same label in another case reopens the job instead of making a second one", { skip }, async () => {
    const call = await officer();
    const first = await newJob(call, "Mill Road");
    const again = await call("POST", "/jobs", { label: "mill ROAD" });
    assert.equal(again.status, 200);
    assert.equal(again.data.job.id, first.id);
    assert.equal((await call("GET", "/jobs")).data.jobs.length, 1);
});

test("DB-03 two requests for the same new label at once still make one job", { skip }, async () => {
    const call = await officer();
    const results = await Promise.all(Array.from({ length: 5 }, () => call("POST", "/jobs", { label: "Race Site" })));
    assert.ok(results.every((r) => r.status === 200 || r.status === 201), results.map((r) => r.status).join());
    assert.equal(new Set(results.map((r) => r.data.job.id)).size, 1);
    assert.equal((await call("GET", "/jobs")).data.jobs.length, 1);
});

test("DB-04 two officers can each have a job with the same label", { skip }, async () => {
    const a = await officer("A");
    const b = await officer("B");
    const ja = await newJob(a, "Shared Name");
    const jb = await newJob(b, "Shared Name");
    assert.notEqual(ja.id, jb.id);
});

test("DB-05 the job list is newest-opened first, and opening moves a job to the top", { skip }, async () => {
    const call = await officer();
    const one = await newJob(call, "One");
    await newJob(call, "Two");
    await newJob(call, "Three");
    assert.deepEqual((await call("GET", "/jobs")).data.jobs.map((j) => j.label), ["Three", "Two", "One"]);
    const opened = await call("POST", `/jobs/${one.id}/open`);
    assert.equal(opened.status, 200);
    const list = (await call("GET", "/jobs")).data.jobs;
    assert.deepEqual(list.map((j) => j.label), ["One", "Three", "Two"]);
    assert.equal(list[0].hazards, undefined, "the list leaves the hazards out");
});

test("DB-06 empty or too-long labels are refused", { skip }, async () => {
    const call = await officer();
    assert.equal((await call("POST", "/jobs", { label: "   " })).status, 400);
    assert.equal((await call("POST", "/jobs", { label: "x".repeat(LIMITS.labelChars + 1) })).status, 400);
    assert.equal((await call("POST", "/jobs", {})).status, 400);
});

// ---------- ownership ----------

test("DB-07 another officer gets 404 for every route on my job, hazard and photo, and changes nothing", { skip }, async () => {
    const me = await officer("Me");
    const other = await officer("Other");
    const job = await newJob(me, "Mine");
    const { data } = await me("POST", `/jobs/${job.id}/hazards`, { name: "Mine only" });
    const hazardId = data.hazardId;
    const up = await me("POST", `/jobs/${job.id}/hazards/${hazardId}/photos`, photoForm(1));
    const photoId = up.data.job.hazards[0].photoIds[0];
    const j = `/jobs/${job.id}`;
    const h = `${j}/hazards/${hazardId}`;

    const attempts = [
        ["GET", j], ["POST", `${j}/open`], ["PUT", `${j}/sheet`, { sheetId: LOG }],
        ["PUT", `${j}/visit-notes`, { visitNotes: "x" }], ["POST", `${j}/hazards`, { name: "Sneaky" }],
        ["PATCH", h, { comment: "x" }], ["POST", `${h}/photos`, photoForm(1)], ["DELETE", `${h}/photos/${photoId}`],
        ["DELETE", h], ["GET", `/photos/${photoId}`], ["DELETE", j],
    ];
    for (const [method, path, body] of attempts) {
        const res = await other(method, path, body);
        assert.equal(res.status, 404, `${method} ${path} gave ${res.status}`);
    }
    const after = (await me("GET", j)).data.job;
    assert.deepEqual(after, { ...after, label: "Mine", sheetId: null, visitNotes: "" });
    assert.equal(after.hazards.length, 1);
    assert.equal(after.hazards[0].comment, "");
    assert.equal((await me("GET", `/photos/${photoId}`)).status, 200);
    assert.deepEqual((await other("GET", "/jobs")).data.jobs, []);
});

test("DB-08 signed out gets 401, and ids that aren't ObjectIds get 404", { skip }, async () => {
    const res = await fetch(`${base}/jobs`);
    assert.equal(res.status, 401);
    const call = await officer();
    assert.equal((await call("GET", "/jobs/not-an-id")).status, 404);
    assert.equal((await call("GET", "/photos/123")).status, 404);
});

// ---------- sheet sync ----------

test("DB-09 picking Log Transport loads its 40 hazards in sheet order", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const res = await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: LOG });
    assert.equal(res.status, 200);
    const { hazards } = res.data.job;
    assert.equal(res.data.job.sheetId, LOG);
    assert.equal(hazards.length, 40);
    assert.ok(hazards.every((h) => h.source === "sheet" && h.sheetId === LOG && h.sheetKey && h.id));
    assert.equal(new Set(hazards.map((h) => h.sheetKey)).size, 40);
    assert.equal(hazards[0].sheetKey, "cu-732044-010");
    assert.equal(hazards[0].stage, undefined, "the stage is read from the sheet, not stored");
});

test("DB-10 picking the same sheet again adds nothing and keeps the hazard ids", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const first = (await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: LOG })).data.job;
    const second = (await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: LOG })).data.job;
    assert.deepEqual(second.hazards.map((h) => h.id), first.hazards.map((h) => h.id));
});

test("DB-11 changing sheet keeps worked-on hazards and the officer's own, drops untouched ones", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const loaded = (await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: LOG })).data.job.hazards;
    const [commented, withPhoto, marked] = loaded;
    await call("PATCH", `/jobs/${job.id}/hazards/${commented.id}`, { comment: "Seen at gate" });
    await call("POST", `/jobs/${job.id}/hazards/${withPhoto.id}/photos`, photoForm(1));
    await call("PATCH", `/jobs/${job.id}/hazards/${marked.id}`, { notApplicable: true });
    const own = (await call("POST", `/jobs/${job.id}/hazards`, { name: "Loose ladder" })).data.hazardId;

    const changed = (await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: LTC })).data.job;
    const ids = changed.hazards.map((h) => h.id);
    for (const keep of [commented.id, withPhoto.id, marked.id, own]) assert.ok(ids.includes(keep));
    assert.equal(changed.hazards.filter((h) => h.sheetId === LOG).length, 3);
    assert.equal(changed.hazards.filter((h) => h.sheetId === LTC).length, 14);
    assert.equal(changed.hazards.length, 3 + 1 + 14);

    const cleared = (await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: null })).data.job;
    assert.equal(cleared.sheetId, null);
    assert.equal(cleared.hazards.length, 4);
});

test("DB-12 an unknown sheet is refused", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    assert.equal((await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: "cu-000000" })).status, 400);
    assert.equal((await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: 5 })).status, 400);
});

test("DB-13 sheet changes racing a comment edit never lose the comment or duplicate hazards", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const loaded = (await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: LOG })).data.job.hazards;
    // Sheet switches and comment edits all at once. A comment the server said it saved must survive:
    // a sync that read the job before the comment and wrote after it would wipe it out.
    const sheets = Array.from({ length: 8 }, (_, i) => call("PUT", `/jobs/${job.id}/sheet`, { sheetId: i % 2 ? LOG : LTC }));
    const edits = loaded.slice(0, 20).map((h, i) => call("PATCH", `/jobs/${job.id}/hazards/${h.id}`, { comment: `Note ${i}` }).then((r) => ({ r, h, i })));
    await Promise.all(sheets);
    const saved = (await Promise.all(edits)).filter(({ r }) => r.status === 200);

    const final = (await call("GET", `/jobs/${job.id}`)).data.job;
    const keys = final.hazards.filter((h) => h.source === "sheet").map((h) => `${h.sheetId}/${h.sheetKey}`);
    assert.equal(new Set(keys).size, keys.length, "no sheet hazard twice");
    for (const { h, i } of saved) {
        assert.equal(final.hazards.find((x) => x.id === h.id)?.comment, `Note ${i}`, `saved comment ${i} was lost`);
    }
});

test("DB-13b a change made between the sheet sync's read and its write is not overwritten", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const target = (await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: LOG })).data.job.hazards[0];

    // The first time the route reads the job, a comment lands right after the read, before the write
    const realFindOne = Job.findOne;
    let sneaked = false;
    Job.findOne = function patchedFindOne(...args) {
        const query = realFindOne.apply(this, args);
        const exec = query.exec.bind(query);
        query.exec = async (...a) => {
            const result = await exec(...a);
            if (!sneaked) {
                sneaked = true;
                await Job.updateOne({ _id: job.id, "hazards._id": target.id }, { $set: { "hazards.$.comment": "Sneaked in" } });
            }
            return result;
        };
        return query;
    };
    try {
        assert.equal((await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: LTC })).status, 200);
    } finally {
        Job.findOne = realFindOne;
    }
    assert.ok(sneaked);
    const kept = (await call("GET", `/jobs/${job.id}`)).data.job.hazards.find((h) => h.id === target.id);
    assert.equal(kept?.comment, "Sneaked in", "the sync redid its work on the fresh copy, so the commented hazard stays");
});

// ---------- checklist and visit notes ----------

test("DB-14 checklist: ready and not-applicable are saved, pending removes the entry", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: LOG });
    const item = "cu-732044-062-1";
    let res = await call("PUT", `/jobs/${job.id}/checklist/${item}`, { status: "ready" });
    assert.deepEqual(res.data.job.checklist, { [item]: "ready" });
    res = await call("PUT", `/jobs/${job.id}/checklist/${item}`, { status: "not-applicable" });
    assert.deepEqual(res.data.job.checklist, { [item]: "not-applicable" });
    res = await call("PUT", `/jobs/${job.id}/checklist/${item}`, { status: "pending" });
    assert.deepEqual(res.data.job.checklist, {});
});

test("DB-15 checklist refuses unknown statuses and items that aren't on the job's sheet", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    assert.equal((await call("PUT", `/jobs/${job.id}/checklist/cu-732044-062-1`, { status: "ready" })).status, 400, "no sheet yet");
    await call("PUT", `/jobs/${job.id}/sheet`, { sheetId: LOG });
    assert.equal((await call("PUT", `/jobs/${job.id}/checklist/cu-732044-062-1`, { status: "done" })).status, 400);
    assert.equal((await call("PUT", `/jobs/${job.id}/checklist/cu-766011-016-1`, { status: "ready" })).status, 400);
    assert.equal((await call("PUT", `/jobs/${job.id}/checklist/$where`, { status: "ready" })).status, 400);
});

test("DB-16 visit notes are saved with the time, and the length limit holds", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const res = await call("PUT", `/jobs/${job.id}/visit-notes`, { visitNotes: "Gate code 4411" });
    assert.equal(res.data.job.visitNotes, "Gate code 4411");
    assert.ok(res.data.job.visitNotesUpdatedAt);
    assert.equal((await call("PUT", `/jobs/${job.id}/visit-notes`, { visitNotes: "x".repeat(LIMITS.visitNotesChars + 1) })).status, 400);
    assert.equal((await call("PUT", `/jobs/${job.id}/visit-notes`, { visitNotes: 5 })).status, 400);
});

// ---------- hazards ----------

test("DB-17 log, edit, mark not applicable and delete a hazard", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const created = await call("POST", `/jobs/${job.id}/hazards`, { name: " Unsecured load binder ", comment: "Truck 12" });
    assert.equal(created.status, 201);
    const h = created.data.job.hazards.find((x) => x.id === created.data.hazardId);
    assert.deepEqual([h.source, h.name, h.comment, h.notApplicable, h.photoIds], ["officer", "Unsecured load binder", "Truck 12", false, []]);
    assert.equal(h.sheetId, undefined);

    const edited = await call("PATCH", `/jobs/${job.id}/hazards/${h.id}`, { comment: "Truck 12\nAlso truck 4", notApplicable: true });
    const e = edited.data.job.hazards[0];
    assert.deepEqual([e.comment, e.notApplicable], ["Truck 12\nAlso truck 4", true]);

    const deleted = await call("DELETE", `/jobs/${job.id}/hazards/${h.id}`);
    assert.deepEqual(deleted.data.job.hazards, []);
    assert.equal((await call("DELETE", `/jobs/${job.id}/hazards/${h.id}`)).status, 404);
});

test("DB-18 hazard input rules: name required and capped, comment capped, notApplicable boolean", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    assert.equal((await call("POST", `/jobs/${job.id}/hazards`, { name: "" })).status, 400);
    assert.equal((await call("POST", `/jobs/${job.id}/hazards`, { name: "x".repeat(LIMITS.hazardNameChars + 1) })).status, 400);
    assert.equal((await call("POST", `/jobs/${job.id}/hazards`, { name: "ok", comment: "x".repeat(LIMITS.commentChars + 1) })).status, 400);
    const id = (await call("POST", `/jobs/${job.id}/hazards`, { name: "ok" })).data.hazardId;
    assert.equal((await call("PATCH", `/jobs/${job.id}/hazards/${id}`, { notApplicable: "yes" })).status, 400);
    assert.equal((await call("PATCH", `/jobs/${job.id}/hazards/${id}`, {})).status, 400);
});

test(`DB-19 a job holds at most the hazard limit, even when the requests race`, { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    // Fill to one under the limit directly, then race several requests for the last slot
    const filler = Array.from({ length: LIMITS.hazardsPerJob - 1 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(), source: "officer", name: `H${i}`, comment: "", notApplicable: false, photoIds: [], createdAt: new Date(),
    }));
    await Job.updateOne({ _id: job.id }, { $set: { hazards: filler } });
    const results = await Promise.all(Array.from({ length: 4 }, (_, i) => call("POST", `/jobs/${job.id}/hazards`, { name: `Last ${i}` })));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 400));
    assert.equal((await call("GET", `/jobs/${job.id}`)).data.job.hazards.length, LIMITS.hazardsPerJob);
});

// ---------- photos ----------

test("DB-20 photos: upload, read back the same bytes, delete one", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const id = (await call("POST", `/jobs/${job.id}/hazards`, { name: "Ladder" })).data.hazardId;
    const up = await call("POST", `/jobs/${job.id}/hazards/${id}/photos`, photoForm(2, { bytes: 4096 }));
    assert.equal(up.status, 201);
    const [p1, p2] = up.data.job.hazards[0].photoIds;

    const got = await call("GET", `/photos/${p1}`);
    assert.equal(got.status, 200);
    assert.equal(got.headers.get("content-type"), "image/jpeg");
    assert.match(got.headers.get("cache-control"), /private/);
    assert.equal(got.data.length, 4096);

    const del = await call("DELETE", `/jobs/${job.id}/hazards/${id}/photos/${p1}`);
    assert.deepEqual(del.data.job.hazards[0].photoIds, [p2]);
    assert.equal((await call("GET", `/photos/${p1}`)).status, 404);
    assert.equal(await Photo.countDocuments({ hazardId: id }), 1);
});

test("DB-20b the browser must ask the server for every photo view, so its cache can't bypass ownership", { skip }, async () => {
    const owner = await officer("Owner");
    const other = await officer("Other");
    const job = await newJob(owner);
    const id = (await owner("POST", `/jobs/${job.id}/hazards`, { name: "Ladder" })).data.hazardId;
    const up = await owner("POST", `/jobs/${job.id}/hazards/${id}/photos`, photoForm(1, { bytes: 4096 }));
    const [photoId] = up.data.job.hazards[0].photoIds;

    const first = await owner("GET", `/photos/${photoId}`);
    const cacheControl = first.headers.get("cache-control");
    assert.match(cacheControl, /no-cache/);
    assert.doesNotMatch(cacheControl, /max-age|immutable/);
    const etag = first.headers.get("etag");
    assert.ok(etag, "an ETag lets the owner's repeat views skip the download");

    // What a browser sends when it checks its copy. Without the cache-control, Node's fetch adds no-cache for a full reload.
    const repeat = await owner("GET", `/photos/${photoId}`, undefined, { "if-none-match": etag, "cache-control": "max-age=0" });
    assert.equal(repeat.status, 304);
    assert.equal(repeat.data.length, 0);

    assert.equal((await other("GET", `/photos/${photoId}`, undefined, { "if-none-match": etag })).status, 404);

    await owner("DELETE", `/jobs/${job.id}/hazards/${id}/photos/${photoId}`);
    assert.equal((await owner("GET", `/photos/${photoId}`, undefined, { "if-none-match": etag })).status, 404);
});

test("DB-21 photo rules: type, size, count and at least one", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const id = (await call("POST", `/jobs/${job.id}/hazards`, { name: "Ladder" })).data.hazardId;
    const url = `/jobs/${job.id}/hazards/${id}/photos`;
    assert.equal((await call("POST", url, photoForm(1, { type: "image/gif" }))).status, 400);
    assert.equal((await call("POST", url, photoForm(1, { bytes: LIMITS.photoBytes + 1 }))).status, 400);
    assert.equal((await call("POST", url, new FormData())).status, 400);
    assert.equal((await call("POST", url, photoForm(LIMITS.photosPerHazard + 1))).status, 400);

    assert.equal((await call("POST", url, photoForm(LIMITS.photosPerHazard - 1))).status, 201);
    assert.equal((await call("POST", url, photoForm(2))).status, 400, "over the limit in total");
    assert.equal((await call("POST", url, photoForm(1))).status, 201);
    assert.equal(await Photo.countDocuments({ hazardId: id }), LIMITS.photosPerHazard, "no photo saved without a place on the hazard");
});

test("DB-22 photo uploads racing for the last slots never go over the limit or leave stray photos", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const id = (await call("POST", `/jobs/${job.id}/hazards`, { name: "Ladder" })).data.hazardId;
    const url = `/jobs/${job.id}/hazards/${id}/photos`;
    await call("POST", url, photoForm(LIMITS.photosPerHazard - 2));
    await Promise.all(Array.from({ length: 4 }, () => call("POST", url, photoForm(2))));
    const hazard = (await call("GET", `/jobs/${job.id}`)).data.job.hazards[0];
    assert.equal(hazard.photoIds.length, LIMITS.photosPerHazard);
    assert.equal(await Photo.countDocuments({ hazardId: id }), LIMITS.photosPerHazard);
});

test("DB-23 deleting a hazard or a job deletes its photos", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const a = (await call("POST", `/jobs/${job.id}/hazards`, { name: "A" })).data.hazardId;
    const b = (await call("POST", `/jobs/${job.id}/hazards`, { name: "B" })).data.hazardId;
    await call("POST", `/jobs/${job.id}/hazards/${a}/photos`, photoForm(2));
    await call("POST", `/jobs/${job.id}/hazards/${b}/photos`, photoForm(3));

    await call("DELETE", `/jobs/${job.id}/hazards/${a}`);
    assert.equal(await Photo.countDocuments({ jobId: job.id }), 3);
    assert.equal((await call("DELETE", `/jobs/${job.id}`)).status, 204);
    assert.equal(await Photo.countDocuments({ jobId: job.id }), 0);
    assert.equal((await call("GET", `/jobs/${job.id}`)).status, 404);
});

// ---------- recent sheets ----------

test("DB-24 recent sheets: newest first, no repeats, at most the limit, unknown sheets refused", { skip }, async () => {
    const call = await officer();
    assert.deepEqual((await call("GET", "/me/recent-sheets")).data.recentSheetIds, []);
    for (const id of [LOG, LTC, "cu-761030", LOG, "cu-763025"]) await call("POST", "/me/recent-sheets", { sheetId: id });
    assert.deepEqual((await call("GET", "/me/recent-sheets")).data.recentSheetIds, ["cu-763025", LOG, "cu-761030"]);
    assert.equal((await call("POST", "/me/recent-sheets", { sheetId: "nope" })).status, 400);
    const other = await officer("Other");
    assert.deepEqual((await other("GET", "/me/recent-sheets")).data.recentSheetIds, [], "each officer has their own");
});

// ---------- the database's own rules ----------

test("DB-25 MongoDB's validator refuses bad documents even when the app's checks are skipped", { skip }, async () => {
    const userId = new mongoose.Types.ObjectId();
    const good = {
        userId, label: "Direct", sheetId: null, checklist: {}, visitNotes: "", visitNotesUpdatedAt: null, hazards: [],
        lastOpenedAt: new Date(), rev: 0, createdAt: new Date(), updatedAt: new Date(),
    };
    const jobs = Job.collection;
    await jobs.insertOne({ ...good });
    const hazard = { _id: new mongoose.Types.ObjectId(), source: "officer", name: "x", comment: "", notApplicable: false, photoIds: [], createdAt: new Date() };
    const bad = [
        { ...good, label: "" },
        { ...good, label: "Extra", extra: 1 },
        { ...good, label: "C", checklist: { a: "done" } },
        { ...good, label: "D", hazards: [{ ...hazard, source: "sheet" }] },
        { ...good, label: "E", hazards: [{ ...hazard, sheetId: LOG, sheetKey: "k" }] },
        { ...good, label: "F", hazards: [{ ...hazard, photoIds: Array.from({ length: LIMITS.photosPerHazard + 1 }, () => new mongoose.Types.ObjectId()) }] },
        { ...good, label: "G", visitNotes: "x".repeat(LIMITS.visitNotesChars + 1) },
    ];
    for (const doc of bad) await assert.rejects(jobs.insertOne(doc), { code: 121 }, JSON.stringify(doc).slice(0, 80));
    await assert.rejects(jobs.insertOne({ ...good }), { code: 11000 }, "same label for the same officer");
    await assert.rejects(jobs.insertOne({ ...good, label: "DIRECT" }), { code: 11000 }, "case doesn't matter");
    await assert.rejects(
        Photo.collection.insertOne({ userId, jobId: userId, hazardId: userId, contentType: "image/gif", data: Buffer.from("x"), size: 1, createdAt: new Date() }),
        { code: 121 },
    );
});

// ---------- indexes and size ----------

test("DB-26 every route's query uses an index (IXSCAN), none scans the collection", { skip }, async () => {
    const userId = new mongoose.Types.ObjectId();
    const jobId = new mongoose.Types.ObjectId();
    const plans = {
        "list jobs": Job.find({ userId }).sort({ lastOpenedAt: -1 }),
        "label lookup": Job.findOne({ userId, label: "x" }).collation({ locale: "en", strength: 2 }),
        "one job": Job.findOne({ _id: jobId, userId }),
        "one hazard": Job.findOne({ _id: jobId, userId, "hazards._id": jobId }),
        "job photos": Photo.find({ jobId }),
        "hazard photos": Photo.find({ jobId, hazardId: jobId }),
        "one photo": Photo.findOne({ _id: jobId, userId }),
    };
    for (const [name, query] of Object.entries(plans)) {
        const text = JSON.stringify((await query.explain("queryPlanner")).queryPlanner.winningPlan);
        assert.ok(/IXSCAN|IDHACK|EXPRESS/.test(text) && !text.includes("COLLSCAN"), `${name}: ${text.slice(0, 200)}`);
    }
});

test("DB-27 a worst-case job (every limit full) stays far under MongoDB's 16 MB document limit", { skip }, async () => {
    const call = await officer();
    const job = await newJob(call);
    const ids = () => Array.from({ length: LIMITS.photosPerHazard }, () => new mongoose.Types.ObjectId());
    const hazards = Array.from({ length: LIMITS.hazardsPerJob }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(), source: "sheet", sheetId: LOG, sheetKey: `k${i}`, name: "n".repeat(LIMITS.hazardNameChars),
        comment: "c".repeat(LIMITS.commentChars), notApplicable: false, photoIds: ids(), createdAt: new Date(),
    }));
    await Job.updateOne({ _id: job.id }, { $set: { hazards, visitNotes: "v".repeat(LIMITS.visitNotesChars) } });
    const [{ bytes }] = await Job.aggregate([{ $match: { _id: new mongoose.Types.ObjectId(job.id) } }, { $project: { bytes: { $bsonSize: "$$ROOT" } } }]);
    assert.ok(bytes < 2 * 1024 * 1024, `${bytes} bytes`);
});
