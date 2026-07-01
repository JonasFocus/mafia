import { test, expect } from "@playwright/test";
import { collectPageErrors } from "./utils";

test.describe("Home page (/)", () => {
  test("renders without a backend and without crashing", async ({ page }) => {
    const errors = collectPageErrors(page);

    const response = await page.goto("/");
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Mafia", level: 1 })).toBeVisible();
    await expect(
      page.getByText("Everyone knows the word. One of you is bluffing.", { exact: false }),
    ).toBeVisible();

    const hostLink = page.getByRole("link", { name: "Host a Game" });
    const joinLink = page.getByRole("link", { name: "Join a Game" });
    await expect(hostLink).toBeVisible();
    await expect(joinLink).toBeVisible();
    await expect(hostLink).toHaveAttribute("href", "/host");
    await expect(joinLink).toHaveAttribute("href", "/join");

    errors.assertNone();
  });
});
