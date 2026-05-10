# NotebookLM RAG

A Google NotebookLM-style Retrieval-Augmented Generation app. Upload a PDF or plain text file, index it into Qdrant, and chat with grounded answers from the uploaded document.

## Features

- PDF and `.txt` upload
- Page-aware document loading
- Chunking with paragraph grouping, sentence fallback, and overlap
- OpenAI embeddings
- Qdrant vector database storage and similarity retrieval
- OpenAI chat completion using retrieved chunks only
- Source chunks shown beside each answer
- Simple deployable Express web app

## Tech Stack

- Node.js + Express
- Static HTML/CSS/JS frontend
- OpenAI API
- Qdrant vector database
- pdf-parse for PDF extraction

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and add your OpenAI and Qdrant Cloud credentials:

```bash
cp .env.example .env
```

3. Start the app:

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required OpenAI API key |
| `OPENAI_BASE_URL` | LLM API URL, defaults to OpenAI's API endpoint |
| `QDRANT_URL` | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | Qdrant Cloud API key |
| `QDRANT_COLLECTION` | Collection name for document chunks |
| `EMBEDDING_MODEL` | OpenAI embedding model |
| `EMBEDDING_DIMENSIONS` | Qdrant vector size |
| `CHAT_MODEL` | OpenAI chat model |
| `PORT` | Express server port |

## RAG Pipeline

1. **Ingestion**: the user uploads a PDF or text file through the web UI.
2. **Parsing**: PDFs are extracted page-by-page with `pdf-parse`; text files become a single page.
3. **Chunking**: text is normalized, grouped by paragraphs, split by sentences when needed, and overlapped by 180 characters.
4. **Embedding**: each chunk is embedded with OpenAI embeddings.
5. **Storage**: embeddings and chunk metadata are stored in Qdrant.
6. **Retrieval**: user questions are embedded and searched against Qdrant with a document filter.
7. **Generation**: the chat model receives only the retrieved context and must cite chunk numbers.

See [docs/chunking.md](docs/chunking.md) for the chunking strategy.

## Grounding Rule

The system prompt instructs the model to answer only from retrieved document context. If the retrieved chunks do not contain the answer, the assistant must say it cannot find the information in the uploaded document.

## Deployment

The app can be deployed as a single Node web service.

Recommended setup:

1. Create a Qdrant Cloud cluster.
2. Deploy this repository to Render, Railway, Fly.io, or another Node host.
3. Set the environment variables from `.env.example`.
4. Use the deployed app URL as the live project link.

For Render:

- Build command: `npm install`
- Start command: `npm start`
- Add `OPENAI_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, and the model variables in the dashboard.

## Optional Local Qdrant

If you do not want to use Qdrant Cloud during development, run:

```bash
docker compose up -d
```

Then set:

```env
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

## Notes

- `data/documents.json` stores lightweight document metadata for the UI.
- Uploaded files are deleted after indexing; document text lives in Qdrant payloads.
- The app creates a Qdrant keyword payload index for `docId` automatically because Qdrant Cloud requires it for filtered search.
- If you change embedding dimensions or model, use a new Qdrant collection or recreate the collection.
