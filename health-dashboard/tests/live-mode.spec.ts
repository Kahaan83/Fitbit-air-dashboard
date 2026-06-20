import { test, expect } from "@playwright/test";

test.describe("Live Mode Tests", () => {
  let syncCount = 0;
  let syncBody: any = null;

  test.beforeEach(async ({ page }) => {
    syncCount = 0;
    syncBody = null;

    // Intercept api/status to simulate authenticated token
    await page.route("**/api/status", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          authenticated: true,
          token_valid: true,
          last_sync: "2026-06-01T10:00:00Z",
          scopes: [
            "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
            "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
          ],
        },
      });
    });

    const liveTelemetryPayload = {
      heart_rate: [
        { timestamp: "2026-06-20T08:00:00Z", value: 72 },
        { timestamp: "2026-06-20T08:15:00Z", value: 160 }, // Peak HR
      ],
      hrv: [{ timestamp: "2026-06-20T00:00:00Z", value: 123 }], // distinctive hrv value
      daily_spo2: [{ timestamp: "2026-06-20T00:00:00Z", value: 95.5 }],
      sleep_temp: [{ timestamp: "2026-06-20T00:00:00Z", value: 0.2 }],
      sleep: [
        {
          timestamp: "2026-06-20T00:00:00Z",
          value: {
            total_sleep_minutes: 420,
            stages: { rem: 90, deep: 60 },
          },
        },
      ],
      steps: [{ timestamp: "2026-06-20T12:00:00Z", value: 11000 }],
      derived: {
        ans_balance: [{ date: "2026-06-20", lf_power: 1.2, hf_power: 0.8, lf_hf_ratio: 1.5 }],
        sleep_debt: [{ date: "2026-06-20", actual_hours: 7.0, target_hours: 8.0, debt_hours: 1.0 }],
        vo2_max: [{ date: "2026-06-20", vo2_max: 48.5 }],
        acute_stress: [],
      },
    };

    // Intercept api/health-data
    await page.route("**/api/health-data", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        json: liveTelemetryPayload,
      });
    });

    // Intercept api/live-data to return a minimal valid telemetry payload
    await page.route("**/api/live-data", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        json: liveTelemetryPayload,
      });
    });

    // Intercept api/trigger-sync
    await page.route("**/api/trigger-sync", (route) => {
      syncCount++;
      syncBody = route.request().postDataJSON();

      if (syncCount === 2) {
        // Second call triggers 429
        route.fulfill({
          status: 429,
          contentType: "application/json",
          json: { error: "Sync cooldown active", retry_after: 45 },
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          json: { status: "ok", records_fetched: 150, synced_at: Date.now() / 1000 },
        });
      }
    });
  });

  test("Switching from sample to live mode loads real data and syncs correctly", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Initially starts in Demo/Sample Mode (app name FITBIT AIR)
    await expect(page.locator('h2:has-text("FITBIT AIR")')).toBeVisible();

    // Open settings modal
    await page.locator('[data-testid="user-profile-button"]').click();
    await expect(page.locator("text=Data Source")).toBeVisible();

    // Toggle mode switch in the modal to switch to Live mode
    const modeSwitch = page.locator('[data-testid="data-source-toggle"]');
    await expect(modeSwitch).toBeVisible();
    await modeSwitch.click();

    // Verify that the DateRangePicker is now visible inside the Settings Modal
    await expect(page.locator('button:has-text("custom")')).toBeVisible();

    // Select custom preset on DateRangePicker and sync inside settings modal
    await page.locator('button:has-text("custom")').first().click();

    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').last();
    await expect(startDateInput).toBeVisible();

    await startDateInput.fill("2026-06-01");
    await endDateInput.fill("2026-06-07");

    const syncButton = page.locator('button:has-text("Sync")').first();
    await expect(syncButton).toBeEnabled();
    await syncButton.click();

    // Verify first trigger-sync request sent
    await expect.poll(() => syncCount).toBe(1);
    expect(syncBody).toEqual({
      start_date: "2026-06-01",
      end_date: "2026-06-07",
    });

    // Close settings modal to view live page metrics
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Navigate to Sleep page
    await page.locator("nav").locator("text=Sleep").click();
    await page.waitForTimeout(500);

    // Verify sleep stage details or custom SpO2 / sleep efficiency readouts
    await expect(page.locator('[data-testid="spo2-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="spo2-chart"] .recharts-responsive-container')).toBeVisible();
    await expect(page.locator('[data-testid="spo2-chart"] svg.recharts-surface')).toBeVisible();

    // Go back to Overview to open settings modal
    await page.locator("nav").locator("text=Overview").click();
    await page.waitForTimeout(500);

    // Open settings modal again to trigger sync and test 429
    await page.locator('[data-testid="user-profile-button"]').click();
    await expect(page.locator('button:has-text("Sync")')).toBeVisible();

    // Trigger sync again immediately to test 429 cooldown response
    await page.locator('button:has-text("Sync")').first().click();

    // Verify second trigger-sync request sent (yielding 429)
    await expect.poll(() => syncCount).toBe(2);

    // Verify cooldown warning toast is visible
    await expect(page.locator("text=Sync cooldown active")).toBeVisible();
  });
});
