/**
 * mikanocr — Main Client Script
 * Handles: PDF rendering, robust Tesseract OCR overlay, text selection/copying, full text extraction, Gemini AI chat & Theme toggle
 */

import * as pdfjsLib from "pdfjs-dist";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as TesseractNS from "tesseract.js";

// CJS interop: Vite may expose the module as default or as named exports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _tesseract = (TesseractNS as any).default ?? TesseractNS;
const createWorker: typeof TesseractNS.createWorker = _tesseract.createWorker;

// ─── PDF.js worker setup ─────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ─── Types ────────────────────────────────────────────────────────────────────
interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

interface PageOcrData {
  words: OcrWord[];
  fullText: string;
}

interface ChatMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

// ─── State ────────────────────────────────────────────────────────────────────
let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
let currentPage = 1;
let totalPages = 0;
const scale = 1.5;
let ocrOverlayEnabled = false;
let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
const pageOcrCache: Map<number, PageOcrData> = new Map();
let extractedFullText = "";
let chatHistory: ChatMessage[] = [];
let isOcrRunning = false;
let isChatLoading = false;

// ─── DOM References ───────────────────────────────────────────────────────────
const uploadZone = document.getElementById("upload-zone")!;
const workspace = document.getElementById("workspace")!;
const dropZone = document.getElementById("drop-zone")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const browseBtn = document.getElementById("browse-btn")!;
const clearBtn = document.getElementById("clear-btn")!;
const headerControls = document.getElementById("header-controls")!;
const docNameEl = document.getElementById("doc-name")!;

const canvasContainer = document.getElementById("canvas-container")!;
const pageInfo = document.getElementById("page-info")!;
const prevPageBtn = document.getElementById("prev-page")!;
const nextPageBtn = document.getElementById("next-page")!;
const ocrToggleBtn = document.getElementById("ocr-toggle-btn")!;
const ocrToggle = document.getElementById("ocr-toggle") as HTMLInputElement;
const ocrTrack = document.getElementById("ocr-track")!;
const ocrStatusBar = document.getElementById("ocr-status-bar")!;
const ocrStatusText = document.getElementById("ocr-status-text")!;
const globalProgress = document.getElementById("global-progress")!;

const tabText = document.getElementById("tab-text")!;
const tabChat = document.getElementById("tab-chat")!;
const panelText = document.getElementById("panel-text")!;
const panelChat = document.getElementById("panel-chat")!;

const extractBtn = document.getElementById("extract-btn")!;
const copyAllBtn = document.getElementById("copy-all-btn")!;
const textDisplay = document.getElementById("text-display")!;
const wordCountEl = document.getElementById("word-count")!;

const chatMessages = document.getElementById("chat-messages")!;
const chatInput = document.getElementById("chat-input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn")!;

const themeToggleBtn = document.getElementById("theme-toggle-btn")!;
const themeIconMoon = document.getElementById("theme-icon-moon")!;
const themeIconSun = document.getElementById("theme-icon-sun")!;

// ─── Dark Mode Toggle Logic ───────────────────────────────────────────────────
function initTheme() {
  const isLight = document.documentElement.classList.contains("light");
  updateThemeIcons(isLight);
}

function updateThemeIcons(isLight: boolean) {
  if (isLight) {
    themeIconMoon.style.display = "inline-block";
    themeIconSun.style.display = "none";
  } else {
    themeIconMoon.style.display = "none";
    themeIconSun.style.display = "inline-block";
  }
}

function toggleTheme() {
  const isLight = document.documentElement.classList.contains("light");
  if (isLight) {
    document.documentElement.classList.remove("light");
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
    updateThemeIcons(false);
  } else {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    localStorage.setItem("theme", "light");
    updateThemeIcons(true);
  }
}

