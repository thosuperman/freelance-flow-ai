import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://freelanceflow:freelanceflow@localhost:54329/freelanceflow_e2e";

/**
 * E2E tests run against a production build with the simulated AI provider and the simulated PayPal
 * gateway (PAYPAL_MODE=mock). They verify real application behaviour end to end, but they are NOT
 * evidence of a live PayPal Sandbox transaction — see docs/PAYPAL_INTEGRATION.md for that procedure.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx prisma migrate deploy && npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 600_000, // a cold production build (Bryntum + AG Studio) can take several minutes
    reuseExistingServer: false,
    env: {
      DATABASE_URL,
      APP_URL: `http://localhost:${PORT}`,
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret",
      APP_ENCRYPTION_KEY: "ZTJlLWtleS1lMmUta2V5LWUyZS1rZXktMzJieXRlcyE=",
      AI_PROVIDER: "simulated",
      PAYPAL_MODE: "mock",
      DEMO_MODE_ENABLED: "true",
      DEMO_RATE_LIMIT_PER_HOUR: "1000",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
