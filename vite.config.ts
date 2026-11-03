import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import sitemap from "vite-plugin-sitemap";

export default defineConfig({
  plugins: [
    react(),
    sitemap({
      // Replace with your live Netlify or custom domain URL
      hostname: "https://componentatlascodeflow.netlify.app/",
      // Optional: Add any specific routes you want to prioritize or exclude
      readable: true,
    }),
  ],
});
