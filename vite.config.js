import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  preview: { host: "0.0.0.0", port: Number(process.env.PORT) || 8080, allowedHosts: true },
});
