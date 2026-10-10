Role & Task:
You are an expert full-stack developer. Build a lightweight MVP web application using Astro, Tailwind CSS, and Bun. The app will allow users to upload PDF files, extract text from both native PDF layers and scanned images using open-source OCR, interactively highlight/select text from rendered PDF images, extract full text across pages, and ask AI questions about the document using Gemini API.
Tech Stack & Constraints

    Framework: Astro (SSR mode or Hybrid) with Bun as the package manager/runtime.

    Styling: Tailwind CSS (modern, dark-mode friendly, sleek minimal glassmorphism UI).

    PDF Rendering & OCR: pdfjs-dist (PDF rendering to canvas/image) and tesseract.js (Open-source OCR for image pages/scans).

    LLM Integration: Google Gen AI SDK (Gemini 2.5/3.5 Flash Lite) via a lightweight server endpoint or Astro API route (/api/chat).

    Data & Auth: No Database, No Authentication. All state is held in-memory/browser session state.

Key Features to Implement

    Sleek & Modern UI:

        Drag-and-drop file uploader zone for PDFs.

        Split-screen layout: Left panel for PDF Viewer & OCR Layer; Right panel for Extracted Text tab + Gemini AI Chat tab.

        Minimalist aesthetics, crisp typography, micro-interactions, and smooth transitions.

    PDF Processing & OCR Text Selection:

        Render uploaded PDF pages onto HTML5 Canvases or Image Elements.

        Run tesseract.js on pages to extract text coordinates and bounding boxes.

        Superimpose an interactive text overlay (selectable text boxes) over the PDF page images so users can click-and-drag to select and copy text directly from image-based PDFs.

    Full Text Extraction:

        Provide a "Extract Full PDF Text" button that processes all pages (using native PDF text layer where available, falling back to Tesseract OCR for scanned images).

        Display the combined full document text in a clean, scrollable markdown viewer with a "Copy All" action.

    In-Memory Gemini AI Assistant:

        An interactive chat drawer or tab that accepts user prompts.

        When asking a question, send the extracted PDF text as context to the Gemini API (gemini-2.5-flash / gemini-3.5-flash-lite).

        Maintain chat history in memory during the browser session.

Step-by-Step Implementation Instructions

    Initialize an Astro project configured with Tailwind CSS and Bun runtime setup.

    Create the main UI structure using client-side Astro components (or React/Preact islands if needed for state management).

    Implement PDF page rendering using pdfjs-dist.

    Integrate tesseract.js worker to recognize text from rendered page canvases and generate select/copy bounding boxes.

    Implement an API route (/api/chat.ts) that reads GEMINI_API_KEY from .env, constructs the prompt context from extracted PDF text, and returns streamed or direct AI answers.

    Add clean loading indicators, progress bars for OCR processing, and toast notifications for user feedback.