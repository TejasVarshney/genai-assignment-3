import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import { config, assertRuntimeConfig } from "./config.js";

const qdrant = new QdrantClient({
  url: config.qdrantUrl,
  apiKey: config.qdrantApiKey,
  checkCompatibility: false
});

function getOpenAI() {
  assertRuntimeConfig();
  return new OpenAI({
    baseURL: config.openaiBaseUrl
  });
}

async function ensureCollection() {
  try {
    const collection = await qdrant.getCollection(config.qdrantCollection);
    const vectors = collection?.config?.params?.vectors;
    const vectorSize = vectors?.size || vectors?.default?.size;

    if (vectorSize && vectorSize !== config.embeddingDimensions) {
      throw new Error(
        `Qdrant collection "${config.qdrantCollection}" has vector size ${vectorSize}, but EMBEDDING_DIMENSIONS is ${config.embeddingDimensions}. Use a new collection name or matching dimensions.`
      );
    }
  } catch (error) {
    if (error.status !== 404 && error.code !== 404) throw error;
    await qdrant.createCollection(config.qdrantCollection, {
      vectors: {
        size: config.embeddingDimensions,
        distance: "Cosine"
      }
    });
  }

  await ensurePayloadIndexes();
}

async function ensurePayloadIndexes() {
  try {
    await qdrant.createPayloadIndex(config.qdrantCollection, {
      wait: true,
      field_name: "docId",
      field_schema: "keyword"
    });
  } catch (error) {
    const message = String(error.data?.status?.error || error.message || "").toLowerCase();
    if (!message.includes("already exists") && !message.includes("exists")) {
      throw error;
    }
  }
}

async function embedTexts(texts) {
  const response = await getOpenAI().embeddings.create({
    model: config.embeddingModel,
    dimensions: config.embeddingDimensions,
    input: texts
  });

  return response.data.map((item) => item.embedding);
}

async function embedQuery(query) {
  const [embedding] = await embedTexts([query]);
  return embedding;
}

export async function indexChunks({ docId, fileName, chunks }) {
  await ensureCollection();

  const batchSize = 64;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedTexts(batch.map((chunk) => chunk.text));

    await qdrant.upsert(config.qdrantCollection, {
      wait: true,
      points: batch.map((chunk, batchIndex) => ({
        id: uuidv4(),
        vector: embeddings[batchIndex],
        payload: {
          docId,
          fileName,
          text: chunk.text,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          charCount: chunk.charCount
        }
      }))
    });
  }
}

export async function retrieveChunks({ docId, question, topK = 5 }) {
  await ensureCollection();
  const vector = await embedQuery(question);

  const results = await qdrant.search(config.qdrantCollection, {
    vector,
    limit: topK,
    with_payload: true,
    filter: docId
      ? {
          must: [
            {
              key: "docId",
              match: { value: docId }
            }
          ]
        }
      : undefined
  });

  return results.map((result) => ({
    score: result.score,
    ...result.payload
  }));
}

function buildContext(chunks) {
  return chunks
    .map((chunk, index) => {
      return `[${index + 1}] File: ${chunk.fileName} | Page: ${chunk.pageNumber} | Chunk: ${chunk.chunkIndex + 1}/${chunk.totalChunks}\n${chunk.text}`;
    })
    .join("\n\n---\n\n");
}

export async function answerQuestion({ docId, question, topK }) {
  const chunks = await retrieveChunks({ docId, question, topK });

  if (chunks.length === 0) {
    return {
      answer: "I could not find any relevant document context to answer that question.",
      chunks
    };
  }

  assertRuntimeConfig();
  const context = buildContext(chunks);
  const response = await getOpenAI().chat.completions.create({
    model: config.chatModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a document-grounded RAG assistant. Answer only from the provided context. If the context does not contain the answer, say you cannot find that information in the uploaded document. Do not use outside knowledge. Include brief citations like [1] or [2] for claims that come from context."
      },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${question}`
      }
    ]
  });

  return {
    answer: response.choices[0]?.message?.content?.trim() || "No answer was generated.",
    chunks
  };
}