themeToggleBtn?.addEventListener("click", toggleTheme);
initTheme();

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(
  message: string,
  type: "success" | "error" | "info" = "info",
  duration = 3200
) {
  const icons = {
    success: "✓",
    error: "✕",
    info: "ℹ",
  };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-size: 14px; font-weight: bold;">${icons[type]}</span> ${message}`;
  document.getElementById("toast-container")!.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Tab switching ────────────────────────────────────────────────────────────
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
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

tabText.addEventListener("click", () => switchTab("text"));
tabChat.addEventListener("click", () => switchTab("chat"));

// ─── File handling ────────────────────────────────────────────────────────────
browseBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) loadPDF(file);
});

// Drag and drop on dropZone
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
    loadPDF(file);
  } else {
    showToast("Please drop a valid PDF file", "error");
  }
});

clearBtn.addEventListener("click", clearAll);

// ─── Load PDF ─────────────────────────────────────────────────────────────────
async function loadPDF(file: File) {
  if (file.size > 50 * 1024 * 1024) {
    showToast("File too large. Maximum size is 50MB.", "error");
    return;
  }

  showProgress(true);
  resetState();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    pdfDoc = await loadingTask.promise;
    totalPages = pdfDoc.numPages;

    uploadZone.style.display = "none";
    workspace.style.display = "flex";
    workspace.style.flexDirection = "column";
    headerControls.style.display = "flex";
    docNameEl.textContent = file.name;

    showToast(`Loaded "${file.name}" (${totalPages} ${totalPages === 1 ? "page" : "pages"})`, "success");
    await renderPage(currentPage);
    updatePageInfo();
  } catch (err) {
    console.error("PDF load error:", err);
    showToast("Failed to parse PDF document.", "error");
  } finally {
    showProgress(false);
  }
}

function resetState() {
  currentPage = 1;
  totalPages = 0;
  pageOcrCache.clear();
  extractedFullText = "";
  chatHistory = [];
  isOcrRunning = false;
  ocrOverlayEnabled = false;
  ocrTrack.classList.remove("on");
  ocrToggle.checked = false;
  canvasContainer.innerHTML = "";
  textDisplay.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; gap: 12px; color: var(--color-text-muted);">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4;">
        <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="13" y1="18" x2="3" y2="18"/>
      </svg>
      <p style="font-size: 13px; margin: 0;">Click "Extract Full Text" to process the PDF</p>
    </div>
  `;
  copyAllBtn.style.display = "none";
  wordCountEl.textContent = "";
}

function clearAll() {
  if (ocrWorker) {
    ocrWorker.terminate();
    ocrWorker = null;
  }
  pdfDoc = null;
  uploadZone.style.display = "flex";
  workspace.style.display = "none";
  headerControls.style.display = "none";
  fileInput.value = "";
  resetState();
  chatMessages.innerHTML = `
    <div class="chat-message" style="display: flex; gap: 10px; align-items: flex-start;">
      <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #f97316, #ea580c); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; color: white;">🍊</div>
      <div style="background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; max-width: 480px;">
        Hi! I'm your mikanocr AI assistant powered by Gemini. Upload a PDF, extract its text, and ask me any questions about the document!
      </div>
    </div>
  `;
}

// ─── PDF Rendering ────────────────────────────────────────────────────────────
async function renderPage(pageNum: number) {
  if (!pdfDoc) return;

  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  // Wrapper for canvas and overlay
  const pageWrapper = document.createElement("div");
  pageWrapper.id = `page-wrapper-${pageNum}`;
  pageWrapper.style.cssText = `
    position: relative;
    width: ${viewport.width}px;
    height: ${viewport.height}px;
    box-shadow: 0 6px 28px rgba(0,0,0,0.25);
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
    background: #ffffff;
  `;

  // Canvas
  const canvas = document.createElement("canvas");
  canvas.id = `pdf-canvas-${pageNum}`;
  const ctx = canvas.getContext("2d")!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.display = "block";
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  pageWrapper.appendChild(canvas);

  // OCR overlay container
  const ocrOverlay = document.createElement("div");
  ocrOverlay.id = `ocr-overlay-${pageNum}`;
  ocrOverlay.className = "ocr-overlay-container";
  ocrOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: ${viewport.width}px;
    height: ${viewport.height}px;
    pointer-events: ${ocrOverlayEnabled ? "auto" : "none"};
    display: ${ocrOverlayEnabled ? "block" : "none"};
    z-index: 10;
  `;
  pageWrapper.appendChild(ocrOverlay);

  canvasContainer.appendChild(pageWrapper);

  // Render PDF page onto canvas
  await page.render({ canvasContext: ctx, viewport }).promise;

  // If overlay is enabled, execute or display OCR
  if (ocrOverlayEnabled) {
    if (pageOcrCache.has(pageNum)) {
      renderOcrOverlay(ocrOverlay, pageOcrCache.get(pageNum)!);
    } else {
      await runOcrOnPage(pageNum, canvas, ocrOverlay);
    }
  }
}

