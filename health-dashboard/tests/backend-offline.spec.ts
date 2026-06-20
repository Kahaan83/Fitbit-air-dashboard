import { test, expect } from "@playwright/test";

test.describe("Backend Offline Error States", () => {
  test.beforeEach(async ({ page }) => {
    // Abort all API requests to simulate backend being offline
    await page.route("**/api/**", (route) => {
      route.abort("failed");
    });
  });

  test("Loads successfully in sample mode, connect fails gracefully, showing retry option", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");

    // Dashboard should load in Sample Data Mode automatically even if backend is offline
    await expect(page.locator('h2:has-text("FITBIT AIR")')).toBeVisible();
    await expect(page.locator('[data-testid="whoop-ring-strain"]')).toBeVisible();

    // Click user profile button in the header to open settings panel
    const settingsBtn = page.locator('[data-testid="user-profile-button"]');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // The settings slide-over modal should open
    await expect(page.locator("text=Data Source")).toBeVisible();

    // Fill in required GCP credentials if empty, and baseline form fields
    const clientIdInput = page.locator('input[placeholder*="GCP Client ID"]');
    if (await clientIdInput.isVisible()) {
      await clientIdInput.fill("mock-client-id");
    }

    // Try to trigger live connection (fires POST /api/settings followed by /api/live-data)
    // The main submit button is "Connect to Google Health"
    const connectButton = page.locator('button:has-text("Connect to Google Health")');
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    // Since /api/settings aborts, it should catch the exception and display a toast error message
    await expect(page.locator("text=Could not connect to Google Health Gateway")).toBeVisible();

    // Verify it doesn't crash the page to a blank screen (modal and dashboard are still present)
    await expect(page.locator("text=Data Source")).toBeVisible();

    // Verify retry option (the Connect button is still visible and enabled to allow another attempt)
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toBeEnabled();
  });
});
