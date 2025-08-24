import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Pure web configuration - no Electron
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Optimize for web deployment
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
    }
  },
  // Environment variables for web
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL || 'https://your-pos-app.fly.dev/api'),
  }
});