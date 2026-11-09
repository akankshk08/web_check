import { expect, type Browser, type Page } from "@playwright/test";

export const PASSWORD = "E2e-Password-123";
export const unique = (label: string) => `${label}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@e2e.test`;

export async function register(page: Page, { name, agency, email }: { name: string; agency: string; email: string }) {
  await page.goto("/register");
  await page.fill("#fullName", name);
  await page.fill("#agencyName", agency);
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL("**/app");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name.split(" ")[0]!);
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Opens a fresh, signed-out browser context. */
export async function newSession(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

/** Sign up through an invitation link shown in the UI. */
export async function acceptInviteAsNewUser(page: Page, link: string, name: string) {
  await page.goto(link);
  await page.fill("#fullName", name);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Create account & join" }).click();
}

export async function toast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}
