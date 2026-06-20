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

    // Intercept api/health-data (as requested in prompt template)
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

    // Initially starts in Demo/Sample Mode
    await expect(page.locator('text="Demo"')).toBeVisible();

    // Toggle mode switch in the header to switch to Live mode
    const modeSwitch = page.locator('button[aria-pressed="false"]');
    await expect(modeSwitch).toBeVisible();
    await modeSwitch.click();

    // Mode label should switch to Live
    await expect(page.locator('text="Live"')).toBeVisible();

    // Check that Live data was successfully loaded (charts should be visible)
    await expect(page.locator('[data-testid="hrv-chart"]')).toBeVisible();
    
    // Verify that the distinctive live HRV value (123) is visible on the page (verifying it is real data, not mock)
    await expect(page.locator('text="123"')).toBeVisible();

    // Select custom preset on DateRangePicker and sync
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

    // Check that charts are still visible and updated after successful sync
    // Verify that at least one chart's container is non-empty (renders SVG)
    await expect(page.locator('[data-testid="hrv-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="hrv-chart"] .recharts-responsive-container')).toBeVisible();
    await expect(page.locator('[data-testid="hrv-chart"] svg.recharts-surface')).toBeVisible();

    // Trigger sync again immediately to test 429 cooldown response
    await syncButton.click();

    // Verify second trigger-sync request sent (yielding 429)
    await expect.poll(() => syncCount).toBe(2);

    // Verify cooldown warning toast is visible
    await expect(page.locator("text=Sync cooldown active")).toBeVisible();
  });
});