// ─── Page Navigation ──────────────────────────────────────────────────────────
function updatePageInfo() {
  pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
  prevPageBtn.toggleAttribute("disabled", currentPage <= 1);
  nextPageBtn.toggleAttribute("disabled", currentPage >= totalPages);
}

prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    canvasContainer.innerHTML = "";
    renderPage(currentPage).then(updatePageInfo);
  }
});

nextPageBtn.addEventListener("click", () => {
  if (pdfDoc && currentPage < totalPages) {
    currentPage++;
    canvasContainer.innerHTML = "";
    renderPage(currentPage).then(updatePageInfo);
  }
});

// ─── OCR Toggle ───────────────────────────────────────────────────────────────
async function handleOcrToggle() {
  if (!pdfDoc) {
    showToast("Please upload a PDF first", "info");
    return;
  }

  ocrOverlayEnabled = !ocrOverlayEnabled;
  ocrToggle.checked = ocrOverlayEnabled;
  ocrTrack.classList.toggle("on", ocrOverlayEnabled);

  const overlay = document.getElementById(`ocr-overlay-${currentPage}`);
  const canvas = document.getElementById(`pdf-canvas-${currentPage}`) as HTMLCanvasElement | null;

  if (!overlay || !canvas) return;

  if (ocrOverlayEnabled) {
    overlay.style.display = "block";
    overlay.style.pointerEvents = "auto";

    if (!pageOcrCache.has(currentPage)) {
      await runOcrOnPage(currentPage, canvas, overlay);
    } else {
      renderOcrOverlay(overlay, pageOcrCache.get(currentPage)!);
    }
  } else {
    overlay.style.display = "none";
    overlay.style.pointerEvents = "none";
  }
}

ocrToggleBtn.addEventListener("click", handleOcrToggle);

// ─── Tesseract Worker Setup ───────────────────────────────────────────────────
async function getOcrWorker() {
  if (!ocrWorker) {
    ocrWorker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && m.progress !== undefined) {
          const pct = Math.round(m.progress * 100);
          ocrStatusText.textContent = `Recognizing text: ${pct}%`;
        } else if (m.status) {
          ocrStatusText.textContent = `${m.status}...`;
        }
      },
    });
  }
  return ocrWorker;
}

// Helper to extract words from TSV string as fallback
function parseWordsFromTSV(tsvText: string): OcrWord[] {
  const words: OcrWord[] = [];
  if (!tsvText) return words;

  const lines = tsvText.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const parts = line.split("\t");
    // format: level, page_num, block_num, par_num, line_num, word_num, left, top, width, height, conf, text
    if (parts.length >= 12) {
      const left = parseInt(parts[6] ?? "0", 10);
      const top = parseInt(parts[7] ?? "0", 10);
      const width = parseInt(parts[8] ?? "0", 10);
      const height = parseInt(parts[9] ?? "0", 10);
      const conf = parseFloat(parts[10] ?? "0");
      const text = parts[11]?.trim() ?? "";

      if (text && conf > 0 && width > 0 && height > 0) {
        words.push({
          text,
          confidence: conf,
          bbox: {
            x0: left,
            y0: top,
            x1: left + width,
            y1: top + height,
          },
        });
      }
    }
  }
  return words;
}

