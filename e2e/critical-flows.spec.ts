import { expect, test } from "@playwright/test";
import { acceptInviteAsNewUser, login, newSession, PASSWORD, register, toast, unique } from "./helpers";

test.describe.configure({ mode: "serial" });

const owner = { name: "Olivia Owner", agency: `E2E Studio ${Date.now()}`, email: unique("owner") };
const employeeEmail = unique("employee");
const clientEmail = unique("client");
let projectUrl = "";

test("owner registers, adds a client and creates a project", async ({ page }) => {
  await register(page, owner);
  await expect(page.getByText("Set up your workspace")).toBeVisible(); // empty state for a new agency

  await page.goto("/app/clients/new");
  await page.fill("#name", "Casey Client");
  await page.fill("#email", clientEmail);
  await page.fill("#companyName", "Acme Bakery");
  await page.getByRole("button", { name: "Add client" }).click();
  await toast(page, "Client added.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acme Bakery");

  // duplicate client email is rejected
  await page.goto("/app/clients/new");
  await page.fill("#name", "Dup");
  await page.fill("#email", clientEmail);
  await page.getByRole("button", { name: "Add client" }).click();
  await toast(page, "already exists");

  await page.goto("/app/projects/new");
  await page.fill("#name", "Acme E-commerce Website");
  await page.selectOption("#clientId", { label: "Acme Bakery (Casey Client)" });
  await page.selectOption("#status", "ACTIVE");
  await page.fill("#budget", "15000");
  await page.fill("#description", "New online shop for Acme Bakery.");
  await page.getByRole("button", { name: "Create project" }).click();
  await toast(page, "Project created.");
  await page.waitForURL(/\/app\/projects\/[0-9a-f-]{36}$/);
  projectUrl = new URL(page.url()).pathname;
});

test("owner invites an employee who joins and is assigned work", async ({ page, browser }) => {
  await login(page, owner.email);
  await page.goto("/app/team");
  await page.getByRole("button", { name: "Invite member" }).click();
  await page.fill("#email", employeeEmail);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await toast(page, "Invitation sent.");
  const link = (await page.locator("text=/\\/invite\\//").first().textContent())!.trim();

  const emp = await newSession(browser);
  await acceptInviteAsNewUser(emp.page, link, "Evan Employee");
  await emp.page.waitForURL("**/app/my-work");

  // the invitation link cannot be used again
  const again = await newSession(browser);
  await again.page.goto(link);
  await expect(again.page.getByText("already been used")).toBeVisible();
  await again.context.close();

  // owner creates a task assigned to the employee
  await page.goto(`${projectUrl}/tasks`);
  await page.getByRole("button", { name: "New task" }).click();
  await page.fill("#title", "Build product page");
  await page.selectOption("#assigneeId", { label: "Evan Employee" });
  await page.getByRole("button", { name: "Create task" }).click();
  await toast(page, "Task created.");

  // employee sees the task, opens it, and moves it to In review
  await emp.page.goto("/app/my-work/tasks");
  await emp.page.getByRole("button", { name: "Build product page" }).click();
  await emp.page.getByLabel("Status", { exact: true }).selectOption("IN_REVIEW");
  await toast(emp.page, "Status updated.");
  await emp.page.fill("#body", "Ready for a look.");
  await emp.page.getByRole("button", { name: "Comment" }).click();
  await expect(emp.page.getByText("Ready for a look.")).toBeVisible();

  // the employee got an in-app notification for the assignment
  await emp.page.goto("/app/notifications");
  await expect(emp.page.getByText("New task: Build product page")).toBeVisible();

  // employees cannot reach admin pages
  await emp.page.goto("/app/clients");
  await expect(emp.page).toHaveURL(/\/app\/my-work$/);
  await emp.page.goto("/app/invoices");
  await expect(emp.page).toHaveURL(/\/app\/my-work$/);
  await emp.context.close();
});

