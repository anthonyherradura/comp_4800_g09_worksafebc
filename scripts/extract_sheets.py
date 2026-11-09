#!/usr/bin/env python3
"""
Turn HIIPS protocol sheet PDFs into JSON chunks for the app.

Usage:  python scripts/extract_sheets.py sheets-pdf src/data/sheets
Needs:  pip install pdfplumber

Text is copied word for word from the PDF. Nothing is reworded.
Each table row becomes one chunk (a hazard with its control and regulations).
Text outside tables is split by the headings in the table of contents.
"""
import json, re, sys
from pathlib import Path
import pdfplumber
from pdfplumber.utils import extract_text

START_PAGE = 3          # zero-based: skip cover, table of contents and blank page
TOP, BOTTOM = 70, 60    # page header and footer margins in points
HAZARD_SECTION = "Industry or Classification Unit Hazards"
QUESTION = re.compile(r"Does this industry[^?]*\?", re.I)
HEADER_LABELS = ("Phase", "Type of hazard", "Hazard/Violation/Topic", "Order Name", "Name of Resource")


def unwrap(text):
    """Join wrapped lines. Keep bullets and lines ending in a colon on their own line."""
    out = []
    for ln in (l.strip() for l in text.split("\n")):
        if not ln:
            continue
        if not out or ln.startswith("•") or out[-1].endswith(":"):
            out.append(ln)
        else:
            out[-1] += " " + ln
    return "\n".join(out)


def merge(values, gap):
    """Group sorted (position, weight) pairs that sit within gap of each other."""
    groups = []
    for pos, w in sorted(values):
        if groups and pos - groups[-1][-1][0] <= gap:
            groups[-1].append((pos, w))
        else:
            groups.append([(pos, w)])
    return [(sum(p * w for p, w in g) / sum(w for _, w in g), sum(w for _, w in g)) for g in groups]


def split_questions(chunks):
    """Some sheets print several "Does this industry…?" questions in one block. Each is a hazard, so give each its own chunk."""
    out = []
    for c in chunks:
        found = list(QUESTION.finditer(c["text"]))
        if c["section"] != HAZARD_SECTION or len(found) < 2:
            out.append(c)
            continue
        before = c["text"][:found[0].start()].strip()
        if before:
            out.append({**c, "text": before, "regulations": regs_in(before)})
        for m, end in zip(found, [f.start() for f in found[1:]] + [len(c["text"])]):
            answer = c["text"][m.end():end].strip()
            out.append({**c, "heading": m.group(), "text": answer or m.group(), "regulations": regs_in(answer)})
    return out


def table_grid(page):
    """Return (column x positions, row separator y positions, vertical edges), or None.
    Borders are drawn as many short segments, so a row separator is a y position where the
    segments together run border to border. Short inset segments (text highlights) are ignored."""
    v = [(e["x0"], e["top"], e["bottom"]) for e in page.edges
         if e["orientation"] == "v" and e["bottom"] - e["top"] >= 15]
    cols = [x for x, w in merge([(x, b - t) for x, t, b in v], 8) if w >= 150]
    if len(cols) < 3:
        return None
    h = [e for e in page.edges if e["orientation"] == "h" and e["x1"] > e["x0"]]
    wide = [e for e in h if e["x1"] - e["x0"] >= 40]
    if not wide:
        return None
    left, right = min(e["x0"] for e in wide), max(e["x1"] for e in wide)
    # In wide tables the first column is often one merged cell (a phase spanning several rows),
    # so its row lines only run from the second column to the right border.
    starts = [(left, 0.95 * (right - left))]
    if len(cols) >= 5:
        starts.append((sorted(cols)[1], 0.95 * (right - sorted(cols)[1])))
    rows = []
    for y, _ in merge([(e["top"], 1) for e in h], 3):
        spans = sorted((e["x0"], e["x1"]) for e in h if abs(e["top"] - y) <= 3)
        for start, need in starts:
            if spans[0][0] > start + 3 and not any(a <= start + 3 for a, _ in spans):
                continue
            if max(b for _, b in spans) < right - 3:
                continue
            covered, end = 0.0, start
            for a, b in spans:
                a = max(a, end)
                if b > a:
                    covered += b - a
                    end = b
            if covered >= need:
                rows.append(y)
                break
    return (cols, rows, v) if len(rows) >= 2 else None


def cell_text(page, x0, x1, y0, y1):
    """Text inside a box. Picks characters by their centre point so stray spaces
    from a neighbouring row do not leak in."""
    chars = [c for c in page.chars
             if x0 <= (c["x0"] + c["x1"]) / 2 <= x1 and y0 <= (c["top"] + c["bottom"]) / 2 <= y1]
    return extract_text(chars, x_tolerance=5) if chars else ""


def regs_in(text):
    found = re.findall(r"OHSR\s+Sections?\s+([\d.]+(?:\([\w.]+\))*(?:\s*[-–]\s*[\d.]+)?)", text)
    found = ["OHSR " + f.replace(" ", "") for f in found]
    found += ["WCA " + f.replace(" ", "") for f in re.findall(r"WCA\s+Sections?\s+(\d+(?:\s*[-–]\s*\d+)?)", text)]
    found += ["OHSR " + f for f in re.findall(r"\bOHSR\s+(2[0-9]\.\d+[\w.()]*)", text)]
    return sorted(set(found))