// Helper to extract words from Tesseract blocks structure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractWordsFromBlocks(blocks: any[]): OcrWord[] {
  const words: OcrWord[] = [];
  if (!Array.isArray(blocks)) return words;

  for (const block of blocks) {
    if (!block.paragraphs) continue;
    for (const paragraph of block.paragraphs) {
      if (!paragraph.lines) continue;
      for (const line of paragraph.lines) {
        if (!line.words) continue;
        for (const w of line.words) {
          if (w.text?.trim() && w.bbox) {
            words.push({
              text: w.text,
              bbox: w.bbox,
              confidence: w.confidence ?? 80,
            });
          }
        }
      }
    }
  }
  return words;
}

// ─── Run OCR On Page ──────────────────────────────────────────────────────────
async function runOcrOnPage(
  pageNum: number,
  canvas: HTMLCanvasElement,
  overlay: HTMLElement
): Promise<PageOcrData> {
  if (pageOcrCache.has(pageNum)) {
    const cached = pageOcrCache.get(pageNum)!;
    renderOcrOverlay(overlay, cached);
    return cached;
  }

  if (isOcrRunning) {
    showToast("OCR is currently running, please wait...", "info");
    return { words: [], fullText: "" };
  }

  isOcrRunning = true;
  ocrStatusBar.style.display = "block";
  ocrStatusText.textContent = "Initializing OCR engine...";

  try {
    const worker = await getOcrWorker();
    const imageData = canvas.toDataURL("image/png");

    // Request full data formats from Tesseract
    const result = await worker.recognize(
      imageData,
      {},
      { text: true, blocks: true, tsv: true }
    );

    // Extract word-level bounding boxes from blocks or TSV fallback
    let words: OcrWord[] = [];
    if (result.data.blocks && result.data.blocks.length > 0) {
      words = extractWordsFromBlocks(result.data.blocks);
    }

    if (words.length === 0 && result.data.tsv) {
      words = parseWordsFromTSV(result.data.tsv);
    }

    const fullText = (result.data.text ?? "").trim();

    const ocrData: PageOcrData = {
      words,
      fullText,
    };

    pageOcrCache.set(pageNum, ocrData);
    renderOcrOverlay(overlay, ocrData);

    if (words.length > 0) {
      showToast(`Detected ${words.length} selectable text regions on page ${pageNum}`, "success");
    } else {
      showToast(`No distinct text recognized on page ${pageNum}`, "info");
    }

    return ocrData;
  } catch (err) {
    console.error("OCR execution error:", err);
    showToast("OCR processing failed for this page.", "error");
    return { words: [], fullText: "" };
  } finally {
    isOcrRunning = false;
    ocrStatusBar.style.display = "none";
  }
}

// ─── Render Interactive Selectable OCR Overlay ────────────────────────────────
function renderOcrOverlay(overlay: HTMLElement, ocrData: PageOcrData) {
  overlay.innerHTML = "";

  if (ocrData.words.length === 0) {
    overlay.innerHTML = `
      <div style="position: absolute; top: 12px; right: 12px; padding: 6px 12px; background: rgba(0,0,0,0.6); color: white; border-radius: 6px; font-size: 11px; pointer-events: none;">
        No text detected on this page
      </div>
    `;
    return;
  }

  for (const word of ocrData.words) {
    const text = word.text.trim();
    if (!text) continue;

    const boxWidth = word.bbox.x1 - word.bbox.x0;
    const boxHeight = word.bbox.y1 - word.bbox.y0;

    if (boxWidth <= 0 || boxHeight <= 0) continue;

    const box = document.createElement("div");
    box.className = "ocr-word-box";
    box.title = `"${text}" (Click to copy · Drag to select)`;

    box.style.left = `${word.bbox.x0}px`;
    box.style.top = `${word.bbox.y0}px`;
    box.style.width = `${boxWidth}px`;
    box.style.height = `${boxHeight}px`;

    // Invisible text element inside for native drag selection & copy
    const textSpan = document.createElement("span");
    textSpan.className = "ocr-word-text";
    textSpan.textContent = text;
    textSpan.style.fontSize = `${Math.max(10, Math.floor(boxHeight * 0.85))}px`;
    textSpan.style.lineHeight = `${boxHeight}px`;

    box.appendChild(textSpan);

    // Single click copies that word and toggles highlight
    box.addEventListener("click", (e) => {
      // If user was making a text selection, do not trigger single click
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) return;

      e.stopPropagation();
      navigator.clipboard.writeText(text);
      box.classList.add("selected");
      showToast(`Copied: "${text}"`, "success", 1500);
      setTimeout(() => {
        box.classList.remove("selected");
      }, 1000);
    });

    overlay.appendChild(box);
  }
}

