import { defineConfig, devices } from "@playwright/test";

// Tests the exported web build (pnpm build:web) against the test stack (scripts/test-stack/up.sh).
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  retries: 0, // tests change shared data
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:8081",
    ...devices["Pixel 7"],
    geolocation: { latitude: -8.99, longitude: 13.269 }, // ~700 m from Ana's home (Kilamba)
    permissions: ["geolocation"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node ../../scripts/test-stack/serve-spa.mjs dist 8081",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
  },
});
