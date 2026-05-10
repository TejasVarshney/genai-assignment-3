# Chunking Strategy

This app uses a page-aware paragraph chunking strategy.

## Why This Strategy

Uploaded documents often have meaningful paragraph boundaries, while PDFs also need page numbers for citations. The chunker preserves page metadata and keeps chunks readable enough for the LLM to answer with grounded citations.

## Algorithm

1. Load the document into page-level text units.
2. Normalize whitespace.
3. Split each page into paragraphs.
4. Accumulate paragraphs until the chunk reaches about 1100 characters.
5. If a paragraph is too large, split it by sentence.
6. If a sentence is still too large, hard-split by character length.
7. Add a 180-character overlap from the previous chunk on the same page.
8. Store `pageNumber`, `chunkIndex`, `totalChunks`, and `charCount` with every chunk.

## Parameters

| Parameter | Value |
| --- | --- |
| Target chunk size | 1100 characters |
| Overlap | 180 characters |
| Retrieval top K | 5 by default |

The overlap helps preserve context across chunk boundaries without making chunks so large that retrieval becomes noisy.
