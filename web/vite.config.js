import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { NodePackageImporter } from "sass";
import fs from "fs";
import YAML from "yaml";
import pkg from "../package.json" with { type: "json" };

// Load configuration from YAML file
// For vite.config.js, we need to handle the config path manually since we're in web/ directory
function loadViteConfig() {
  // Check environment variable first (set by systemd)
  if (process.env.CONFIG_PATH) {
    const configPath = process.env.CONFIG_PATH.startsWith("/")
      ? process.env.CONFIG_PATH
      : `../${process.env.CONFIG_PATH}`;
    return YAML.parse(fs.readFileSync(configPath, "utf8"));
  }

  // Fallback to local config for development
  const localConfigPath = "../config.yaml";
  if (fs.existsSync(localConfigPath)) {
    return YAML.parse(fs.readFileSync(localConfigPath, "utf8"));
  }

  // Final fallback: return default configuration for build
  return {
    frontend: {
      port: 3000,
    },
    server: {
      hostname: "localhost",
      port: 3443,
    },
  };
}

const config = loadViteConfig();

export default defineConfig({
  define: {
    // Define global constants that get replaced at build time from root package.json
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__: JSON.stringify(pkg.name),
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern",
        importers: [new NodePackageImporter()],
      },
    },
  },
  plugins: [react()],
  base: "/",
  publicDir: "public",
  server: {
    port: config.frontend?.port?.value || 3000,
    host: "0.0.0.0",
    https: false, // Disable HTTPS for dev server during build
    hmr: {
      port: config.frontend?.port?.value || 3000,
      host: config.server?.hostname?.value || "localhost",
    },
    proxy: {
      "/api": {
        target: `https://${config.server?.hostname?.value || "localhost"}:8443`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    sourcemap: false, // Disable source maps for production to avoid source map errors
    chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB for complex applications
    commonjsOptions: {
      defaultIsModuleExports: true, // Fix for Vite 4.0.3+ CommonJS handling changes
    },
    rollupOptions: {
      external: ["rollup"],
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: (assetInfo) => {
          // Keep favicons at root level
          if (
            assetInfo.name === "favicon.ico" ||
            assetInfo.name === "dark-favicon.ico"
          ) {
            return "[name][extname]";
          }
          return `assets/[name].[ext]`;
        },
        manualChunks: (id) => {
          // Simplify chunking to avoid dependency issues
          // Only split out the largest, most independent libraries

          //// Flow/diagram libraries (large, independent)
          //if (id.includes('node_modules/@xyflow') ||
          //    id.includes('node_modules/elkjs') ||
          //    id.includes('node_modules/dagre')) {
          //  return 'flow-diagrams';
          //}

          // Everything else stays together in vendor to avoid dependency issues
          // This includes React, Router, Axios, utilities, etc.
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      // libraries that need special handling
    ],
    exclude: ["rollup"],
  },
});
