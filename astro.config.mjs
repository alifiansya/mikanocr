import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";

export default defineConfig({
  output: "server",
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
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
