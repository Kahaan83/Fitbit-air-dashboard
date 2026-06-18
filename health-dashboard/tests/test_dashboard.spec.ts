import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('Dashboard renders all charts in Sample Data Mode', async ({ page }) => {
  // Go to localhost:3000
  await page.goto('http://localhost:3000');
  
  // Wait for page load
  await page.waitForLoadState('networkidle');

  // Verify Sample Data mode badge is present
  await expect(page.locator('text=Sample Data')).toBeVisible();

  // Overview tab
  await expect(page.locator('[data-testid="hrv-chart"]')).toBeVisible();
  await expect(page.locator('[data-testid="vo2-chart"]')).toBeVisible();
  await expect(page.locator('[data-testid="hr-zone-chart"]')).toBeVisible();
  await expect(page.locator('[data-testid="stress-heatmap"]')).toBeVisible();

  // Recovery tab
  await page.click('text=Recovery');
  await page.waitForTimeout(500); // Wait for transition
  await expect(page.locator('[data-testid="ans-chart"]')).toBeVisible();
  await expect(page.locator('[data-testid="skin-temp-chart"]')).toBeVisible();

  // Sleep tab
  await page.click('text=Sleep');
  await page.waitForTimeout(500); // Wait for transition
  await expect(page.locator('[data-testid="spo2-chart"]')).toBeVisible();
  await expect(page.locator('[data-testid="sleep-debt-chart"]')).toBeVisible();

  // Ensure screenshot directory exists
  const screenshotDir = path.join(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // Back to overview for visual beauty
  await page.click('text=Overview');
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: 'screenshots/dashboard.png', fullPage: true });
  console.log("Screenshot saved at screenshots/dashboard.png");
});
