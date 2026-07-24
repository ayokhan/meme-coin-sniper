/**
 * Extract plain text from uploaded resume files (txt/md/pdf/docx).
 */
export async function extractResumeText(
  buf: Buffer,
  fileName: string,
  mime?: string | null
): Promise<string> {
  const name = (fileName || "").toLowerCase();
  const type = (mime || "").toLowerCase();

  if (type.startsWith("text/") || /\.(txt|md|csv)$/i.test(name)) {
    return buf.toString("utf8").trim();
  }

  if (type.includes("wordprocessingml") || /\.docx$/i.test(name)) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    const text = (result.value || "").replace(/\r\n/g, "\n").trim();
    if (!text) throw new Error("Could not extract text from this Word file.");
    return text;
  }

  if (/\.doc$/i.test(name) && !/\.docx$/i.test(name)) {
    throw new Error("Legacy .doc is not supported. Please upload .docx or PDF.");
  }

  if (type === "application/pdf" || /\.pdf$/i.test(name)) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buf });
    try {
      const result = await parser.getText();
      const text = String(result?.text || "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
      if (!text) throw new Error("Could not extract text from this PDF (it may be image-only).");
      return text;
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }

  throw new Error("Unsupported file type. Use .txt, .md, .pdf, or .docx.");
}
