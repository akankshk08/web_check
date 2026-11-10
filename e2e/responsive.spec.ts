import { expect, test } from "@playwright/test";

test("marketing and login pages fit a phone screen without horizontal scrolling", async ({ page }) => {
  for (const path of ["/", "/features", "/pricing", "/login", "/register"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
