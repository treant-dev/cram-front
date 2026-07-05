import { describe, it, expect } from "vitest";
import { reorderNeighbours } from "./reorder";

const list = ["a", "b", "c", "d"];

describe("reorderNeighbours", () => {
  it("drops before a middle item → sits between its new neighbours", () => {
    // move d before b: a, [d], b, c  → between a and b
    expect(reorderNeighbours("d", "b", "before", list)).toEqual({ afterId: "a", beforeId: "b" });
  });

  it("drops after a middle item → sits between target and the next", () => {
    // move a after c: b, c, [a], d  → between c and d
    expect(reorderNeighbours("a", "c", "after", list)).toEqual({ afterId: "c", beforeId: "d" });
  });

  it("drops before the first item → open left edge", () => {
    // move c before a: [c], a, b, d  → afterId empty
    expect(reorderNeighbours("c", "a", "before", list)).toEqual({ afterId: "", beforeId: "a" });
  });

  it("drops after the last item → open right edge", () => {
    // move a after d: b, c, d, [a]  → beforeId empty
    expect(reorderNeighbours("a", "d", "after", list)).toEqual({ afterId: "d", beforeId: "" });
  });

  it("returns null when dropping onto itself", () => {
    expect(reorderNeighbours("b", "b", "before", list)).toBeNull();
  });

  it("returns null for an unknown target", () => {
    expect(reorderNeighbours("a", "z", "before", list)).toBeNull();
  });

  it("returns null for a no-op move (same slot)", () => {
    // b is already between a and c; dropping b after a changes nothing
    expect(reorderNeighbours("b", "a", "after", list)).toBeNull();
    // dropping b before c is the same slot
    expect(reorderNeighbours("b", "c", "before", list)).toBeNull();
  });
});
