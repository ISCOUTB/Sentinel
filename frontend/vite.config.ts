import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget =
    process.env.VITE_API_TARGET ||
    env.VITE_API_TARGET ||
    "http://localhost:8000";

  return {
    // Look for .env in current dir or parent dir (for centralization)
    envDir: fs.existsSync(path.resolve(__dirname, "../.env")) ? ".." : ".",
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api/v1": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      nodePolyfills({
        include: ["buffer", "process", "util", "stream"],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ].filter(Boolean),
    define: {
      // Polyfill de global para compatibilidad con aws-sdk
      global: "globalThis",
    },
    build: {
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            aws: ["aws-iot-device-sdk-v2", "@aws-sdk/client-iot", "@aws-sdk/client-cognito-identity"],
          },
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        buffer: "buffer",
        process: "process",
        stream: "stream-browserify",
        util: "util",
      },
    },
    optimizeDeps: {
      include: ["buffer", "process", "stream-browserify", "util", "aws-iot-device-sdk-v2"],
    },
  };
});
