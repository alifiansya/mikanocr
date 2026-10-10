import type { ChatMessage } from "./types";
import { showToast } from "./toast";

export class ChatManager {
  private chatMessages: HTMLElement;
  private chatInput: HTMLTextAreaElement;
  private sendBtn: HTMLElement;
  private history: ChatMessage[] = [];
  private isLoading = false;
  private getDocumentContext: () => string;
  private onOpenExtractTab: () => void;

  constructor(options: {
    chatMessagesId: string;
    chatInputId: string;
    sendBtnId: string;
    getDocumentContext: () => string;
    onOpenExtractTab: () => void;
  }) {
    this.chatMessages = document.getElementById(options.chatMessagesId)!;
    this.chatInput = document.getElementById(options.chatInputId) as HTMLTextAreaElement;
    this.sendBtn = document.getElementById(options.sendBtnId)!;
    this.getDocumentContext = options.getDocumentContext;
    this.onOpenExtractTab = options.onOpenExtractTab;

    this.bindEvents();
  }

  private bindEvents() {
    this.chatInput.addEventListener("input", () => {
      this.chatInput.style.height = "auto";
      this.chatInput.style.height = `${Math.min(this.chatInput.scrollHeight, 120)}px`;
    });

    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!this.isLoading) this.sendMessage();
      }
    });

    this.sendBtn.addEventListener("click", () => {
      if (!this.isLoading) this.sendMessage();
    });
  }

  public reset() {
    this.history = [];
    this.isLoading = false;
    this.chatMessages.innerHTML = `
      <div class="chat-message" style="display: flex; gap: 10px; align-items: flex-start;">
        <div style="width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, #f97316, #ea580c); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; color: white;">🍊</div>
        <div style="background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 10px; padding: 10px 14px; font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; max-width: 480px;">
          Hi! I'm your mikanocr AI assistant powered by Gemini. Upload a PDF, extract its text, and ask me any questions about the document!
        </div>
      </div>
    `;
  }

  private appendMessage(
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
    this.chatMessages.appendChild(msgEl);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;

    return bubble;
  }

  public async sendMessage() {
    const text = this.chatInput.value.trim();
    if (!text) return;

    const docContext = this.getDocumentContext();
    if (!docContext) {
      showToast("Please extract the PDF text first before asking questions!", "info");
      this.onOpenExtractTab();
      return;
    }

    this.chatInput.value = "";
    this.chatInput.style.height = "auto";
    this.isLoading = true;
    this.sendBtn.setAttribute("disabled", "true");

    this.appendMessage("user", text);
    const aiBubble = this.appendMessage("model", "", true);
    this.history.push({ role: "user", parts: [{ text }] });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          pdfContext: docContext,
          history: this.history.slice(0, -1),
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
              this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }
            if (parsed.error) {
              aiBubble.textContent = `Error: ${parsed.error}`;
              aiBubble.style.color = "#ef4444";
            }
          } catch {
            // Ignore parse chunks
          }
        }
      }

      if (fullResponse) {
        this.history.push({
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
      this.isLoading = false;
      this.sendBtn.removeAttribute("disabled");
      this.chatInput.focus();
    }
  }

  public scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }
}
