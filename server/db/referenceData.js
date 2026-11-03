// Turns the extracted sheet files (src/data/sheets/*.json) into reference documents.
// prepareReferenceData is pure so it can be tested; loadReferenceData writes it, and running it again changes nothing.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Sheet, SheetSection, SheetChunk, Regulation, SheetChunkRegulation, ChecklistItem } from "../models/index.js";
// The app's own sheet parser, so the database and the app agree on which entries are hazards
import { sheetHazards } from "../../src/data/sheets/sheetContent.js";

// Matches INITIAL_ITEMS in src/pages/Planning/Planning.jsx
export const CHECKLIST_ITEMS = [
    { _id: "sheet", label: "Confirm protocol sheet", sortOrder: 1 },
    { _id: "equipment", label: "Review protective equipment", sortOrder: 2 },
    { _id: "practices", label: "Review site practices", sortOrder: 3 },
    { _id: "questions", label: "Prepare inspection questions", sortOrder: 4 },
];

export async function readSheetFiles(dir) {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
    return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), "utf8"))));
}

// The sheets use both "2023/07/07" and "2020-05-28"
const parseIssued = (value) => {
    const [y, m, d] = value.split(/[/-]/).map(Number);
    return new Date(Date.UTC(y, m - 1, d));
};
// "WCA 21–25" -> { instrument: "WCA", reference: "21-25" }
const parseRegulation = (citation) => {
    const [instrument, ...rest] = citation.replace(/\u2013/g, "-").split(" ");
    return { instrument, reference: rest.join(" ").trim() };
};

/**
 * @param sheetFiles     parsed JSON files
 * @param existingIds    { sections: Map name -> _id, regulations: Map "OHSR|4.3" -> _id } already in the database,
 *                       so numeric ids stay stable when new sheets are added
 */
export function prepareReferenceData(sheetFiles, existingIds = { sections: new Map(), regulations: new Map() }) {
    const sectionIds = new Map(existingIds.sections);
    const regulationIds = new Map(existingIds.regulations);
    const nextId = (map) => Math.max(0, ...map.values()) + 1;

    const sheets = [], chunks = [], links = [];
    for (const file of sheetFiles) {
        const cuNumber = file.sheetId.split("-")[1];
        sheets.push({
            _id: file.sheetId,
            cuNumber,
            title: file.title.replace(/\s*\(CU \d+\)\s*$/i, ""), // the CU number lives in cuNumber only
            issuedOn: parseIssued(file.issued),
            copyright: file.copyright ?? null,
            sourceFile: file.source,
        });
        // e.g. 40 on Log Transport: 2 of its 42 hazard-section blocks only continue the hazard above them
        const hazardIds = new Set(sheetHazards(file).map((h) => h.key));
        for (const c of file.chunks) {
            if (!sectionIds.has(c.section)) sectionIds.set(c.section, nextId(sectionIds));
            chunks.push({
                _id: c.id,
                sheetId: file.sheetId,
                sheetSectionId: sectionIds.get(c.section),
                seq: Number(c.id.split("-").pop()),
                heading: c.heading,
                bodyText: c.text,
                pageNo: c.page ?? null,
                isHazard: hazardIds.has(c.id),
            });
            for (const citation of new Set(c.regulations ?? [])) {
                const reg = parseRegulation(citation);
                const key = `${reg.instrument}|${reg.reference}`;
                if (!regulationIds.has(key)) regulationIds.set(key, nextId(regulationIds));
                links.push({ sheetChunkId: c.id, regulationId: regulationIds.get(key) });
            }
        }
    }
    const sections = [...sectionIds].map(([name, _id]) => ({ _id, name }));
    const regulations = [...regulationIds].map(([key, _id]) => {
        const [instrument, reference] = key.split("|");
        return { _id, instrument, reference };
    });
    return { sheets, sections, chunks, regulations, links, checklistItems: CHECKLIST_ITEMS };
}

const upsertAll = (Model, docs) =>
    docs.length === 0 ? null : Model.bulkWrite(
        docs.map(({ _id, ...fields }) => ({ updateOne: { filter: { _id }, update: { $set: fields }, upsert: true } })),
        { ordered: true },
    );

// Never deletes: a sheet entry an officer has recorded must stay, even if a newer extraction drops it.
export async function loadReferenceData(sheetFiles) {
    const sections = new Map((await SheetSection.find().lean()).map((s) => [s.name, s._id]));
    const regulations = new Map((await Regulation.find().lean()).map((r) => [`${r.instrument}|${r.reference}`, r._id]));
    const data = prepareReferenceData(sheetFiles, { sections, regulations });

    // Databases set up before isHazard existed have isHazardSection on each section; the strict validator would
    // reject any update that leaves it there. Native driver call, because Mongoose refuses unknown fields.
    await SheetSection.collection.updateMany({ isHazardSection: { $exists: true } }, { $unset: { isHazardSection: "" } });

    await upsertAll(Sheet, data.sheets);
    await upsertAll(SheetSection, data.sections);
    await upsertAll(Regulation, data.regulations);
    await upsertAll(SheetChunk, data.chunks);
    await upsertAll(ChecklistItem, data.checklistItems);
    if (data.links.length > 0) {
        await SheetChunkRegulation.bulkWrite(
            data.links.map((l) => ({ updateOne: { filter: l, update: { $setOnInsert: l }, upsert: true } })),
            { ordered: false },
        );
    }
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
}
