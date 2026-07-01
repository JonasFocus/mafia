import { test, expect } from "@playwright/test";
import { collectPageErrors } from "./utils";

test.describe("Join page (/join)", () => {
  test("renders its initial UI without a backend, without crashing", async ({ page }) => {
    const errors = collectPageErrors(page);

    const response = await page.goto("/join");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Join a Game" })).toBeVisible();
    await expect(page.getByLabel("Room code")).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByRole("button", { name: /join room/i })).toBeVisible();

    errors.assertNone();
  });
});
