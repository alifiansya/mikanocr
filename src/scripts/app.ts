/**
 * mikanocr — Main Application Entry Point
 * Orchestrates modules: Theme, Toast, PdfViewer, TextExtractor, and ChatManager
 */

import { setupThemeToggle } from "./modules/theme";
import { showToast, showProgress } from "./modules/toast";
import { terminateOcrWorker } from "./modules/ocr";
import { PdfViewer } from "./modules/pdf";
import { TextExtractor } from "./modules/extractor";
import { ChatManager } from "./modules/chat";

// ─── Initialize Core Services ────────────────────────────────────────────────
setupThemeToggle();

const pdfViewer = new PdfViewer();

const extractor = new TextExtractor({
  pdfViewer,
  extractBtnId: "extract-btn",
  copyAllBtnId: "copy-all-btn",
  textDisplayId: "text-display",
  wordCountId: "word-count",
  ocrStatusBarId: "ocr-status-bar",
  ocrStatusTextId: "ocr-status-text",
});

const chatManager = new ChatManager({
  chatMessagesId: "chat-messages",
  chatInputId: "chat-input",
  sendBtnId: "send-btn",
  getDocumentContext: () => extractor.getExtractedText(),
  onOpenExtractTab: () => switchTab("text"),
});

// ─── DOM References ───────────────────────────────────────────────────────────
const uploadZone = document.getElementById("upload-zone")!;
const workspace = document.getElementById("workspace")!;
const dropZone = document.getElementById("drop-zone")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const browseBtn = document.getElementById("browse-btn")!;
const clearBtn = document.getElementById("clear-btn")!;
const headerControls = document.getElementById("header-controls")!;
const docNameEl = document.getElementById("doc-name")!;

const tabText = document.getElementById("tab-text")!;
const tabChat = document.getElementById("tab-chat")!;
const panelText = document.getElementById("panel-text")!;
const panelChat = document.getElementById("panel-chat")!;

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(tab: "text" | "chat") {
  if (tab === "text") {
    tabText.classList.add("active");
    tabChat.classList.remove("active");
    panelText.style.display = "flex";
    panelChat.style.display = "none";
  } else {
    tabChat.classList.add("active");
    tabText.classList.remove("active");
    panelChat.style.display = "flex";
    panelText.style.display = "none";
    chatManager.scrollToBottom();
  }
}

tabText.addEventListener("click", () => switchTab("text"));
tabChat.addEventListener("click", () => switchTab("chat"));

// ─── File Upload & Clearing ───────────────────────────────────────────────────
browseBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) handleFile(file);
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = e.dataTransfer?.files?.[0];
  if (file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf")) {
    handleFile(file);
  } else {
    showToast("Please drop a valid PDF file", "error");
  }
});

clearBtn.addEventListener("click", () => {
  terminateOcrWorker();
  pdfViewer.reset();
  extractor.reset();
  chatManager.reset();

  uploadZone.style.display = "flex";
  workspace.style.display = "none";
  headerControls.style.display = "none";
  fileInput.value = "";
});

async function handleFile(file: File) {
  if (file.size > 50 * 1024 * 1024) {
    showToast("File too large. Maximum size is 50MB.", "error");
    return;
  }

  showProgress(true);
  extractor.reset();
  chatManager.reset();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const totalPages = await pdfViewer.loadDocument(arrayBuffer, file.name);

    uploadZone.style.display = "none";
    workspace.style.display = "flex";
    workspace.style.flexDirection = "column";
    headerControls.style.display = "flex";
    docNameEl.textContent = file.name;

    showToast(`Loaded "${file.name}" (${totalPages} ${totalPages === 1 ? "page" : "pages"})`, "success");
  } catch (err) {
    console.error("PDF load error:", err);
    showToast("Failed to parse PDF document.", "error");
  } finally {
    showProgress(false);
  }
}

// ─── Inject Keyframe Helpers ──────────────────────────────────────────────────
const spinStyle = document.createElement("style");
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);
