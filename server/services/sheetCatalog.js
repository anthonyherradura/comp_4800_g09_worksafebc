// The protocol sheets Gemini picks from: the same JSON files the frontend bundles (src/data/sheets).
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toCatalogEntry } from "../../src/data/sheets/catalog.js";

const SHEETS_DIR = fileURLToPath(new URL("../../src/data/sheets/", import.meta.url));

export const SHEET_CATALOG = readdirSync(SHEETS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => toCatalogEntry(JSON.parse(readFileSync(SHEETS_DIR + f, "utf8"))));
