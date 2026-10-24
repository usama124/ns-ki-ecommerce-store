import { defineConfig } from '@playwright/test'

// No dotenv, no webServer, no reuse of an unknown server.
export default defineConfig({
  testDir: './tests/qa', testMatch: '**/*.spec.ts', workers: 1, retries: 0,
  timeout: 90000, expect: { timeout: 15000 },
  outputDir: '/tmp/nski-qa-browser-artifacts',
  reporter: [['list'], ['json', { outputFile: 'reports/qa/test-artifacts/remediation-browser-results.json' }]],
  use: { baseURL: 'http://localhost:3105', browserName: 'chromium', headless: true, trace: 'off', screenshot: 'off' },
})
