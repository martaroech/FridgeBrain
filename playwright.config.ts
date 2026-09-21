import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    httpCredentials: {
      username: "prova",
      password: "password-solo-test-molto-lunga",
      send: "always",
    },
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  },
  projects: [
    {
      name: "smartphone",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet",
      use: { viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: "node scripts/avvia_test_browser.mjs",
    url: "http://127.0.0.1:3100/api/salute",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      FRIDGEBRAIN_DATI: "data/test-browser",
      FRIDGEBRAIN_UTENTE: "prova",
      FRIDGEBRAIN_PASSWORD: "password-solo-test-molto-lunga",
      FRIDGEBRAIN_OFF_URL: "http://127.0.0.1:3101",
      FRIDGEBRAIN_GENERATORE: "simulato",
      NEXT_TELEMETRY_DISABLED: "1",
      TZ: "Europe/Rome",
    },
  },
});
