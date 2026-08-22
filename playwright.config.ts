import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run db:migrate && npm run dev -- --hostname 127.0.0.1",
    env: {
      ...process.env,
      DATABASE_URL: "file:./prisma/e2e.db",
    },
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});
