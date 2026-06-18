# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\test_dashboard.spec.ts >> Dashboard renders all charts in Sample Data Mode
- Location: tests\test_dashboard.spec.ts:5:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Sample Data')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('text=Sample Data')

```

```yaml
- banner:
  - text: Fitbit Air
  - navigation:
    - link "Overview":
      - /url: /
    - link "Recovery":
      - /url: /recovery
    - link "Sleep":
      - /url: /sleep
    - link "Raw Metrics":
      - /url: /raw
    - button "Settings"
  - text: "Last Sync: — Demo"
  - button "Click to toggle between Mock and Live Google Health API data"
- main:
  - heading "Physiological Overview" [level=1]
  - paragraph: Real-time biometric analytics, autonomic feedback, and acute stress signatures.
  - text: "Data Streams: Heart Rate"
  - button "Info about Heart Rate"
  - text: 72 bpm HRV
  - button "Info about Heart Rate Variability (HRV / RMSSD)"
  - text: 51 ms SpO2
  - button "Info about Blood Oxygen Saturation (SpO₂)"
  - text: 97.4% Skin Temp
  - button "Info about Sleep Skin Temperature Deviation"
  - text: +0.12°C Latest HRV (RMSSD)
  - button "Info about Latest HRV (RMSSD)"
  - text: 39.9 ms Suppressed Recovery Cardiovascular VO2 Max
  - button "Info about VO₂ Max (Cardiorespiratory Fitness)"
  - text: 51.29 ml/kg/min Good Fitness Zone Detected Stress Events
  - button "Info about Detected Acute Stress Events"
  - text: 11 events / 30d High Stress Load 7-day HRV avg
  - button "Info about 7-day HRV Average"
  - text: 51.3 ms Optimal Average Recovery score
  - button "Info about Recovery Score"
  - text: 68 / 100 Moderate Recovery Sleep efficiency
  - button "Info about Sleep Efficiency"
  - text: 93.1 % Good Efficiency Step goal rate
  - button "Info about Step Goal Hit Rate"
  - text: 63% days / 30 Needs Focus
  - heading "HRV Recovery Trend" [level=3]
  - button "Info about Heart Rate Variability (HRV / RMSSD)"
  - paragraph: Daily RMSSD (ms) — 30 Day History
  - text: Optimal (>50ms) Fatigued (<50ms)
  - application: 05/20 05/22 05/24 05/26 05/28 05/30 06/01 06/03 06/05 06/07 06/09 06/11 06/13 06/15 06/18 15 35 55 75 85 Baseline (50ms)
  - heading "VO2 Max Progression" [level=3]
  - button "Info about VO₂ Max (Cardiorespiratory Fitness)"
  - paragraph: Cardiovascular fitness level estimation (ml/kg/min)
  - text: Excellent (>52) Good (42–52)
  - application: 05/20 05/22 05/24 05/26 05/28 05/30 06/01 06/03 06/05 06/07 06/09 06/11 06/13 06/15 06/18 38 43 48 53 57
  - heading "Heart Rate Zones" [level=3]
  - button "Info about Heart Rate"
  - paragraph: Time distribution across physiological zones
  - application
  - text: Zone 1 (Rest) 45% Zone 2 (Fat Burn) 25% Zone 3 (Aerobic) 18% Zone 4 (Threshold) 9% Zone 5 (Max) 3%
  - heading "Acute Stress Heatmap" [level=3]
  - button "Info about Detected Acute Stress Events"
  - paragraph: Cross-references heart rate spikes against zero-movement intervals
  - text: 0 Events 1 Event 2 Events 3+ Events Sun Mon Tue Wed Thu Fri Sat
  - button "20"
  - button "21"
  - button "22 1"
  - button "23"
  - button "24"
  - button "25 1"
  - button "26"
  - button "27"
  - button "28 1"
  - button "29 2"
  - button "30 1"
  - button "31"
  - button "1 1"
  - button "2 1"
  - button "3"
  - button "4"
  - button "5"
  - button "6"
  - button "7 1"
  - button "8"
  - button "9"
  - button "10"
  - button "11 1"
  - button "12"
  - button "13"
  - button "14"
  - button "15"
  - button "16 1"
  - button "17"
  - button "18"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import * as fs from 'fs';
  3  | import * as path from 'path';
  4  | 
  5  | test('Dashboard renders all charts in Sample Data Mode', async ({ page }) => {
  6  |   // Go to localhost:3000
  7  |   await page.goto('http://localhost:3000');
  8  |   
  9  |   // Wait for page load
  10 |   await page.waitForLoadState('networkidle');
  11 | 
  12 |   // Verify Sample Data mode badge is present
> 13 |   await expect(page.locator('text=Sample Data')).toBeVisible();
     |                                                  ^ Error: expect(locator).toBeVisible() failed
  14 | 
  15 |   // Overview tab
  16 |   await expect(page.locator('[data-testid="hrv-chart"]')).toBeVisible();
  17 |   await expect(page.locator('[data-testid="vo2-chart"]')).toBeVisible();
  18 |   await expect(page.locator('[data-testid="hr-zone-chart"]')).toBeVisible();
  19 |   await expect(page.locator('[data-testid="stress-heatmap"]')).toBeVisible();
  20 | 
  21 |   // Recovery tab
  22 |   await page.click('text=Recovery');
  23 |   await page.waitForTimeout(500); // Wait for transition
  24 |   await expect(page.locator('[data-testid="ans-chart"]')).toBeVisible();
  25 |   await expect(page.locator('[data-testid="skin-temp-chart"]')).toBeVisible();
  26 | 
  27 |   // Sleep tab
  28 |   await page.click('text=Sleep');
  29 |   await page.waitForTimeout(500); // Wait for transition
  30 |   await expect(page.locator('[data-testid="spo2-chart"]')).toBeVisible();
  31 |   await expect(page.locator('[data-testid="sleep-debt-chart"]')).toBeVisible();
  32 | 
  33 |   // Ensure screenshot directory exists
  34 |   const screenshotDir = path.join(process.cwd(), 'screenshots');
  35 |   if (!fs.existsSync(screenshotDir)) {
  36 |     fs.mkdirSync(screenshotDir, { recursive: true });
  37 |   }
  38 | 
  39 |   // Back to overview for visual beauty
  40 |   await page.click('text=Overview');
  41 |   await page.waitForTimeout(500);
  42 |   
  43 |   await page.screenshot({ path: 'screenshots/dashboard.png', fullPage: true });
  44 |   console.log("Screenshot saved at screenshots/dashboard.png");
  45 | });
  46 | 
```