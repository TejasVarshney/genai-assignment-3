import { answerQuestion } from "../../server/rag.js";
import { errorResponse, json } from "./_utils.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const question = String(body.question || "").trim();
    const docId = String(body.docId || "").trim();
    const topK = Math.min(Number(body.topK || 5), 10);

    if (!question) return json(400, { error: "Question is required." });
    if (!docId) return json(400, { error: "Select an indexed document first." });

    const result = await answerQuestion({ docId, question, topK });
    return json(200, {
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
    return errorResponse(error);
  }
}
