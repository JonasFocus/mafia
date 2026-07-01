import { describe, expect, it } from "vitest";
import { ROOM_CODE_CHARS, ROOM_CODE_LENGTH, randomRoomCode } from "@/lib/game/actions";

describe("randomRoomCode", () => {
  it("generates a code of the expected length", () => {
    const code = randomRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
  });

  it("only uses characters from the unambiguous character set", () => {
    for (let i = 0; i < 200; i++) {
      const code = randomRoomCode();
      for (const char of code) {
        expect(ROOM_CODE_CHARS).toContain(char);
      }
    }
  });

  it("excludes visually ambiguous characters (0, O, 1, I)", () => {
    expect(ROOM_CODE_CHARS).not.toMatch(/[0O1I]/);
  });

  it("produces upper-case-only codes", () => {
    const code = randomRoomCode();
    expect(code).toBe(code.toUpperCase());
  });

  it("has enough entropy that 100 draws are not all identical", () => {
    // Not a strict randomness proof, but guards against a broken generator that
    // always returns the same code (e.g. a Math.random() call moved outside the loop).
    const codes = new Set(Array.from({ length: 100 }, () => randomRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
