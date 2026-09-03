import { describe, expect, test } from "bun:test";
import { draftLayout } from "./draft-layout.ts";

describe("draft layout", () => {
  test("uses four columns on a normal terminal", () => {
    expect(draftLayout(100, 8)).toEqual({ columns: 4, rows: 2, cardWidth: 24 });
  });

  test("falls back to fewer columns on narrow terminals", () => {
    expect(draftLayout(60, 8)).toEqual({ columns: 3, rows: 3, cardWidth: 19 });
  });

  test("never produces an empty grid", () => {
    expect(draftLayout(0, 0).rows).toBe(1);
    expect(draftLayout(0, 0).columns).toBe(4);
  });
});
