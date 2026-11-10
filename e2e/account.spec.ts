import { expect, test } from "@playwright/test";
import { login, PASSWORD, register, toast, unique } from "./helpers";

test("change password, then delete account", async ({ page }) => {
  const email = unique("lifecycle");
  await register(page, { name: "Lena Lifecycle", agency: "Lifecycle Studio", email });

  await page.goto("/app/settings");
  // wrong current password is rejected
  await page.fill("#currentPassword", "not-my-password");
  await page.fill("#newPassword", "Brand-New-Pass-1");
  await page.fill("#confirmPassword", "Brand-New-Pass-1");
  await page.getByRole("button", { name: "Change password" }).click();
  await toast(page, "current password is incorrect");
  // correct one works
  await page.fill("#currentPassword", PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await toast(page, "Password changed");

  // sign out, old password fails, new one works
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await toast(page, "Wrong email or password");
  await login(page, email, "Brand-New-Pass-1");

  // delete the account (sole owner -> workspace deleted too)
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#password").fill("wrong");
  await dialog.locator("#confirm").fill("DELETE");
  await dialog.getByRole("button", { name: "Permanently delete my account" }).click();
  await toast(page, "current password is incorrect");
  await dialog.locator("#password").fill("Brand-New-Pass-1");
  await dialog.getByRole("button", { name: "Permanently delete my account" }).click();
  await page.waitForURL("**/login?deleted=1");
  await expect(page.getByText("Your account has been deleted.")).toBeVisible();

  // can no longer sign in
  await page.fill("#email", email);
  await page.fill("#password", "Brand-New-Pass-1");
  await page.click("button[type=submit]");
  await toast(page, "Wrong email or password");
});

test("legal pages are linked and SEO files are served", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
  await page.goto("/register");
  await expect(page.getByRole("link", { name: "Terms of Service" })).toBeVisible();
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /app");
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  const og = await request.get("/opengraph-image");
  expect(og.headers()["content-type"]).toContain("image/png");
});
