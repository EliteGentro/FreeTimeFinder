import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Extracts text from a PDF preserving approximate line breaks based on the
 * vertical (Y) coordinate of each text item. Items on the same baseline are
 * joined with a single space; a vertical change inserts a newline. The
 * downstream parsers normalize whitespace where needed, so this layout-aware
 * output remains compatible with token-level regex matching while also
 * enabling line-based extraction of titles and locations.
 */
export const extractTextFromPDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = null;
    for (const it of content.items) {
      const y = it.transform ? it.transform[5] : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
        text += "\n";
      } else if (text && !text.endsWith("\n")) {
        text += " ";
      }
      text += it.str;
      lastY = y;
    }
    text += "\n";
  }
  return text;
};