def parse_sheet(path):
    pdf = pdfplumber.open(path)
    first = pdf.pages[0].extract_text() or ""
    title_m = re.search(r"([A-Z][\w\- ,&/()]+?)\s*\(CU\s*(\d+)\)", pdf.metadata.get("Title", "") or first)
    title, cu = (title_m.group(1).strip(), title_m.group(2)) if title_m else (Path(path).stem, "")
    issued = (re.search(r"Issued:\s*([\d/\-]+)", first) or [None, ""])[1]
    copyright_ = (re.search(r"(©\s*\d{4},[^.]+\.\s*All rights reserved\.)", first.replace("\n", " ")) or [None, ""])[1]
    toc = (pdf.pages[1].extract_text() or "")
    headings = {m.group(1).strip() for m in re.finditer(r"^(.+?)\s*\.{3,}\s*\d+", toc, re.M)}
    headings = {h for h in headings if "(CU" not in h}

    chunks, section, prev = [], "", None

    def add(heading, text, page, **extra):
        text = text.strip()
        if not text:
            return None
        c = {"id": "", "sheetId": f"cu-{cu}", "sheetTitle": f"{title} (CU {cu})", "issued": issued,
             "section": section, "heading": heading.replace("\n", " ").strip(), "text": text,
             "page": page, "regulations": regs_in(text)}
        c.update(extra)
        chunks.append(c)
        return c

    labels = None
    for pi in range(START_PAGE, len(pdf.pages)):
        page = pdf.pages[pi]
        grid = table_grid(page)
        body_top = TOP
        if grid:
            cols, seps, vedges = grid
            above = cell_text(page, 0, page.width, TOP, seps[0] - 1)
            for ln in above.split("\n"):
                if ln.strip() in headings:
                    section = ln.strip()
            bands = list(zip(seps, seps[1:]))
            for bi, (y0, y1) in enumerate(bands):
                mid = (y0 + y1) / 2
                merged = not any(top <= mid <= bot and any(abs(x - c) <= 8 for c in cols[1:-1])
                                 for x, top, bot in vedges)
                if merged:                    # a cell that spans every column: a heading or a note
                    lines = [l.strip() for l in cell_text(page, cols[0] + 1, cols[-1] - 1, y0 + 1, y1 - 1).split("\n") if l.strip()]
                    keep = []
                    for l in lines:
                        if l in headings:
                            section = l
                        elif "(CU" not in l:
                            keep.append(l)
                    if keep and bi == 0 and prev and prev["page"] == pi and not keep[0].startswith("Note"):
                        prev["text"] += "\n" + unwrap("\n".join(keep))      # row continued from the previous page
                        prev["regulations"] = regs_in(prev["text"])
                    elif keep:
                        head = keep[0] if keep[0].startswith("Does this") else (
                            "Note" if keep[0].startswith("Note") else section)
                        prev = add(head, unwrap("\n".join(keep)), pi + 1)
                    continue
                cells = [unwrap(cell_text(page, a + 1, b - 1, y0 + 1, y1 - 1)) for a, b in zip(cols, cols[1:])]
                if cells[0].split("\n")[0].strip() in HEADER_LABELS:
                    labels = [c.replace("\n", " ") for c in cells]
                    continue
                if not any(cells):
                    continue
                if len(cells) == 2:
                    head, body = cells
                    if not head and prev and prev["page"] <= pi:       # row continued from the previous page
                        prev["text"] += "\n" + body
                        prev["regulations"] = regs_in(prev["text"])
                    else:
                        prev = add(head, body, pi + 1)
                else:
                    head = cells[0] or (prev["heading"] if prev else "")
                    lab = labels or [f"Column {i+1}" for i in range(len(cells))]
                    body = "\n".join(f"{lab[i]}: {c}" for i, c in enumerate(cells) if i > 0 and c)
                    prev = add(head, body, pi + 1)
            body_top = seps[-1] + 1
            tail = cell_text(page, 0, page.width, body_top, page.height - BOTTOM)
        else:
            tail = cell_text(page, 0, page.width, TOP, page.height - BOTTOM)
            prev = None
        # text outside the table: split on table-of-contents headings
        buf, head = [], section
        for ln in tail.split("\n"):
            if ln.strip() in headings:
                if buf:
                    add(head, unwrap("\n".join(buf)), pi + 1)
                section = head = ln.strip(); buf = []
            elif ("(CU" not in ln and not ln.startswith(("Issued:", "©"))
                  and ln.strip() not in ("HIIPS", "HIIPS for Prevention Field Services")):
                buf.append(ln)
        if buf:
            add(head, unwrap("\n".join(buf)), pi + 1)

    merged = []                      # a chunk with no heading continues the one before it
    for c in chunks:
        if not c["heading"] and merged:
            merged[-1]["text"] += "\n" + c["text"]
            merged[-1]["regulations"] = regs_in(merged[-1]["text"])
        else:
            merged.append(c)
    merged = split_questions(merged)
    for c, after in zip(reversed(merged[:-1]), reversed(merged[1:])):  # text before the first heading
        c["section"] = c["section"] or after["section"]
        c["heading"] = c["heading"] or c["section"]
    for i, c in enumerate(merged, 1):
        c["id"] = f"{c['sheetId']}-{i:03d}"
    return {"sheetId": f"cu-{cu}", "title": f"{title} (CU {cu})", "issued": issued,
            "copyright": copyright_, "source": Path(path).name, "chunks": merged}


if __name__ == "__main__":
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    for pdf_path in sorted(src.glob("*.pdf")):
        sheet = parse_sheet(pdf_path)
        out = dst / f"{sheet['sheetId']}.json"
        out.write_text(json.dumps(sheet, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"{pdf_path.name}: {len(sheet['chunks'])} chunks -> {out}")