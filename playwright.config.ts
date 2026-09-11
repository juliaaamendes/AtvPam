import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4173", channel: "msedge", headless: true },
  webServer: {
    command: "node scripts/serve-preview.cjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
