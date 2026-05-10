import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 3000),
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  qdrantUrl: process.env.QDRANT_URL || "http://localhost:6333",
  qdrantApiKey: process.env.QDRANT_API_KEY || undefined,
  qdrantCollection: process.env.QDRANT_COLLECTION || "notebooklm_documents",
  embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  embeddingDimensions: Number(process.env.EMBEDDING_DIMENSIONS || 1536),
  chatModel: process.env.CHAT_MODEL || "gpt-4.1-mini",
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024)
};

export function assertRuntimeConfig() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is missing. Add it to .env or your deployment environment.");
  }
}
