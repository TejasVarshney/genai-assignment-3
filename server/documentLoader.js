import fs from "node:fs/promises";
import pdfParse from "pdf-parse";

function isPdf(file) {
  return file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
}

function isText(file) {
  return file.mimetype?.startsWith("text/") || file.originalname.toLowerCase().endsWith(".txt");
}

export async function loadUploadedDocument(file) {
  if (isPdf(file)) {
    return loadDocumentFromBuffer({
      buffer: await fs.readFile(file.path),
      mimeType: file.mimetype,
      fileName: file.originalname
    });
  }

  if (isText(file)) {
    const text = await fs.readFile(file.path, "utf8");
    return [{ text, pageNumber: 1 }];
  }

  throw new Error("Unsupported file type. Upload a PDF or plain text file.");
}

export async function loadDocumentFromBuffer({ buffer, mimeType, fileName }) {
  const lowerName = fileName.toLowerCase();

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    const pages = [];

    await pdfParse(buffer, {
      pagerender: async (pageData) => {
        const textContent = await pageData.getTextContent({
          normalizeWhitespace: true,
          disableCombineTextItems: false
        });
        const pageText = textContent.items.map((item) => item.str).join(" ");
        pages.push(pageText);
        return pageText;
      }
    });

    return pages.map((text, index) => ({
      text,
      pageNumber: index + 1
    }));
  }

  if (mimeType?.startsWith("text/") || lowerName.endsWith(".txt")) {
    return [{ text: buffer.toString("utf8"), pageNumber: 1 }];
  }

  throw new Error("Unsupported file type. Upload a PDF or plain text file.");
}
