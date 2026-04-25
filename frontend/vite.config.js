import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@llm': path.resolve(__dirname, '../LLM_integration'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