// ─── Full Text Extraction ─────────────────────────────────────────────────────
extractBtn.addEventListener("click", extractFullText);

async function extractFullText() {
  if (!pdfDoc) {
    showToast("Please upload a PDF first", "info");
    return;
  }

  extractBtn.setAttribute("disabled", "true");
  extractBtn.innerHTML = `
    <div style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite;"></div>
    Extracting...
  `;

  showProgress(true);
  textDisplay.innerHTML =
    '<div style="color: var(--color-text-muted); font-size: 13px; padding: 8px;">Extracting document text across all pages...</div>';

  const allTextParts: string[] = [];
  let usedOcr = 0;

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      ocrStatusText.textContent = `Processing page ${pageNum} / ${totalPages}...`;
      ocrStatusBar.style.display = "block";

      const page = await pdfDoc.getPage(pageNum);

      // 1. Try native PDF text layer first
      const textContent = await page.getTextContent();
      const nativeText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (nativeText.length > 20) {
        // High quality native digital text
        allTextParts.push(`--- Page ${pageNum} ---\n${nativeText}`);
      } else {
        // Scanned or image-only page: execute OCR
        usedOcr++;
        const viewport = page.getViewport({ scale });

        const offCanvas = document.createElement("canvas");
        offCanvas.width = viewport.width;
        offCanvas.height = viewport.height;
        const ctx = offCanvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;

        const dummyOverlay = document.createElement("div");
        const ocrData = await runOcrOnPage(pageNum, offCanvas, dummyOverlay);
        allTextParts.push(`--- Page ${pageNum} (OCR) ---\n${ocrData.fullText}`);
      }
    }

    extractedFullText = allTextParts.join("\n\n");
    displayExtractedText(extractedFullText);

    const wordCount = extractedFullText
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    wordCountEl.textContent = `${wordCount.toLocaleString()} words`;
    copyAllBtn.style.display = "flex";

    const ocrNote = usedOcr > 0 ? ` (${usedOcr} ${usedOcr === 1 ? "page" : "pages"} used OCR)` : "";
    showToast(`Full document text extracted successfully!${ocrNote}`, "success");
  } catch (err) {
    console.error("Extraction error:", err);
    showToast("Failed to extract full text", "error");
  } finally {
    showProgress(false);
    ocrStatusBar.style.display = "none";
    extractBtn.removeAttribute("disabled");
    extractBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
      </svg>
      Extract Full Text
    `;
  }
}

function displayExtractedText(text: string) {
  textDisplay.style.fontFamily = "'JetBrains Mono', monospace";
  textDisplay.style.fontSize = "13px";
  textDisplay.style.whiteSpace = "pre-wrap";
  textDisplay.style.color = "var(--color-text-secondary)";

  // Highlight page headers in orange
  const highlighted = text.replace(
    /^(--- Page \d+.*? ---)/gm,
    '<span style="color: var(--color-accent); font-weight: 600; display: block; margin: 16px 0 4px;">$1</span>'
  );
  textDisplay.innerHTML = highlighted;
}

// Copy All button
copyAllBtn.addEventListener("click", async () => {
  if (!extractedFullText) return;
  try {
    await navigator.clipboard.writeText(extractedFullText);
    showToast("Copied entire document text to clipboard!", "success");
  } catch {
    showToast("Failed to copy text", "error");
  }
});

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function showProgress(visible: boolean) {
  globalProgress.style.display = visible ? "block" : "none";
}

// ─── Gemini AI Chat ───────────────────────────────────────────────────────────
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!isChatLoading) sendMessage();
  }
});

sendBtn.addEventListener("click", () => {
  if (!isChatLoading) sendMessage();
});

function appendChatMessage(
  role: "user" | "model" | "error",
  content: string,
  streaming = false
): HTMLElement {
  const isUser = role === "user";
  const isError = role === "error";

  const msgEl = document.createElement("div");
  msgEl.className = "chat-message";
  msgEl.style.cssText = `
    display: flex;
    gap: 10px;
    align-items: flex-start;
    ${isUser ? "flex-direction: row-reverse;" : ""}
  `;

  const avatar = document.createElement("div");
  avatar.style.cssText = `
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: ${isUser ? "rgba(125,125,125,0.15)" : isError ? "rgba(239,68,68,0.2)" : "linear-gradient(135deg, #f97316, #ea580c)"};
    border: 1px solid ${isUser ? "var(--color-border)" : "transparent"};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 12px;
    color: white;
  `;
  avatar.textContent = isUser ? "U" : isError ? "!" : "🍊";

  const bubble = document.createElement("div");
  bubble.style.cssText = `
    background: ${isUser ? "rgba(249,115,22,0.12)" : isError ? "rgba(239,68,68,0.1)" : "var(--color-bg-card)"};
    border: 1px solid ${isUser ? "rgba(249,115,22,0.3)" : isError ? "rgba(239,68,68,0.25)" : "var(--color-border)"};
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    color: ${isError ? "#ef4444" : "var(--color-text-secondary)"};
    line-height: 1.6;
    max-width: 480px;
    white-space: pre-wrap;
    word-break: break-word;
  `;

  if (streaming) {
    bubble.innerHTML = `
      <div class="typing-indicator" style="display: flex; gap: 4px; align-items: center; height: 20px;">
        <span></span><span></span><span></span>
      </div>
    `;
  } else {
    bubble.textContent = content;
  }

  msgEl.appendChild(avatar);
  msgEl.appendChild(bubble);
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return bubble;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  if (!extractedFullText) {
    showToast("Please extract the PDF text first before asking questions!", "info");
    switchTab("text");
    return;
  }

  chatInput.value = "";
  chatInput.style.height = "auto";
  isChatLoading = true;
  sendBtn.setAttribute("disabled", "true");

  appendChatMessage("user", text);
  const aiBubble = appendChatMessage("model", "", true);
  chatHistory.push({ role: "user", parts: [{ text }] });

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        pdfContext: extractedFullText,
        history: chatHistory.slice(0, -1),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      aiBubble.textContent = `Error: ${err.error || "Failed to get response"}`;
      aiBubble.style.color = "#ef4444";
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    aiBubble.innerHTML = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data);
          if (parsed.text) {
            fullResponse += parsed.text;
            aiBubble.textContent = fullResponse;
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
          if (parsed.error) {
            aiBubble.textContent = `Error: ${parsed.error}`;
            aiBubble.style.color = "#ef4444";
          }
        } catch {
          // Continue on parse error
        }
      }
    }

    if (fullResponse) {
      chatHistory.push({
        role: "model",
        parts: [{ text: fullResponse }],
      });
    }
  } catch (err) {
    console.error("Chat error:", err);
    aiBubble.textContent =
      "Connection error. Please check your GEMINI_API_KEY in .env and try again.";
    aiBubble.style.color = "#ef4444";
  } finally {
    isChatLoading = false;
    sendBtn.removeAttribute("disabled");
    chatInput.focus();
  }
}

// ─── CSS spin keyframe injection ──────────────────────────────────────────────
const spinStyle = document.createElement("style");
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);
