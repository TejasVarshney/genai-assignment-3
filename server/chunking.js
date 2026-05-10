const DEFAULT_CHUNK_SIZE = 1100;
const DEFAULT_CHUNK_OVERLAP = 180;

function normalizeText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLongText(text, chunkSize) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    const next = `${current} ${sentence}`.trim();
    if (next.length <= chunkSize) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);

    if (sentence.length > chunkSize) {
      for (let i = 0; i < sentence.length; i += chunkSize) {
        chunks.push(sentence.slice(i, i + chunkSize).trim());
      }
      current = "";
    } else {
      current = sentence.trim();
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function withOverlap(chunks, overlap) {
  return chunks.map((chunk, index) => {
    if (index === 0) return chunk;
    const previous = chunks[index - 1];
    const prefix = previous.slice(Math.max(0, previous.length - overlap));
    return `${prefix}\n\n${chunk}`;
  });
}

export function chunkTextByPage(pageDocs, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap || DEFAULT_CHUNK_OVERLAP;
  const chunks = [];

  for (const pageDoc of pageDocs) {
    const pageNumber = pageDoc.pageNumber || 1;
    const text = normalizeText(pageDoc.text || "");
    if (!text) continue;

    const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    const pageChunks = [];
    let current = "";

    for (const paragraph of paragraphs) {
      const pieces = paragraph.length > chunkSize ? splitLongText(paragraph, chunkSize) : [paragraph];

      for (const piece of pieces) {
        const next = `${current}\n\n${piece}`.trim();
        if (next.length <= chunkSize) {
          current = next;
        } else {
          if (current) pageChunks.push(current);
          current = piece;
        }
      }
    }

    if (current) pageChunks.push(current);

    for (const textChunk of withOverlap(pageChunks, overlap)) {
      chunks.push({
        text: textChunk,
        pageNumber,
        charCount: textChunk.length
      });
    }
  }

  return chunks.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
    totalChunks: chunks.length
  }));
}
