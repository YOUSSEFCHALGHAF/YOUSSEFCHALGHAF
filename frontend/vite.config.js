import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",             // navigateur simulé
    globals: true,                    // describe / it / expect sans import (on les importe quand même)
    setupFiles: "./src/test/setup.js",
    css: false,                       // inutile de traiter Tailwind pendant les tests
  },
});