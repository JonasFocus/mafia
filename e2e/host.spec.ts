import { test, expect } from "@playwright/test";
import { collectPageErrors } from "./utils";

test.describe("Host page (/host)", () => {
  test("renders its initial UI without a backend, without crashing", async ({ page }) => {
    const errors = collectPageErrors(page);

    const response = await page.goto("/host");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Host a Game" })).toBeVisible();
    await expect(page.getByRole("button", { name: "chameleon" })).toBeVisible();
    await expect(page.getByRole("button", { name: "mafia" })).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByRole("button", { name: /create room/i })).toBeVisible();

    // No real Supabase backend is configured in this environment, so the categories
    // fetch resolves with nothing and "Create Room" correctly stays disabled rather
    // than crashing the page.
    await expect(page.getByRole("button", { name: /create room/i })).toBeDisabled();

    errors.assertNone();
  });
});
