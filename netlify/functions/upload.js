import Busboy from "busboy";
import { v4 as uuidv4 } from "uuid";
import { chunkTextByPage } from "../../server/chunking.js";
import { loadDocumentFromBuffer } from "../../server/documentLoader.js";
import { indexChunks } from "../../server/rag.js";
import { errorResponse, json } from "./_utils.js";

function parseMultipart(event) {
  return new Promise((resolve, reject) => {
    const contentType = event.headers["content-type"] || event.headers["Content-Type"];
    if (!contentType) {
      reject(new Error("Missing content type."));
      return;
    }

    const busboy = Busboy({ headers: { "content-type": contentType } });
    let uploadedFile = null;

    busboy.on("file", (_fieldName, file, info) => {
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("limit", () => reject(new Error("Uploaded file is too large.")));
      file.on("end", () => {
        uploadedFile = {
          buffer: Buffer.concat(chunks),
          fileName: info.filename,
          mimeType: info.mimeType
        };
      });
    });

    busboy.on("error", reject);
    busboy.on("finish", () => {
      if (!uploadedFile) {
        reject(new Error("Upload a PDF or plain text document."));
        return;
      }
      resolve(uploadedFile);
    });

    const body = event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : Buffer.from(event.body || "");
    busboy.end(body);
  });
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const file = await parseMultipart(event);
    const pageDocs = await loadDocumentFromBuffer(file);
    const chunks = chunkTextByPage(pageDocs);

    if (chunks.length === 0) {
      return json(400, { error: "The document did not contain readable text." });
    }

    const document = {
      id: uuidv4(),
      fileName: file.fileName,
      mimeType: file.mimeType,
      createdAt: new Date().toISOString(),
      pageCount: pageDocs.length,
      chunkCount: chunks.length,
      chunking: {
        strategy: "Page-aware paragraph chunks with sentence fallback and 180-character overlap",
        chunkSize: 1100,
        overlap: 180
      }
    };

    await indexChunks({
      docId: document.id,
      fileName: document.fileName,
      chunks
    });

    return json(201, { document });
  } catch (error) {
    return errorResponse(error);
  }
}
