import { defineConfig, devices } from '@playwright/test'

const webkitProject = process.env.PLAYWRIGHT_WEBKIT === '1'
  ? [{ name: 'webkit', testMatch: /webkit\.smoke\.spec\.ts/, use: { ...devices['Desktop Safari'] } }]
  : []
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100)
// Next allows one dev server per project. To reuse one that is already running elsewhere,
// set PLAYWRIGHT_HOST and PLAYWRIGHT_PORT to match it (for example localhost and 3002).
const host = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1'
const baseURL = `http://${host}:${port}`
const serverCommand = process.env.PLAYWRIGHT_PRODUCTION === '1'
  ? `pnpm start --hostname 127.0.0.1 --port ${port}`
  : `pnpm dev --hostname 127.0.0.1 --port ${port}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', testIgnore: /webkit\.smoke\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    ...webkitProject,
  ],
  webServer: {
    command: serverCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
