import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Stamp a unique id into dist/sw.js so every deploy starts a fresh app cache.
function swBuildId() {
  let outDir
  return {
    name: 'sw-build-id',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js')
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD_ID__', Date.now().toString(36)))
    },
  }
}

// GitHub Pages serves the app from /king-tracker/
export default defineConfig({
  base: '/king-tracker/',
  plugins: [react(), swBuildId()],
})
