import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(frontendDir, '..')

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(frontendDir, 'src')
    }
  },
  server: {
    fs: {
      allow: [projectRoot]
    }
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.spec.js'],
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 2
      }
    },
    fileParallelism: false
  }
})