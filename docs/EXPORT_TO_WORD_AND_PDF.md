# Exporting Patent Docs to Word and PDF on Your Local Machine

All patent-related docs are in the `docs/` folder. Use one of the methods below to get **Word (.docx)** and **PDF** on your computer.

---

## Files to Export

| Source file | Use for |
|-------------|--------|
| `docs/PATENT_APPLICATION_SUPPORT.md` | Main patent answers + technical summary → Word & PDF |
| `docs/NOVASTARIS_ARCHITECTURE.md` | Architecture only (separate) → Word & PDF |

---

## Method 1: Cursor / VS Code (Markdown to PDF)

1. Install the **Markdown PDF** extension (e.g. "Markdown PDF" by yzane).
2. Open the `.md` file (e.g. `PATENT_APPLICATION_SUPPORT.md`).
3. Right-click in the editor → **Markdown PDF: Export (pdf)**.
4. PDF is saved in the same folder (or choose a folder when prompted).
5. Repeat for `NOVASTARIS_ARCHITECTURE.md`.

**Word:** Open the generated PDF in Microsoft Word (File → Open) and save as `.docx`, or use Method 2 for direct Word output.

---

## Method 2: Pandoc (command line — Word and PDF)

If you have [Pandoc](https://pandoc.org/) installed:

```bash
cd "c:\Users\ayokh\meme-coin-sniper\docs"

# Patent support → Word
pandoc PATENT_APPLICATION_SUPPORT.md -o PATENT_APPLICATION_SUPPORT.docx

# Patent support → PDF (requires a LaTeX engine or --pdf-engine)
pandoc PATENT_APPLICATION_SUPPORT.md -o PATENT_APPLICATION_SUPPORT.pdf

# Architecture → Word
pandoc NOVASTARIS_ARCHITECTURE.md -o NOVASTARIS_ARCHITECTURE.docx

# Architecture → PDF
pandoc NOVASTARIS_ARCHITECTURE.md -o NOVASTARIS_ARCHITECTURE.pdf
```

Output files appear in `docs/`. Move them to your Desktop or Downloads if you prefer.

---

## Method 3: Copy into Microsoft Word

1. Open `PATENT_APPLICATION_SUPPORT.md` in Cursor (or any text editor).
2. Select All (Ctrl+A) and Copy (Ctrl+C).
3. Open Microsoft Word → New document → Paste (Ctrl+V).
4. Adjust formatting if needed (headings, lists).
5. **Save as:** `PATENT_APPLICATION_SUPPORT.docx`.
6. **Export as PDF:** File → Save As → choose **PDF**.
7. Repeat for `NOVASTARIS_ARCHITECTURE.md` → `NOVASTARIS_ARCHITECTURE.docx` and `.pdf`.

---

## Where Files Are on Your Machine

- **Markdown sources:**  
  `c:\Users\ayokh\meme-coin-sniper\docs\`
  - `PATENT_APPLICATION_SUPPORT.md`
  - `NOVASTARIS_ARCHITECTURE.md`

- **After export:**  
  Word and PDF files will be where you save them (e.g. same `docs/` folder, or Desktop/Downloads if you choose that path).

---

## Quick Checklist

- [ ] Export `PATENT_APPLICATION_SUPPORT.md` → **Word** and **PDF**
- [ ] Export `NOVASTARIS_ARCHITECTURE.md` → **Word** and **PDF** (separate)
- [ ] Save/copy the exported files to the folder you use for the patent (e.g. Desktop or a “Patent” folder)
