import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_TARGET = process.env.VITE_API_TARGET || "http://localhost:5001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /**
     * Proxy the API and the websocket in development so the browser sees a
     * single origin. That keeps the auth cookie first-party, which is what
     * production does too — fewer surprises between the two.
     */
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
      "/socket.io": { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing libraries so a code change does not
        // force everyone to re-download React.
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          realtime: ["socket.io-client"],
        },
      },
    },
  },
});
