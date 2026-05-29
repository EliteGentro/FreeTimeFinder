import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss()],
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.{js,jsx}"],
  },
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:1234",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
