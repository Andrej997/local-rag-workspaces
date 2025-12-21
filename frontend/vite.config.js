import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // FIX: Define global to window for libraries like Plotly
  define: {
    global: 'window',
  },
})