import { defineConfig, devices } from "@playwright/test";

// Requires the test stack (scripts/test-stack/up.sh) and a built app (pnpm build).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // tests share one database
  workers: 1,
  retries: 0, // tests change shared data, so a retry would not start from a clean state
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm start -p 3000",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
