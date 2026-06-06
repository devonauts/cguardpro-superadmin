import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// The panel is served under a sub-path on the existing domain (e.g.
// https://app.cguardpro.com/superadmin), so assets and the router share the
// `/superadmin/` base. In dev, /api is proxied to the local backend (:8080).
export default defineConfig({
  base: "/superadmin/",
  plugins: [react(), tsconfigPaths(), tailwindcss()],
  server: {
    port: 5183,
    proxy: {
      "/api": {
        target: process.env.VITE_DEV_API_TARGET || "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-heroui": ["@heroui/react", "framer-motion"],
          "vendor-charts": ["recharts"],
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-toast": ["sonner"],
        },
      },
    },
  },
});
