import { expect, test } from "@playwright/test";
import { login, PASSWORD, toast, unique } from "./helpers";

test("submitting the register form while already signed in still works (no redirect of form posts)", async ({ context }) => {
  const stale = await context.newPage();
  await stale.goto("/register"); // page loaded before signing in

  const other = await context.newPage();
  await other.goto("/register");
  await other.fill("#fullName", "First Account");
  await other.fill("#agencyName", "First Agency");
  await other.fill("#email", unique("first"));
  await other.fill("#password", PASSWORD);
  await other.click("button[type=submit]");
  await other.waitForURL("**/app");

  // the old tab now has a signed-in session cookie; its form must still get a proper response
  await stale.fill("#fullName", "Second Account");
  await stale.fill("#agencyName", "Second Agency");
  await stale.fill("#email", unique("second"));
  await stale.fill("#password", PASSWORD);
  await stale.click("button[type=submit]");
  await stale.waitForURL("**/app");
  await expect(stale.getByText("Second Agency").first()).toBeVisible();
});

test("a signed-in user without a workspace can create one", async ({ page, request }) => {
  const email = unique("orphan");
  // Create a login account directly in Supabase Auth, without an AgencyOS workspace.
  const res = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    data: { email, password: PASSWORD, data: { full_name: "Orphan User" } },
  });
  expect(res.ok()).toBe(true);

  await login(page, email);
  await page.waitForURL("**/no-workspace");
  await page.fill("#agencyName", "Recovered Agency");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await toast(page, "Workspace created.");
  await page.waitForURL("**/app");
  await expect(page.getByText("Recovered Agency").first()).toBeVisible();
});
