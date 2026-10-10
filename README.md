<div align="center">

  <img src="public/images/logo.webp" alt="MikanOCR Logo" width="96" height="96" />

  # MikanOCR

  **Client-side PDF OCR studio and AI document assistant.**

  [![Built with Astro](https://img.shields.io/badge/Astro-v7-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
  [![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
  [![Bun](https://img.shields.io/badge/Runtime-Bun-fbf0df?style=flat-square&logo=bun&logoColor=black)](https://bun.sh)
  [![License: MIT](https://img.shields.io/badge/License-MIT-f97316?style=flat-square)](LICENSE)

</div>

---

## 🌟 Overview

**MikanOCR** is a lightweight web application that allows you to extract text from digital and scanned PDFs, select and copy text directly from page images via an interactive OCR overlay, and chat with Google's Gemini models using the document context.

All heavy PDF rendering and OCR processing occurs **100% on the client side** inside browser Web Workers and WebAssembly. Your documents are never uploaded to a server database.

---

## ✨ Features

- **📑 Native & Scanned PDF OCR**
  - Renders pages onto HTML5 canvases with `pdfjs-dist`.
  - Runs `tesseract.js` directly in the browser via WebAssembly to extract words, coordinates, and bounding boxes.
- **🎯 Interactive Selectable OCR Overlay**
  - Superimposes clickable, selectable bounding boxes over scanned page images.
  - Native cursor drag-and-copy (`Ctrl+C`) or single-click to copy individual words.
- **📄 Full Document Text Extraction**
  - Dual-layer extraction: pulls native digital text where available and falls back to OCR for scanned pages.
  - Formatted text viewer with word count and a "Copy All" action.
- **🤖 Document Q&A with Gemini AI**
  - Context-aware streaming chat drawer powered by the official `@google/generative-ai` SDK.
  - Supports Markdown rendering for tables, lists, and code blocks.
  - Model selector: Gemini 2.5 Flash, 3.5 Flash Lite, 2.0 Flash, and 2.5 Pro.
- **🔒 Privacy & Client Storage**
  - Enter your Gemini API key in the UI; it is saved in browser `localStorage`.
  - No database, no user accounts, and zero document retention.
- **🌓 Modern Aesthetics**
  - Dark and Light mode toggle with persisted preference.
  - Glassmorphic UI with crisp typography and smooth micro-interactions.

---

## 🏗️ Architecture

```
src/
├── layouts/
│   └── Layout.astro         # HTML shell, fonts & theme bootstrapper
├── pages/
│   ├── index.astro          # Split-panel workspace, modal & UI controls
│   └── api/
│       └── chat.ts          # Serverless SSE streaming proxy for Gemini
├── scripts/
│   ├── app.ts               # Core application orchestrator
│   └── modules/
│       ├── aiConfig.ts      # LocalStorage API key & model settings
│       ├── chat.ts          # Chat manager & Markdown streaming parser
│       ├── extractor.ts     # Document text extraction engine
│       ├── ocr.ts           # Tesseract.js worker & overlay box rendering
│       ├── pdf.ts           # PDF.js page rendering & canvas controller
│       ├── theme.ts         # Theme toggle (Light/Dark)
│       ├── toast.ts         # User feedback notifications
│       └── types.ts         # Shared TypeScript interfaces
└── styles/
    └── global.css           # Tailwind v4 variables & glassmorphism theme
```

---

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) (recommended) or Node.js 18+

### 1. Clone & Install
```bash
git clone https://github.com/your-username/mikanocr.git
cd mikanocr
bun install
```

### 2. Configure Environment (Optional)
You can configure a default API key in `.env`, or simply enter it directly into the web UI:
```bash
cp .env.example .env
```
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Start Development Server
```bash
bun run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `bun run dev` | Starts local dev server at `localhost:4321` |
| `bun run build` | Builds production bundle |
| `bun run preview` | Previews the production build locally |

---

## 🔑 Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create and copy a free API key.
3. In MikanOCR, click **"Gemini Key"** in the top header and paste your key.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
