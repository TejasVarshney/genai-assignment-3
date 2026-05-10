import { json } from "./_utils.js";

export async function handler() {
  return json(200, { ok: true, service: "NotebookLM RAG" });
}
