export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
}

export interface PageOcrData {
  words: OcrWord[];
  fullText: string;
}

export interface ChatMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}
