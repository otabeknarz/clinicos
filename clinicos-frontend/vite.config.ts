import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  /*
    Port `PORT` dan olinadi: ko'rish oynasi (`.claude/launch.json`) 5173 band
    bo'lsa bo'sh port beradi. `--port` bayrog'i berilsa, u ustun turadi.
  */
  server: {
    port: Number(process.env.PORT) || 5173,
  },
})
