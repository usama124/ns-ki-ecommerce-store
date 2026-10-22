import { defineConfig } from '@playwright/test'
import os from 'node:os'
import path from 'node:path'

// Isolated browser/Canvas tests: no app server, credentials, database or R2 writes.
export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  reporter: 'list',
  outputDir: path.join(os.tmpdir(), 'nski-image-optimizer-tests'),
  use: { browserName: 'chromium', headless: true },
})
