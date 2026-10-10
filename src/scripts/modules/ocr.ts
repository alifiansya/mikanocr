// eslint-disable-next-line @typescript-eslint/no-explicit-any
import * as TesseractNS from "tesseract.js";
import type { OcrWord, PageOcrData } from "./types";
import { showToast } from "./toast";

// CJS interop for Vite
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _tesseract = (TesseractNS as any).default ?? TesseractNS;
const createWorker: typeof TesseractNS.createWorker = _tesseract.createWorker;

let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;
let isOcrRunning = false;

export async function getOcrWorker(onProgress?: (text: string) => void) {
  if (!ocrWorker) {
    ocrWorker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text" && m.progress !== undefined) {
          const pct = Math.round(m.progress * 100);
          onProgress?.(`Recognizing text: ${pct}%`);
        } else if (m.status) {
          onProgress?.(`${m.status}...`);
        }
      },
    });
  }
  return ocrWorker;
}

export function terminateOcrWorker() {
  if (ocrWorker) {
    ocrWorker.terminate();
    ocrWorker = null;
  }
}

export function parseWordsFromTSV(tsvText: string): OcrWord[] {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractWordsFromBlocks(blocks: any[]): OcrWord[] {
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

export async function processCanvasOcr(
  canvas: HTMLCanvasElement,
  onStatusChange?: (statusText: string, visible: boolean) => void
): Promise<PageOcrData> {
  if (isOcrRunning) {
    showToast("OCR is currently running, please wait...", "info");
    return { words: [], fullText: "" };
  }

  isOcrRunning = true;
  onStatusChange?.("Initializing OCR engine...", true);

  try {
    const worker = await getOcrWorker((progressMsg) => {
      onStatusChange?.(progressMsg, true);
    });

    const imageData = canvas.toDataURL("image/png");

    const result = await worker.recognize(
      imageData,
      {},
      { text: true, blocks: true, tsv: true }
    );

    let words: OcrWord[] = [];
    if (result.data.blocks && result.data.blocks.length > 0) {
      words = extractWordsFromBlocks(result.data.blocks);
    }

    if (words.length === 0 && result.data.tsv) {
      words = parseWordsFromTSV(result.data.tsv);
    }

    const fullText = (result.data.text ?? "").trim();

    return {
      words,
      fullText,
    };
  } catch (err) {
    console.error("OCR execution error:", err);
    showToast("OCR processing failed for this page.", "error");
    return { words: [], fullText: "" };
  } finally {
    isOcrRunning = false;
    onStatusChange?.("", false);
  }
}

export function renderOcrBoxes(overlay: HTMLElement, ocrData: PageOcrData) {
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

    const textSpan = document.createElement("span");
    textSpan.className = "ocr-word-text";
    textSpan.textContent = text;
    textSpan.style.fontSize = `${Math.max(10, Math.floor(boxHeight * 0.85))}px`;
    textSpan.style.lineHeight = `${boxHeight}px`;

    box.appendChild(textSpan);

    box.addEventListener("click", (e) => {
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
