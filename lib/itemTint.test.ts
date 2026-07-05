import { describe, it, expect } from "vitest";
import { itemTint } from "./itemTint";

describe("itemTint", () => {
  it("view mode is always neutral, regardless of draft status", () => {
    // The reported bug: a changed card stayed colored after publish (which exits
    // edit mode). In view mode nothing is tinted.
    expect(itemTint(false, "changed", false)).toBe("neutral");
    expect(itemTint(false, "added", false)).toBe("neutral");
    expect(itemTint(false, undefined, true)).toBe("neutral");
  });

  it("edit mode reflects draft status", () => {
    expect(itemTint(true, "added", false)).toBe("added");
    expect(itemTint(true, "changed", false)).toBe("changed");
    expect(itemTint(true, undefined, false)).toBe("neutral");
  });

  it("edit mode: deleted wins over status", () => {
    expect(itemTint(true, undefined, true)).toBe("deleted");
    expect(itemTint(true, "changed", true)).toBe("deleted");
  });
});
