import { test, expect } from "@playwright/test";

test("investigate failure, verify correction, preserve history, and export evidence", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page).toHaveTitle("AgentOps");
  await expect(page.getByRole("heading", { name: "Trust the evidence." })).toBeVisible();
  const baselineResponse = page.waitForResponse(response => response.url().endsWith("/api/investigations") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Run baseline investigation" }).click();
  const baseline = await (await baselineResponse).json();
  await expect(page).toHaveURL(new RegExp(`attempt=${baseline.id}`));
  await expect(page.getByText("5 of 7 independent checks passed", { exact: true })).toBeVisible();
  await expect(page.getByText("Regression detected", { exact: true })).toBeVisible();
  const baselineUrl = page.url();
  await page.screenshot({ path: testInfo.outputPath("baseline.png"), fullPage: true });

  await page.getByRole("tab", { name: "Candidate code" }).click();
  await expect(page.locator(".lab-code")).toContainText("subtotalCents >= 5000");
  await page.getByRole("tab", { name: "Exact inputs" }).click();
  await expect(page.getByRole("heading", { name: "Acceptance contract" })).toBeVisible();

  await page.getByRole("button", { name: "Try corrected instructions" }).click();
  await expect(page.getByText("7 of 7 independent checks passed", { exact: true })).toBeVisible();
  await expect(page.getByText("5/7 → 7/7 checks passed", { exact: true })).toBeVisible();
  const correctedUrl = page.url();
  await page.screenshot({ path: testInfo.outputPath("correction.png"), fullPage: true });
  await page.getByRole("tab", { name: "Candidate code" }).click();
  await expect(page.locator(".lab-code")).toHaveCount(2);
  await expect(page.locator(".lab-code").last()).toContainText("subtotalCents - discountCents");
  await page.getByRole("tab", { name: "Candidate code" }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Exact inputs" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Exact inputs" })).toHaveAttribute("aria-selected", "true");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const stream = await (await downloadPromise).createReadStream();
  let content = "";
  for await (const chunk of stream) content += chunk;
  const exported = JSON.parse(content);
  expect(exported.verification).toBe("passed");
  expect(exported.parentId).toBe(baseline.id);
  expect(exported.checks).toHaveLength(7);

  await page.reload();
  await expect(page.getByText("7 of 7 independent checks passed", { exact: true })).toBeVisible();
  await page.goto(baselineUrl);
  await expect(page.getByText("5 of 7 independent checks passed", { exact: true })).toBeVisible();
  await page.goto(correctedUrl);
  await expect(page.getByText("7 of 7 independent checks passed", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("API failure is visible and retry restores the screen", async ({ page }) => {
  await page.route("**/api/investigations/scenario", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Temporarily unavailable" } }) }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Temporarily unavailable");
  await page.unroute("**/api/investigations/scenario");
  await page.getByRole("button", { name: "Retry loading" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run baseline investigation" })).toBeEnabled();
});
