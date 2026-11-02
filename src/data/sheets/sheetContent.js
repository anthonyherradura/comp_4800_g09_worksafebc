// Reads what an officer needs out of a protocol sheet: its hazards and the checklist for before walking the site.
// Plain ESM (no Vite features) so it can be tested with node --test.
//
// The sheets come in two layouts:
//   - "Hazards, Controls and Legislation" blocks of "Hazard: … Control: … Legislation: …" (e.g. Log Transport),
//     with Preparation / Arrival / Walk through sections for the officer
//   - "Does this industry … contain hazards relating to X?" questions plus "Regulations to Consider"
//     and a PPE section (e.g. Long-term Care)

const BULLET = "•";
// The PDF's sub-bullets and symbols came through as private-use characters (U+E000 to U+F8FF)
const PRIVATE_USE = /[\uE000-\uF8FF]/g;

export function cleanText(text) {
    return text.replace(PRIVATE_USE, "").replace(/[ \t]+/g, " ").trim();
}

// "• one\n• two" -> ["one", "two"]. A line without a bullet continues the item above it.
function bullets(text) {
    const items = [];
    for (const line of text.split("\n")) {
        const isNew = line.trim().startsWith(BULLET) || items.length === 0;
        const clean = cleanText(line).replace(/^•\s*/, "");
        if (!clean) continue;
        if (isNew) items.push(clean);
        else items[items.length - 1] += ` ${clean}`;
    }
    return items;
}

// "Hazard: …\nControl: …\nLegislation: …" -> { hazard: [...], control: [...], legislation: "..." }
function labelledParts(text) {
    const parts = {};
    let label = null;
    for (const line of text.split("\n")) {
        const m = line.match(/^(Hazard|Control|Legislation|Note):\s*(.*)$/);
        if (m) {
            label = m[1].toLowerCase();
            parts[label] = m[2];
        } else if (label) {
            parts[label] += `\n${line}`;
        }
    }
    return {
        hazard: parts.hazard ? bullets(parts.hazard) : [],
        control: parts.control ? bullets(parts.control) : [],
        legislation: parts.legislation ? cleanText(parts.legislation) : "",
    };
}

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// "Does this industry … contain hazards relating to working from heights?" -> "Working from heights"
function nameFromQuestion(heading) {
    const asked = [...heading.matchAll(/hazards (relating to|of|requiring) ([^?]+)\?/gi)].pop();
    if (!asked) return cleanText(heading);
    const [, kind, topic] = asked;
    return kind.toLowerCase() === "requiring" ? `Hazards requiring ${topic.trim()}` : capitalize(topic.trim());
}

function hazardsFromControlTables(chunks) {
    const hazards = [];
    for (const chunk of chunks.filter((c) => c.section === "Hazards, Controls and Legislation")) {
        const { hazard, control, legislation } = labelledParts(chunk.text);
        const previous = hazards[hazards.length - 1];
        if (hazard.length === 0) {
            // A block with only controls carries on the hazard above it; a lone Note adds nothing to check
            if (previous && control.length) {
                previous.controls.push(...control);
                if (legislation) previous.legislation = [previous.legislation, legislation].filter(Boolean).join(" ");
                previous.regulations.push(...(chunk.regulations ?? []));
            }
            continue;
        }
        hazards.push({
            key: chunk.id,
            name: hazard[0].replace(/\.$/, ""),
            stage: cleanText(chunk.heading),
            details: hazard.slice(1),
            controls: control,
            legislation,
            regulations: [...(chunk.regulations ?? [])],
        });
    }
    return hazards;
}

function hazardsFromQuestions(chunks) {
    // "Violence", "Chemical agents (WHMIS)" … matched to the hazard whose name contains that topic
    const regs = chunks
        .filter((c) => c.section === "Regulations to Consider")
        .map((c) => ({ topic: cleanText(c.heading).replace(/\s*\(.*\)\s*/g, "").toLowerCase(), chunk: c }));

    return chunks
        .filter((c) => c.section === "Industry or Classification Unit Hazards")
        .map((chunk) => {
            const name = nameFromQuestion(chunk.heading);
            const reg = regs.find((r) => name.toLowerCase().includes(r.topic));
            return {
                key: chunk.id,
                name,
                stage: null,
                details: bullets(chunk.text),
                controls: [],
                legislation: reg ? bullets(reg.chunk.text).join(" ") : "",
                regulations: reg ? [...(reg.chunk.regulations ?? [])] : [],
            };
        });
}

// Every hazard the sheet lists, in sheet order: { key, name, stage, details, controls, legislation, regulations }
export function sheetHazards(sheet) {
    const fromTables = hazardsFromControlTables(sheet.chunks);
    return fromTables.length ? fromTables : hazardsFromQuestions(sheet.chunks);
}

// Sheet sections the officer works through before and while walking onto the site
const CHECKLIST_SECTIONS = [
    { section: /^Preparation$/i, group: "Before you go" },
    { section: /^Personal Protective Equipment/i, group: "Before you go", sentences: true },
    { section: /^Arrival$/i, group: "On arrival" },
    { section: /^Walk through$/i, group: "Walking the site" },
];

// The sheet's officer checklist: [{ id, group, label }], grouped in the order above
export function sheetChecklist(sheet) {
    const items = [];
    for (const { section, group, sentences } of CHECKLIST_SECTIONS) {
        for (const chunk of sheet.chunks.filter((c) => section.test(c.section))) {
            const lines = sentences
                ? cleanText(chunk.text).split(/(?<=\.)\s+/)
                : bullets(chunk.text);
            lines.filter(Boolean).forEach((label, i) => items.push({ id: `${chunk.id}-${i + 1}`, group, label }));
        }
    }
    return items;
}
