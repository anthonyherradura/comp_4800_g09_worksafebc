import { toCatalogEntry } from "./catalog.js";
import { sheetChecklist, sheetHazards } from "./sheetContent.js";

// Loads every sheet JSON in this folder. Drop a new one in and it shows up.
const modules = import.meta.glob("./*.json", { eager: true });

export const SHEETS = Object.values(modules).map((m) => m.default);

// One short entry per sheet (name, CU number, summary), sorted by name
export const SHEET_CATALOG = SHEETS.map(toCatalogEntry).sort((a, b) => a.name.localeCompare(b.name));

const byId = Object.fromEntries(SHEETS.map((s) => [s.sheetId, s]));
const hazardCache = {};
const checklistCache = {};

// The sheet's hazards, parsed once: [{ key, name, stage, details, controls, legislation, regulations }]
export const getSheetHazards = (sheetId) =>
    byId[sheetId] ? (hazardCache[sheetId] ??= sheetHazards(byId[sheetId])) : [];

// One hazard's guidance from its sheet, or null
export const getSheetHazard = (sheetId, key) => getSheetHazards(sheetId).find((h) => h.key === key) ?? null;

// The officer's checklist for the sheet: [{ id, group, label }]
export const getSheetChecklist = (sheetId) =>
    byId[sheetId] ? (checklistCache[sheetId] ??= sheetChecklist(byId[sheetId])) : [];
