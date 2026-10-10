import type { APIRoute } from "astro";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const prerender = false;

interface ChatMessage {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface ChatRequest {
  message: string;
  pdfContext?: string;
  history?: ChatMessage[];
  apiKey?: string;
  model?: string;
}

export const POST: APIRoute = async ({ request }) => {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Client-supplied key takes priority; fall back to server environment variable if present
  const apiKey = body.apiKey?.trim() || import.meta.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "No Gemini API key provided. Please set your API key in the AI Settings in the top bar.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { message, pdfContext, history = [], model: selectedModel = "gemini-2.5-flash" } = body;

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "Message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: selectedModel,
      systemInstruction: pdfContext
        ? `You are a helpful AI assistant specialized in analyzing documents. The user has uploaded a PDF document. Use the following extracted text as context to answer questions accurately and concisely.\n\nDOCUMENT CONTENT:\n---\n${pdfContext.slice(0, 30000)}\n---\n\nAnswer questions based on this document. If the answer is not in the document, say so clearly.`
        : "You are a helpful AI assistant. Help users with their questions.",
    });

    // Build chat session with history
    const chat = model.startChat({
      history: history.map((msg) => ({
        role: msg.role,
        parts: msg.parts,
      })),
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    // Stream the response
    const result = await chat.sendMessageStream(message);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Stream generation error";
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: errMsg })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    console.error("Gemini API error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate response";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
