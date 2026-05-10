import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import multer from "multer";
import { config } from "./config.js";
import { chunkTextByPage } from "./chunking.js";
import { loadUploadedDocument } from "./documentLoader.js";
import { answerQuestion, indexChunks } from "./rag.js";
import { findDocument, listDocuments, saveDocument } from "./documentStore.js";

const app = express();
const uploadDir = path.resolve("uploads");

await fs.mkdir(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (_req, file, callback) => {
    const name = file.originalname.toLowerCase();
    const supported =
      file.mimetype === "application/pdf" ||
      file.mimetype?.startsWith("text/") ||
      name.endsWith(".pdf") ||
      name.endsWith(".txt");

    callback(supported ? null : new Error("Only PDF and plain text files are supported."), supported);
  }
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.resolve("public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "NotebookLM RAG" });
});

app.get("/api/documents", async (_req, res, next) => {
  try {
    res.json({ documents: await listDocuments() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/upload", upload.single("document"), async (req, res, next) => {
  const file = req.file;

  try {
    if (!file) {
      res.status(400).json({ error: "Upload a PDF or plain text document." });
      return;
    }

    const pageDocs = await loadUploadedDocument(file);
    const chunks = chunkTextByPage(pageDocs);

    if (chunks.length === 0) {
      res.status(400).json({ error: "The document did not contain readable text." });
      return;
    }

    const document = {
      id: randomUUID(),
      fileName: file.originalname,
      mimeType: file.mimetype,
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

    await saveDocument(document);

    res.status(201).json({ document });
  } catch (error) {
    next(error);
  } finally {
    if (file?.path) {
      await fs.rm(file.path, { force: true });
    }
  }
});

app.post("/api/ask", async (req, res, next) => {
  try {
    const question = String(req.body.question || "").trim();
    const docId = String(req.body.docId || "").trim();
    const topK = Math.min(Number(req.body.topK || 5), 10);

    if (!question) {
      res.status(400).json({ error: "Question is required." });
      return;
    }

    if (!docId) {
      res.status(400).json({ error: "Select an indexed document first." });
      return;
    }

    const document = await findDocument(docId);
    if (!document) {
      res.status(404).json({ error: "Document was not found in this app instance." });
      return;
    }

    const result = await answerQuestion({ docId, question, topK });
    res.json({
      answer: result.answer,
      sources: result.chunks.map((chunk, index) => ({
        id: index + 1,
        score: chunk.score,
        fileName: chunk.fileName,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text
      }))
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || error.statusCode || 500;
  res.status(status).json({
    error: error.message || "Something went wrong while processing the request."
  });
});

app.listen(config.port, () => {
  console.log(`NotebookLM RAG running on http://localhost:${config.port}`);
});
