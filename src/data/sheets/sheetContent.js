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

const answerLines = (text) => bullets(text.replace(FORM_PROMPT, ""));

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// "Does this industry … contain hazards relating to working from heights?" -> "Working from heights"
function nameFromQuestion(heading) {
    const asked = [...heading.matchAll(/hazards (relating to|of|requiring) ([^?]+)\?/gi)].pop();
    if (!asked) {
        const required = heading.match(/require ([^?]+)\?/i);
        return required ? capitalize(required[1].trim()) : cleanText(heading);
    }
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

const QUESTION = /Does this industry[^?]*\?/gi;
const IS_QUESTION = /^Does this industry/i;
const SECTION_HEADING = /^(Industry or Classification Unit Hazards)?$/i;
// A heading for the free-form topics that follow it, not a hazard itself
const OTHER_HAZARDS = /other specific hazards/i;
// The form's own prompt, printed under some questions
// The sheet's own words for a hazard that usually doesn't arise. Only a label: the officer still decides.
const NOT_TYPICAL = /\bnot (a typical hazard|generally applicable)\b/i;
const FORM_PROMPT = /If\s+.Yes.\s+please explain[^.?]*[.?]?/gi;

// Text may repeat the chunk's question with its answer, or just carry on from the chunk before
function splitQuestions(text) {
    const matches = [...text.matchAll(QUESTION)];
    const end = (i) => matches[i + 1]?.index ?? text.length;
    return {
        before: text.slice(0, matches[0]?.index ?? text.length),
        questions: matches.map((m, i) => ({ question: m[0], answer: text.slice(m.index + m[0].length, end(i)) })),
    };
}

function hazardsFromQuestions(chunks) {
    // "Violence", "Chemical agents (WHMIS)" … matched to the hazard whose name contains that topic
    const regs = chunks
        .filter((c) => c.section === "Regulations to Consider")
        .map((c) => ({ topic: cleanText(c.heading).replace(/\s*\(.*\)\s*/g, "").toLowerCase(), chunk: c }));

    const hazards = [];
    const add = (key, name, answer) => {
        const reg = regs.find((r) => name.toLowerCase().includes(r.topic));
        hazards.push({
            key,
            name,
            stage: null,
            details: answerLines(answer),
            controls: [],
            legislation: reg ? bullets(reg.chunk.text).join(" ") : "",
            regulations: reg ? [...(reg.chunk.regulations ?? [])] : [],
        });
    };

    for (const chunk of chunks.filter((c) => c.section === "Industry or Classification Unit Hazards")) {
        const heading = cleanText(chunk.heading);
        const parts = splitQuestions(chunk.text);
        let { before } = parts;
        const questions = [...parts.questions];

        if (IS_QUESTION.test(heading)) {
            // Some sheets repeat the question in the text; others put only the answer there
            if (!questions.length || before.trim()) {
                questions.unshift({ question: heading, answer: before });
                before = "";
            }
        } else if (!SECTION_HEADING.test(heading)) {
            add(chunk.id, heading, before);
            before = "";
        }

        const carriedOver = answerLines(before);
        if (carriedOver.length) hazards[hazards.length - 1]?.details.push(...carriedOver);

        for (const { question, answer } of questions) {
            if (!OTHER_HAZARDS.test(question)) add(chunk.id, nameFromQuestion(question), answer);
        }
    }
    return hazards.map((h) => ({ ...h, notTypical: NOT_TYPICAL.test(h.details[0] ?? "") }));
}

// Every hazard the sheet lists, in sheet order: { key, name, stage, details, controls, legislation, regulations }
export function sheetHazards(sheet) {
    const fromTables = hazardsFromControlTables(sheet.chunks);
    return fromTables.length ? fromTables : hazardsFromQuestions(sheet.chunks);
}

// Sheet sections the officer works through before and while walking onto the site
const CHECKLIST_SECTIONS = [
    { section: /^Prevention Officer Personal Safety/i, group: "Before you go", sentences: true },
    { section: /^Preparation$/i, group: "Before you go" },
    // Workers' PPE stands in only on sheets that don't say what the officer needs
    { section: /^Personal Protective Equipment/i, group: "Before you go", sentences: true, unlessListed: true },
    { section: /^Arrival$/i, group: "On arrival" },
    { section: /^Walk through$/i, group: "Walking the site" },
];

// Sentences, or list items that the PDF ran together: "… are present Safety glasses – when …"
const SENTENCE_OR_LIST_ITEM = /(?<=\.)\s+|\s+(?=[A-Z][a-z]+(?: [a-z]+){0,4} – )/;

// The sheet's officer checklist: [{ id, group, label }], grouped in the order above
export function sheetChecklist(sheet) {
    const items = [];
    for (const { section, group, sentences, unlessListed } of CHECKLIST_SECTIONS) {
        if (unlessListed && items.length) continue;
        for (const chunk of sheet.chunks.filter((c) => section.test(c.section))) {
            const text = chunk.text.replace(QUESTION, "");
            const lines = sentences && !text.includes(BULLET)
                ? cleanText(text).split(SENTENCE_OR_LIST_ITEM)
                : bullets(text);
            lines.filter((line) => line && !/^Not applicable/i.test(line)).forEach((label, i) => items.push({ id: `${chunk.id}-${i + 1}`, group, label }));
        }
    }
    return items;
}
