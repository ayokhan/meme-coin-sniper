/**
 * Export main documentation from Markdown to Word (.docx).
 * Run: node scripts/export-docs-to-word.cjs
 * Output: docs-word/*.docx
 */

const fs = require("fs");
const path = require("path");

const DOCS = [
  { md: "TECH_STACK_AND_APIS.md", docx: "NovaStaris-Tech-Stack-and-APIs.docx" },
  { md: "PRD.md", docx: "NovaStaris-PRD.docx" },
  { md: "GO_TO_MARKET.md", docx: "NovaStaris-Go-to-Market.docx" },
  { md: "JOBS_TO_BE_DONE.md", docx: "NovaStaris-Jobs-to-be-Done.docx" },
  { md: "AUTH_SETUP.md", docx: "NovaStaris-Auth-Setup.docx" },
];

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs-word");

async function main() {
  const { convertMarkdownToDocx } = await import("@mohtasham/md-to-docx");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const { md, docx } of DOCS) {
    const mdPath = path.join(ROOT, md);
    if (!fs.existsSync(mdPath)) {
      console.warn("Skip (not found):", md);
      continue;
    }
    const content = fs.readFileSync(mdPath, "utf8");
    const blob = await convertMarkdownToDocx(content);
    const buffer = Buffer.from(await blob.arrayBuffer());
    const outPath = path.join(OUT_DIR, docx);
    fs.writeFileSync(outPath, buffer);
    console.log("Written:", docx);
  }
  console.log("\nAll Word files are in: docs-word/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
