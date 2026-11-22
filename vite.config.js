import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the app from /king-tracker/
export default defineConfig({
  base: '/king-tracker/',
  plugins: [react()],
})
