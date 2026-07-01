import { describe, expect, it } from "vitest";
import { CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, getCategoryIcon } from "@/lib/game/category-icons";

describe("getCategoryIcon", () => {
  it("returns the mapped icon for a known category", () => {
    expect(getCategoryIcon("Sports")).toBe("⚽️");
  });

  it("returns the mapped icon for a category name containing spaces", () => {
    expect(getCategoryIcon("Fast Food")).toBe("🍟");
  });

  it("falls back to the default die icon for an unknown category", () => {
    expect(getCategoryIcon("Nonexistent Category")).toBe(DEFAULT_CATEGORY_ICON);
  });

  it("falls back to the default icon for an empty string", () => {
    expect(getCategoryIcon("")).toBe(DEFAULT_CATEGORY_ICON);
  });

  it("is case-sensitive (does not match differently-cased keys)", () => {
    expect(getCategoryIcon("sports")).toBe(DEFAULT_CATEGORY_ICON);
  });

  it("every value in the icon map is a non-empty string", () => {
    for (const [category, icon] of Object.entries(CATEGORY_ICONS)) {
      expect(icon.length, `icon for "${category}" should not be empty`).toBeGreaterThan(0);
    }
  });

  it("has no duplicate category keys colliding to an unexpected fallback", () => {
    // Sanity check: the map should have at least the known categories and all keys unique
    // (object literal keys are inherently unique, but this guards against silent typos like
    // trailing whitespace producing "different" keys that look identical).
    const keys = Object.keys(CATEGORY_ICONS);
    const trimmedKeys = new Set(keys.map((k) => k.trim()));
    expect(trimmedKeys.size).toBe(keys.length);
  });
});
