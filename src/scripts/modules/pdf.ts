import * as pdfjsLib from "pdfjs-dist";
import type { PageOcrData } from "./types";
import { processCanvasOcr, renderOcrBoxes } from "./ocr";
import { showToast } from "./toast";

// Setup PDF worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export class PdfViewer {
  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  private currentPage = 1;
  private totalPages = 0;
  private scale = 1.5;
  private ocrOverlayEnabled = false;
  private pageOcrCache: Map<number, PageOcrData> = new Map();

  // Elements
  private canvasContainer: HTMLElement;
  private pageInfo: HTMLElement;
  private prevPageBtn: HTMLButtonElement;
  private nextPageBtn: HTMLButtonElement;
  private ocrToggleBtn: HTMLElement;
  private ocrToggle: HTMLInputElement;
  private ocrTrack: HTMLElement;
  private ocrStatusBar: HTMLElement;
  private ocrStatusText: HTMLElement;

  constructor() {
    this.canvasContainer = document.getElementById("canvas-container")!;
    this.pageInfo = document.getElementById("page-info")!;
    this.prevPageBtn = document.getElementById("prev-page") as HTMLButtonElement;
    this.nextPageBtn = document.getElementById("next-page") as HTMLButtonElement;
    this.ocrToggleBtn = document.getElementById("ocr-toggle-btn")!;
    this.ocrToggle = document.getElementById("ocr-toggle") as HTMLInputElement;
    this.ocrTrack = document.getElementById("ocr-track")!;
    this.ocrStatusBar = document.getElementById("ocr-status-bar")!;
    this.ocrStatusText = document.getElementById("ocr-status-text")!;

    this.bindEvents();
  }

  private bindEvents() {
    this.prevPageBtn.addEventListener("click", () => this.goToPrevPage());
    this.nextPageBtn.addEventListener("click", () => this.goToNextPage());
    this.ocrToggleBtn.addEventListener("click", () => this.toggleOcrOverlay());
  }

  public async loadDocument(arrayBuffer: ArrayBuffer, fileName: string): Promise<number> {
    this.reset();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    this.pdfDoc = await loadingTask.promise;
    this.totalPages = this.pdfDoc.numPages;

    await this.renderPage(this.currentPage);
    this.updatePageInfo();
    return this.totalPages;
  }

  public reset() {
    this.currentPage = 1;
    this.totalPages = 0;
    this.pdfDoc = null;
    this.pageOcrCache.clear();
    this.ocrOverlayEnabled = false;
    this.ocrTrack.classList.remove("on");
    this.ocrToggle.checked = false;
    this.canvasContainer.innerHTML = "";
    this.updatePageInfo();
  }

  public getDocument(): pdfjsLib.PDFDocumentProxy | null {
    return this.pdfDoc;
  }

  public getTotalPages(): number {
    return this.totalPages;
  }

  public getScale(): number {
    return this.scale;
  }

  public getCachedOcr(pageNum: number): PageOcrData | undefined {
    return this.pageOcrCache.get(pageNum);
  }

  public setCachedOcr(pageNum: number, data: PageOcrData) {
    this.pageOcrCache.set(pageNum, data);
  }

  private updatePageInfo() {
    this.pageInfo.textContent = this.totalPages > 0 ? `Page ${this.currentPage} / ${this.totalPages}` : "";
    this.prevPageBtn.toggleAttribute("disabled", this.currentPage <= 1);
    this.nextPageBtn.toggleAttribute("disabled", this.currentPage >= this.totalPages);
  }

  public async goToPrevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.canvasContainer.innerHTML = "";
      await this.renderPage(this.currentPage);
      this.updatePageInfo();
    }
  }

  public async goToNextPage() {
    if (this.pdfDoc && this.currentPage < this.totalPages) {
      this.currentPage++;
      this.canvasContainer.innerHTML = "";
      await this.renderPage(this.currentPage);
      this.updatePageInfo();
    }
  }

  public async renderPage(pageNum: number) {
    if (!this.pdfDoc) return;

    const page = await this.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.scale });

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

    const canvas = document.createElement("canvas");
    canvas.id = `pdf-canvas-${pageNum}`;
    const ctx = canvas.getContext("2d")!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.display = "block";
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    pageWrapper.appendChild(canvas);

    const ocrOverlay = document.createElement("div");
    ocrOverlay.id = `ocr-overlay-${pageNum}`;
    ocrOverlay.className = "ocr-overlay-container";
    ocrOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${viewport.width}px;
      height: ${viewport.height}px;
      pointer-events: ${this.ocrOverlayEnabled ? "auto" : "none"};
      display: ${this.ocrOverlayEnabled ? "block" : "none"};
      z-index: 10;
    `;
    pageWrapper.appendChild(ocrOverlay);

    this.canvasContainer.appendChild(pageWrapper);

    await page.render({ canvasContext: ctx, viewport }).promise;

    if (this.ocrOverlayEnabled) {
      if (this.pageOcrCache.has(pageNum)) {
        renderOcrBoxes(ocrOverlay, this.pageOcrCache.get(pageNum)!);
      } else {
        await this.runOcrOnCurrentPage(pageNum, canvas, ocrOverlay);
      }
    }
  }

  public async toggleOcrOverlay() {
    if (!this.pdfDoc) {
      showToast("Please upload a PDF first", "info");
      return;
    }

    this.ocrOverlayEnabled = !this.ocrOverlayEnabled;
    this.ocrToggle.checked = this.ocrOverlayEnabled;
    this.ocrTrack.classList.toggle("on", this.ocrOverlayEnabled);

    const overlay = document.getElementById(`ocr-overlay-${this.currentPage}`);
    const canvas = document.getElementById(`pdf-canvas-${this.currentPage}`) as HTMLCanvasElement | null;

    if (!overlay || !canvas) return;

    if (this.ocrOverlayEnabled) {
      overlay.style.display = "block";
      overlay.style.pointerEvents = "auto";

      if (!this.pageOcrCache.has(this.currentPage)) {
        await this.runOcrOnCurrentPage(this.currentPage, canvas, overlay);
      } else {
        renderOcrBoxes(overlay, this.pageOcrCache.get(this.currentPage)!);
      }
    } else {
      overlay.style.display = "none";
      overlay.style.pointerEvents = "none";
    }
  }

  private async runOcrOnCurrentPage(pageNum: number, canvas: HTMLCanvasElement, overlay: HTMLElement) {
    const ocrData = await processCanvasOcr(canvas, (statusText, visible) => {
      this.ocrStatusBar.style.display = visible ? "block" : "none";
      this.ocrStatusText.textContent = statusText;
    });

    this.pageOcrCache.set(pageNum, ocrData);
    renderOcrBoxes(overlay, ocrData);

    if (ocrData.words.length > 0) {
      showToast(`Detected ${ocrData.words.length} selectable text regions on page ${pageNum}`, "success");
    } else {
      showToast(`No distinct text recognized on page ${pageNum}`, "info");
    }
  }
}
