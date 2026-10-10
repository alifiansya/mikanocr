import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["tesseract.js", "pdfjs-dist"],
    },
    ssr: {
      noExternal: ["tesseract.js"],
    },
  },
});
