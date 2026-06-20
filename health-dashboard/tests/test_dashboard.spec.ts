import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

test("Dashboard renders all charts in Sample Data Mode", async ({ page }) => {
  // Go to localhost:3000
  await page.goto("http://localhost:3000");

  // Wait for page load
  await page.waitForLoadState("networkidle");

  // Verify FITBIT AIR app name is present
  await expect(page.locator('h2:has-text("FITBIT AIR")')).toBeVisible();

  // Verify Overview Whoop rings are present
  await expect(page.locator('[data-testid="whoop-ring-strain"]')).toBeVisible();
  await expect(page.locator('[data-testid="whoop-ring-recovery"]')).toBeVisible();
  await expect(page.locator('[data-testid="whoop-ring-sleep"]')).toBeVisible();

  // Navigate to Recovery tab (using the bottom navigation bar)
  await page.locator("nav").locator("text=Recovery").click();
  await page.waitForTimeout(500); // Wait for transition
  await expect(page.locator('[data-testid="ans-chart"]')).toBeVisible();
  await expect(page.locator('[data-testid="skin-temp-chart"]')).toBeVisible();

  // Navigate to Sleep tab
  await page.locator("nav").locator("text=Sleep").click();
  await page.waitForTimeout(500); // Wait for transition
  await expect(page.locator('[data-testid="spo2-chart"]')).toBeVisible();
  await expect(page.locator('[data-testid="sleep-debt-chart"]')).toBeVisible();

  // Ensure screenshot directory exists
  const screenshotDir = path.join(process.cwd(), "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Go back to overview
  await page.locator("nav").locator("text=Overview").click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: "screenshots/dashboard.png", fullPage: true });
  console.log("Screenshot saved at screenshots/dashboard.png");
});