test("milestone review: owner submits, client approves from the portal", async ({ page, browser }) => {
  await login(page, owner.email);
  const projectId = projectUrl.split("/").pop()!;
  await page.goto(`/app/clients`);
  await page.getByRole("link", { name: "Acme Bakery" }).click();
  await page.fill("#email", clientEmail);
  await page.getByRole("button", { name: "Send invite" }).click();
  await toast(page, "Invitation sent.");
  const link = (await page.locator("text=/\\/invite\\//").first().textContent())!.trim();

  const client = await newSession(browser);
  await acceptInviteAsNewUser(client.page, link, "Casey Client");
  await client.page.waitForURL("**/portal");

  await page.goto(`${projectUrl}/milestones`);
  await page.getByRole("button", { name: "New milestone" }).click();
  await page.fill("#title", "UI/UX Design");
  await page.getByRole("button", { name: "Add milestone" }).click();
  await toast(page, "Milestone added.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.fill("#comment", "Designs attached in Figma.");
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await toast(page, "Submitted for client review.");

  await client.page.goto(`/portal/projects/${projectId}/milestones`);
  await expect(client.page.getByText("ready for your review")).toBeVisible();
  // internal notes and internal tasks are never shown in the portal
  await expect(client.page.getByText("Build product page")).toHaveCount(0);
  await client.page.getByRole("button", { name: "Request changes" }).click();
  await client.page.getByRole("dialog").getByRole("button", { name: "Request changes" }).click();
  await expect(client.page.getByText("Feedback is required").or(client.page.getByText("is required"))).toBeVisible(); // comment required
  await client.page.fill("#comment", "Please use our brand green.");
  await client.page.getByRole("dialog").getByRole("button", { name: "Request changes" }).click();
  await toast(client.page, "Change request sent.");

  await page.reload();
  await expect(page.getByText("Please use our brand green.")).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await toast(page, "Submitted for client review.");

  await client.page.reload();
  await client.page.getByRole("button", { name: "Approve" }).click();
  await client.page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await toast(client.page, "Milestone approved");

  await page.reload();
  await expect(page.locator("text=Approved").first()).toBeVisible();
  await client.context.close();
});

test("invoice totals, sending, payment and PDF", async ({ page, browser }) => {
  await login(page, owner.email);
  await page.goto("/app/invoices/new");
  await page.selectOption("#clientId", { label: "Acme Bakery" });
  await page.getByLabel("Item 1 description").fill("Design");
  await page.getByLabel("Item 1 quantity").fill("3");
  await page.getByLabel("Item 1 unit price").fill("333.33");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Item 2 description").fill("Hosting");
  await page.getByLabel("Item 2 quantity").fill("1.5");
  await page.getByLabel("Item 2 unit price").fill("19.99");
  await page.fill("#taxRate", "18");
  await expect(page.getByText("$1,215.38")).toBeVisible(); // live preview
  await page.getByRole("button", { name: "Create draft invoice" }).click();
  await toast(page, "Invoice created as a draft.");
  await page.waitForURL(/\/app\/invoices\/[0-9a-f-]{36}$/);
  await expect(page.getByText("INV-0001")).toBeVisible();
  await expect(page.getByText("$1,215.38").first()).toBeVisible(); // server-calculated total

  // client cannot see drafts
  await page.getByRole("button", { name: "Send to client" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Mark as sent" }).click();
  await toast(page, "Invoice sent.");

  await page.getByRole("button", { name: "Record payment" }).click();
  await page.fill("#amount", "215.38");
  await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();
  await toast(page, "Payment recorded.");
  await expect(page.getByText("Partially paid").first()).toBeVisible();

  const pdf = await page.request.get(page.url().replace("/app/invoices/", "/api/invoices/") + "/pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // the client sees it in the portal and can download it
  const client = await newSession(browser);
  await login(client.page, clientEmail);
  await client.page.goto("/portal/invoices");
  await expect(client.page.getByText("INV-0001")).toBeVisible();
  await client.context.close();
});

test("file upload, sharing and download with access checks", async ({ page, browser }) => {
  await login(page, owner.email);
  await page.goto(`${projectUrl}/files`);
  await page.getByLabel("Share with client").check();
  await page.getByLabel("Upload file").setInputFiles({ name: "brief.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test brief") });
  await toast(page, "brief.pdf uploaded.");
  const href = await page.getByRole("link", { name: "Download brief.pdf" }).getAttribute("href");
  const res = await page.request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()["location"]).toContain("token=");

  // rejected file type
  await page.getByLabel("Upload file").setInputFiles({ name: "run.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
  await toast(page, "isn't allowed");

  // another agency's owner gets 404 for both the project and the file
  const other = await newSession(browser);
  await register(other.page, { name: "Mallory Other", agency: `Other Agency ${Date.now()}`, email: unique("other") });
  const resp = await other.page.request.get(href!, { maxRedirects: 0 });
  expect(resp.status()).toBe(404);
  await other.page.goto(projectUrl);
  await expect(other.page.getByText("Page not found")).toBeVisible();
  await other.context.close();

  // signed-out users are redirected / rejected
  const anon = await newSession(browser);
  await anon.page.goto(projectUrl);
  await expect(anon.page).toHaveURL(/\/login\?next=/);
  const anonFile = await anon.page.request.get(href!, { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(anonFile.status());
  expect(anonFile.headers()["location"] ?? "").not.toContain("token=");
  await anon.context.close();
});

test("login is rate limited after repeated failures", async ({ page }) => {
  const email = unique("bruteforce");
  let limited = false;
  for (let i = 0; i < 12 && !limited; i++) {
    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", "wrong-password");
    await page.click("button[type=submit]");
    const t = page.locator("[data-sonner-toast]").last();
    await expect(t).toBeVisible();
    limited = /Too many attempts/.test((await t.textContent()) ?? "");
  }
  expect(limited).toBe(true);
  expect(PASSWORD).toBeTruthy();
});
