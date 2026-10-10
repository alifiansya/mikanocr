import { showToast } from "./toast";

const STORAGE_KEY_API_KEY = "mikanocr_gemini_api_key";
const STORAGE_KEY_MODEL = "mikanocr_gemini_model";
export const DEFAULT_MODEL = "gemini-2.5-flash";

export class AiConfigManager {
  private apiKeyModal: HTMLElement;
  private apiKeyInput: HTMLInputElement;
  private saveApiKeyBtn: HTMLElement;
  private cancelApiKeyBtn: HTMLElement;
  private openSettingsBtn: HTMLElement;
  private modelSelect: HTMLSelectElement;
  private apiKeyStatusBadge: HTMLElement;

  constructor() {
    this.apiKeyModal = document.getElementById("api-key-modal")!;
    this.apiKeyInput = document.getElementById("api-key-input") as HTMLInputElement;
    this.saveApiKeyBtn = document.getElementById("save-api-key-btn")!;
    this.cancelApiKeyBtn = document.getElementById("cancel-api-key-btn")!;
    this.openSettingsBtn = document.getElementById("open-settings-btn")!;
    this.modelSelect = document.getElementById("model-select") as HTMLSelectElement;
    this.apiKeyStatusBadge = document.getElementById("api-key-status-badge")!;

    this.init();
    this.bindEvents();
  }

  private init() {
    const savedKey = this.getApiKey();
    if (savedKey) {
      this.apiKeyInput.value = savedKey;
      this.updateStatusBadge(true);
    } else {
      this.updateStatusBadge(false);
    }

    const savedModel = this.getSelectedModel();
    if (savedModel && this.modelSelect) {
      this.modelSelect.value = savedModel;
    }
  }

  private bindEvents() {
    this.openSettingsBtn?.addEventListener("click", () => this.openModal());
    this.cancelApiKeyBtn?.addEventListener("click", () => this.closeModal());

    this.apiKeyModal?.addEventListener("click", (e) => {
      if (e.target === this.apiKeyModal) this.closeModal();
    });

    this.saveApiKeyBtn?.addEventListener("click", () => {
      const key = this.apiKeyInput.value.trim();
      this.setApiKey(key);
      this.closeModal();
      if (key) {
        showToast("Gemini API key saved to browser storage!", "success");
      } else {
        showToast("API key cleared.", "info");
      }
    });

    this.modelSelect?.addEventListener("change", () => {
      const model = this.modelSelect.value;
      localStorage.setItem(STORAGE_KEY_MODEL, model);
      showToast(`Selected model: ${model}`, "info", 2000);
    });
  }

  public getApiKey(): string {
    return localStorage.getItem(STORAGE_KEY_API_KEY) || "";
  }

  public setApiKey(key: string) {
    if (key) {
      localStorage.setItem(STORAGE_KEY_API_KEY, key);
      this.updateStatusBadge(true);
    } else {
      localStorage.removeItem(STORAGE_KEY_API_KEY);
      this.updateStatusBadge(false);
    }
  }

  public getSelectedModel(): string {
    return localStorage.getItem(STORAGE_KEY_MODEL) || DEFAULT_MODEL;
  }

  public openModal() {
    this.apiKeyInput.value = this.getApiKey();
    this.apiKeyModal.style.display = "flex";
    this.apiKeyInput.focus();
  }

  public closeModal() {
    this.apiKeyModal.style.display = "none";
  }

  private updateStatusBadge(hasKey: boolean) {
    if (!this.apiKeyStatusBadge) return;
    if (hasKey) {
      this.apiKeyStatusBadge.innerHTML = `<span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; display: inline-block;"></span> Key Set`;
      this.apiKeyStatusBadge.style.color = "#10b981";
    } else {
      this.apiKeyStatusBadge.innerHTML = `<span style="width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span> No Key`;
      this.apiKeyStatusBadge.style.color = "#f59e0b";
    }
  }
}
