import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages serves this repo at /Touch-Grass-Bingo/, not the domain root.
  // Without this, every asset URL points at hey-nitsuj.github.io/assets/… (404).
  base: "/Touch-Grass-Bingo/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      workbox: {
        // Precache the app shell only. The ~570MB model lives in WebLLM's own
        // cache (IndexedDB/OPFS) and must never enter the workbox precache.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // The WebLLM engine chunk is ~6 MB; precache it so the whole app
        // keeps working offline after the first visit.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "index.html",
      },
      manifest: {
        name: "Touch Grass Bingo",
        short_name: "Touch Grass",
        description:
          "AI-generated bingo cards for your walk. Runs fully offline on an open-weight model in your browser.",
        theme_color: "#1f3d2b",
        background_color: "#f6f1e3",
        display: "standalone",
        start_url: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  worker: {
    format: "es",
  },
  build: {
    target: "es2022",
  },
});
