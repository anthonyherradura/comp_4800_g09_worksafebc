// The protocol sheets, read from the same JSON files the frontend bundles (src/data/sheets).
// SHEET_CATALOG is what Gemini picks from; getSheetHazards / getSheetChecklist are what the jobs API checks against.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toCatalogEntry } from "../../src/data/sheets/catalog.js";
import { sheetChecklist, sheetHazards } from "../../src/data/sheets/sheetContent.js";

const SHEETS_DIR = fileURLToPath(new URL("../../src/data/sheets/", import.meta.url));

const SHEETS = readdirSync(SHEETS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(SHEETS_DIR + f, "utf8")));

const byId = new Map(SHEETS.map((s) => [s.sheetId, s]));
const hazardCache = new Map();
const checklistCache = new Map();

export const SHEET_CATALOG = SHEETS.map(toCatalogEntry);

export const sheetExists = (sheetId) => byId.has(sheetId);

// [{ key, name, ... }] in sheet order, or [] for an unknown or null sheetId
export function getSheetHazards(sheetId) {
    if (!byId.has(sheetId)) return [];
    if (!hazardCache.has(sheetId)) hazardCache.set(sheetId, sheetHazards(byId.get(sheetId)));
    return hazardCache.get(sheetId);
}

// [{ id, group, label }], or [] for an unknown or null sheetId
export function getSheetChecklist(sheetId) {
    if (!byId.has(sheetId)) return [];
    if (!checklistCache.has(sheetId)) checklistCache.set(sheetId, sheetChecklist(byId.get(sheetId)));
    return checklistCache.get(sheetId);
}
