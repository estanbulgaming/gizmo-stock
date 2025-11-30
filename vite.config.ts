import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // API proxy target - set VITE_API_PROXY_TARGET in .env file
  const apiTarget = env.VITE_API_PROXY_TARGET || "";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false, // Disable for production
      // Optimize chunks for better loading
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom"],
            ui: [
              "@radix-ui/react-dialog",
              "@radix-ui/react-popover", 
              "@radix-ui/react-select",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-label",
            ],
            icons: ["lucide-react"],
          },
        },
      },
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1000,
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      // API proxy for development
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          timeout: 10000,
        },
      },
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
    },
  };
});
