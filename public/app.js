const uploadForm = document.querySelector("#uploadForm");
const documentInput = document.querySelector("#documentInput");
const uploadStatus = document.querySelector("#uploadStatus");
const documentList = document.querySelector("#documentList");
const refreshDocuments = document.querySelector("#refreshDocuments");
const selectedDocumentName = document.querySelector("#selectedDocumentName");
const selectedDocumentMeta = document.querySelector("#selectedDocumentMeta");
const questionForm = document.querySelector("#questionForm");
const questionInput = document.querySelector("#questionInput");
const messages = document.querySelector("#messages");
const sourcesList = document.querySelector("#sourcesList");
const sourceCount = document.querySelector("#sourceCount");
const serviceStatus = document.querySelector("#serviceStatus");

let documents = [];
let selectedDocId = "";

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function appendMessage(role, text) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(paragraph);
  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
  return article;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function selectDocument(docId) {
  selectedDocId = docId;
  const document = documents.find((item) => item.id === docId);

  if (!document) {
    selectedDocumentName.textContent = "No document selected";
    selectedDocumentMeta.textContent = "0 chunks";
    return;
  }

  selectedDocumentName.textContent = document.fileName;
  selectedDocumentMeta.textContent = `${document.chunkCount} chunks`;
  renderDocuments();
}

function renderDocuments() {
  documentList.innerHTML = "";

  if (documents.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No indexed documents yet.";
    documentList.append(empty);
    return;
  }

  for (const doc of documents) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `document-item ${doc.id === selectedDocId ? "active" : ""}`;
    button.addEventListener("click", () => selectDocument(doc.id));

    const name = document.createElement("span");
    name.className = "document-name";
    name.textContent = doc.fileName;

    const meta = document.createElement("span");
    meta.className = "document-meta";
    meta.textContent = `${doc.pageCount} page${doc.pageCount === 1 ? "" : "s"} · ${doc.chunkCount} chunks · ${formatDate(doc.createdAt)}`;

    button.append(name, meta);
    documentList.append(button);
  }
}

function renderSources(sources) {
  sourcesList.innerHTML = "";
  sourceCount.textContent = String(sources.length);

  if (sources.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No sources retrieved.";
    sourcesList.append(empty);
    return;
  }

  for (const source of sources) {
    const item = document.createElement("article");
    item.className = "source-item";

    const meta = document.createElement("div");
    meta.className = "source-meta";
    const score = typeof source.score === "number" ? source.score.toFixed(3) : "n/a";
    meta.textContent = `[${source.id}] Page ${source.pageNumber} · Chunk ${source.chunkIndex + 1} · Score ${score}`;

    const text = document.createElement("p");
    text.textContent = source.text;

    item.append(meta, text);
    sourcesList.append(item);
  }
}

async function loadDocuments() {
  const response = await fetch("/api/documents");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load documents.");

  documents = data.documents;
  if (!selectedDocId && documents[0]) {
    selectedDocId = documents[0].id;
  }
  renderDocuments();
  selectDocument(selectedDocId);
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    serviceStatus.textContent = response.ok ? "Ready" : "Service unavailable";
    serviceStatus.classList.toggle("error", !response.ok);
  } catch {
    serviceStatus.textContent = "Service unavailable";
    serviceStatus.classList.add("error");
  }
}

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = documentInput.files[0];
  if (!file) {
    setStatus(uploadStatus, "Choose a PDF or text file first.", true);
    return;
  }

  const submitButton = uploadForm.querySelector("button");
  submitButton.disabled = true;
  setStatus(uploadStatus, "Indexing document...");

  try {
    const body = new FormData();
    body.append("document", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Upload failed.");

    setStatus(uploadStatus, `Indexed ${data.document.chunkCount} chunks.`);
    documentInput.value = "";
    await loadDocuments();
    selectDocument(data.document.id);
  } catch (error) {
    setStatus(uploadStatus, error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const question = questionInput.value.trim();
  if (!question) return;

  if (!selectedDocId) {
    appendMessage("assistant", "Select or upload a document before asking.");
    return;
  }

  appendMessage("user", question);
  questionInput.value = "";
  const loading = appendMessage("assistant", "Retrieving document chunks...");
  const submitButton = questionForm.querySelector("button");
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: selectedDocId, question, topK: 5 })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Question failed.");

    loading.querySelector("p").textContent = data.answer;
    renderSources(data.sources);
  } catch (error) {
    loading.querySelector("p").textContent = error.message;
    loading.classList.add("error");
  } finally {
    submitButton.disabled = false;
    questionInput.focus();
  }
});

refreshDocuments.addEventListener("click", () => {
  loadDocuments().catch((error) => setStatus(uploadStatus, error.message, true));
});

renderSources([]);
await checkHealth();
await loadDocuments();
