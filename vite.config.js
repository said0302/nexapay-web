import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true, // Supaya bisa dites di localhost
      },
      manifest: {
        name: "NexaPay - AI Expense Tracker",
        short_name: "NexaPay",
        description: "Aplikasi pencatat keuangan pintar berbasis AI",
        theme_color: "#ffffff",
        background_color: "#F2F2F7",
        display: "standalone", // Ini yang bikin layarnya full screen!
        icons: [
          {
            src: "/logo-19.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/logo-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
});
