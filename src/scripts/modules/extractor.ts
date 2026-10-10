import type { PdfViewer } from "./pdf";
import { processCanvasOcr } from "./ocr";
import { showToast, showProgress } from "./toast";

export class TextExtractor {
  private pdfViewer: PdfViewer;
  private extractBtn: HTMLElement;
  private copyAllBtn: HTMLElement;
  private textDisplay: HTMLElement;
  private wordCountEl: HTMLElement;
  private ocrStatusBar: HTMLElement;
  private ocrStatusText: HTMLElement;
  private fullText = "";

  constructor(options: {
    pdfViewer: PdfViewer;
    extractBtnId: string;
    copyAllBtnId: string;
    textDisplayId: string;
    wordCountId: string;
    ocrStatusBarId: string;
    ocrStatusTextId: string;
  }) {
    this.pdfViewer = options.pdfViewer;
    this.extractBtn = document.getElementById(options.extractBtnId)!;
    this.copyAllBtn = document.getElementById(options.copyAllBtnId)!;
    this.textDisplay = document.getElementById(options.textDisplayId)!;
    this.wordCountEl = document.getElementById(options.wordCountId)!;
    this.ocrStatusBar = document.getElementById(options.ocrStatusBarId)!;
    this.ocrStatusText = document.getElementById(options.ocrStatusTextId)!;

    this.bindEvents();
  }

  private bindEvents() {
    this.extractBtn.addEventListener("click", () => this.extractFullText());
    this.copyAllBtn.addEventListener("click", () => this.copyAllText());
  }

  public getExtractedText(): string {
    return this.fullText;
  }

  public reset() {
    this.fullText = "";
    this.textDisplay.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; gap: 12px; color: var(--color-text-muted);">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4;">
          <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="13" y1="18" x2="3" y2="18"/>
        </svg>
        <p style="font-size: 13px; margin: 0;">Click "Extract Full Text" to process the PDF</p>
      </div>
    `;
    this.copyAllBtn.style.display = "none";
    this.wordCountEl.textContent = "";
  }

  public async extractFullText() {
    const doc = this.pdfViewer.getDocument();
    if (!doc) {
      showToast("Please upload a PDF first", "info");
      return;
    }

    const totalPages = this.pdfViewer.getTotalPages();
    const scale = this.pdfViewer.getScale();

    this.extractBtn.setAttribute("disabled", "true");
    this.extractBtn.innerHTML = `
      <div style="width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite;"></div>
      Extracting...
    `;

    showProgress(true);
    this.textDisplay.innerHTML =
      '<div style="color: var(--color-text-muted); font-size: 13px; padding: 8px;">Extracting document text across all pages...</div>';

    const allTextParts: string[] = [];
    let usedOcr = 0;

    try {
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        this.ocrStatusText.textContent = `Processing page ${pageNum} / ${totalPages}...`;
        this.ocrStatusBar.style.display = "block";

        const page = await doc.getPage(pageNum);

        // 1. Check native digital PDF text
        const textContent = await page.getTextContent();
        const nativeText = textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (nativeText.length > 20) {
          allTextParts.push(`--- Page ${pageNum} ---\n${nativeText}`);
        } else {
          // 2. Scanned image or diagram page: use OCR
          usedOcr++;
          const cached = this.pdfViewer.getCachedOcr(pageNum);
          if (cached && cached.fullText) {
            allTextParts.push(`--- Page ${pageNum} (OCR) ---\n${cached.fullText}`);
          } else {
            const viewport = page.getViewport({ scale });
            const offCanvas = document.createElement("canvas");
            offCanvas.width = viewport.width;
            offCanvas.height = viewport.height;
            const ctx = offCanvas.getContext("2d")!;
            await page.render({ canvasContext: ctx, viewport }).promise;

            const ocrData = await processCanvasOcr(offCanvas);
            this.pdfViewer.setCachedOcr(pageNum, ocrData);
            allTextParts.push(`--- Page ${pageNum} (OCR) ---\n${ocrData.fullText}`);
          }
        }
      }

      this.fullText = allTextParts.join("\n\n");
      this.displayExtractedText(this.fullText);

      const wordCount = this.fullText
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
      this.wordCountEl.textContent = `${wordCount.toLocaleString()} words`;
      this.copyAllBtn.style.display = "flex";

      const ocrNote = usedOcr > 0 ? ` (${usedOcr} ${usedOcr === 1 ? "page" : "pages"} used OCR)` : "";
      showToast(`Full document text extracted successfully!${ocrNote}`, "success");
    } catch (err) {
      console.error("Extraction error:", err);
      showToast("Failed to extract full text", "error");
    } finally {
      showProgress(false);
      this.ocrStatusBar.style.display = "none";
      this.extractBtn.removeAttribute("disabled");
      this.extractBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
        </svg>
        Extract Full Text
      `;
    }
  }

  private displayExtractedText(text: string) {
    this.textDisplay.style.fontFamily = "'JetBrains Mono', monospace";
    this.textDisplay.style.fontSize = "13px";
    this.textDisplay.style.whiteSpace = "pre-wrap";
    this.textDisplay.style.color = "var(--color-text-secondary)";

    const highlighted = text.replace(
      /^(--- Page \d+.*? ---)/gm,
      '<span style="color: var(--color-accent); font-weight: 600; display: block; margin: 16px 0 4px;">$1</span>'
    );
    this.textDisplay.innerHTML = highlighted;
  }

  public async copyAllText() {
    if (!this.fullText) return;
    try {
      await navigator.clipboard.writeText(this.fullText);
      showToast("Copied entire document text to clipboard!", "success");
    } catch {
      showToast("Failed to copy text", "error");
    }
  }
}
