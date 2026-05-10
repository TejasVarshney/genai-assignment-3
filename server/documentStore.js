import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve("data");
const documentsFile = path.join(dataDir, "documents.json");

async function readDocuments() {
  try {
    const raw = await fs.readFile(documentsFile, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeDocuments(documents) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(documentsFile, `${JSON.stringify(documents, null, 2)}\n`);
}

export async function listDocuments() {
  const documents = await readDocuments();
  return documents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function saveDocument(document) {
  const documents = await readDocuments();
  documents.push(document);
  await writeDocuments(documents);
  return document;
}

export async function findDocument(docId) {
  const documents = await readDocuments();
  return documents.find((document) => document.id === docId) || null;
}
