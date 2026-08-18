import { describe, it, expect } from "vitest";
import type { BlitzItem, Card } from "./api";
import {
  MAX_OPTIONS, ROUND_SIZE, STAGES,
  buildOptions, cramReducer, eligibleCards, finishedCount, gradeWritten,
  initialCramState, normalizeAnswer, acceptedAnswers, roundSummary, roundVerdict, score, stepCard,
  type CramAction, type CramCard, type CramState, type PoolEntry,
} from "./cram";

function card(p: Partial<Card>): Card {
  return {
    ID: "1", CollectionID: "c", Term: "term", Definition: "definition", Hint: "", Image: "",
    Position: 0, CreatedAt: "", UpdatedAt: "", ...p,
  } as Card;
}

const item = (p: Partial<Card>): BlitzItem => ({ type: "card", card: card(p) });

/** A generator that is not the clock, so a shuffle is the same shuffle every run. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const cramCard = (n: number): CramCard => ({
  id: `c${n}`, term: `term${n}`, definition: `definition ${n}`, hint: "", image: "",
});

const poolOf = (cards: CramCard[]): PoolEntry[] =>
  cards.map((c) => ({ ID: c.id, Term: c.term, Definition: c.definition }));

function start(cards: CramCard[], pool = poolOf(cards)): CramState {
  return cramReducer(initialCramState(), { type: "init", cards, pool, rand: seeded() });
}

function apply(state: CramState, actions: CramAction[]): CramState {
  return actions.reduce(cramReducer, state);
}

/** Plays a whole round, answering by `wrong(cardID, stage, seenSoFar)`. */
function play(state: CramState, wrong: (cardID: string, stage: string, step: number) => boolean) {
  const trail: { cardID: string; stage: string; right: boolean }[] = [];
  let s = state;
  while (!s.done && trail.length < 100) {
    const step = s.step!;
    const right = !wrong(step.cardID, step.stage, trail.length);
    trail.push({ cardID: step.cardID, stage: step.stage, right });
    s = apply(s, [{ type: "answer", verdict: right ? "right" : "wrong" }, { type: "next" }]);
  }
  return { state: s, trail };
}

describe("eligibleCards", () => {
  it("keeps only cards a round can actually ask", () => {
    const cards = eligibleCards([
      item({ ID: "ok", Term: "goroutine", Definition: "a lightweight thread" }),
      item({ ID: "no-term", Term: "   ", Definition: "d" }),
      item({ ID: "no-def", Term: "t", Definition: "" }),
      item({ ID: "letterless", Term: "42", Definition: "the answer" }),
      item({ ID: "long", Term: "a".repeat(25), Definition: "d" }),
      item({ ID: "edge", Term: "a".repeat(24), Definition: "d" }),
    ]);
    expect(cards.map((c) => c.id)).toEqual(["ok", "edge"]);
  });

  it("takes at most a round's worth", () => {
    const many = Array.from({ length: 7 }, (_, i) => item({ ID: `c${i}`, Term: `t${i}`, Definition: `d${i}` }));
    expect(eligibleCards(many)).toHaveLength(ROUND_SIZE);
  });
});

describe("buildOptions", () => {
  const round = [cramCard(1), cramCard(2)];
  const pool = poolOf(Array.from({ length: 10 }, (_, i) => cramCard(i)));

  it("offers the term among other terms, and the definition among other definitions", () => {
    const recall = buildOptions(round[0], pool, "recall", seeded());
    expect(recall).toHaveLength(MAX_OPTIONS);
    expect(recall.filter((o) => o.isCorrect).map((o) => o.text)).toEqual([round[0].term]);
    expect(recall.every((o) => o.text.startsWith("term"))).toBe(true);

    const produce = buildOptions(round[0], pool, "produce", seeded());
    expect(produce.filter((o) => o.isCorrect).map((o) => o.text)).toEqual([round[0].definition]);
    expect(produce.every((o) => o.text.startsWith("definition"))).toBe(true);
  });

  it("draws distractors from the whole collection, not just the round", () => {
    const options = buildOptions(round[0], pool, "recall", seeded());
    const outsiders = options.filter((o) => !round.some((c) => c.term === o.text));
    expect(outsiders.length).toBeGreaterThan(0);
  });

  it("never repeats a text and never runs short of a correct answer", () => {
    const twins = [
      { ID: "a", Term: "run", Definition: "to move fast" },
      { ID: "b", Term: "Run", Definition: "to move fast" },
      { ID: "c", Term: "walk", Definition: "to move slowly" },
    ];
    const options = buildOptions(cramCard(1), twins, "recall", seeded());
    const keys = options.map((o) => o.text.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
    expect(options.filter((o) => o.isCorrect)).toHaveLength(1);
  });

  it("has nothing to offer at the written stages", () => {
    expect(buildOptions(round[0], pool, "build", seeded())).toEqual([]);
    expect(buildOptions(round[0], pool, "write", seeded())).toEqual([]);
  });
});

describe("a clean round", () => {
  const cards = [cramCard(1), cramCard(2), cramCard(3), cramCard(4)];

  it("asks every card at one stage before moving to the next", () => {
    const { state, trail } = play(start(cards), () => false);
    expect(trail).toHaveLength(cards.length * STAGES.length);
    for (const [i, stage] of STAGES.entries()) {
      const slice = trail.slice(i * cards.length, (i + 1) * cards.length);
      expect(slice.every((t) => t.stage === stage)).toBe(true);
      expect(new Set(slice.map((t) => t.cardID)).size).toBe(cards.length);
    }
    expect(state.done).toBe(true);
    expect(score(state)).toBe(cards.length);
  });

  it("reports every card as a plain correct answer", () => {
    const { state } = play(start(cards), () => false);
    expect(state.emit).toEqual(cards.map((c) => ({ cardID: c.id, correct: true })));
  });
});

describe("a failure", () => {
  const cards = [cramCard(1), cramCard(2), cramCard(3), cramCard(4)];
  const failOnce = (id: string, stage: string) => {
    let spent = false;
    return (cardID: string, s: string) => {
      if (cardID !== id || s !== stage || spent) return false;
      spent = true;
      return true;
    };
  };

  it("drops the card back one stage, and it waits for the retry phase", () => {
    const { trail } = play(start(cards), failOnce("c1", "write"));
    const c1 = trail.filter((t) => t.cardID === "c1").map((t) => t.stage);
    expect(c1).toEqual(["recall", "produce", "build", "write", "build", "write"]);
    // The failed step is not repeated on the spot: the rest of the stage runs first.
    const failedAt = trail.findIndex((t) => t.cardID === "c1" && !t.right);
    expect(trail[failedAt + 1].cardID).not.toBe("c1");
  });

  it("keeps a card that fails the first stage on the first stage", () => {
    const { trail } = play(start(cards), failOnce("c2", "recall"));
    const c2 = trail.filter((t) => t.cardID === "c2").map((t) => t.stage);
    expect(c2).toEqual(["recall", "recall", "produce", "build", "write"]);
  });

  it("costs the card its clean sheet but not the round", () => {
    const { state } = play(start(cards), failOnce("c1", "build"));
    expect(state.done).toBe(true);
    expect(score(state)).toBe(cards.length - 1);
    expect(finishedCount(state)).toBe(cards.length);
  });
});

describe("progress reports", () => {
  const cards = [cramCard(1), cramCard(2)];
  const failWhile = (id: string, stage: string, times: number) => {
    let left = times;
    return (cardID: string, s: string) => {
      if (cardID !== id || s !== stage || left <= 0) return false;
      left--;
      return true;
    };
  };

  it("grades a card that failed the first stage", () => {
    const { state } = play(start(cards), failWhile("c1", "recall", 1));
    expect(state.emit).toContainEqual({ cardID: "c1", correct: false });
  });

  it("says nothing about a card that only faltered at a later stage", () => {
    const { state } = play(start(cards), failWhile("c1", "build", 1));
    expect(state.emit.map((e) => e.cardID)).toEqual(["c2"]);
  });

  it("never reports the same card twice", () => {
    const messy = play(start(cards), failWhile("c1", "recall", 1));
    const ids = messy.state.emit.map((e) => e.cardID);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(["c1", "c2"]);
  });

  it("clears what the page has posted", () => {
    const { state } = play(start(cards), () => false);
    expect(cramReducer(state, { type: "drain" }).emit).toEqual([]);
  });
});

describe("the safety valve", () => {
  const cards = [cramCard(1), cramCard(2), cramCard(3), cramCard(4)];

  it("drops a card out of the round on its second failure", () => {
    const { state, trail } = play(start(cards), (cardID) => cardID === "c1");
    expect(trail.filter((t) => t.cardID === "c1")).toHaveLength(2);
    expect(state.done).toBe(true);
    expect(score(state)).toBe(cards.length - 1);
  });

  it("bounds a round at 24 steps however badly it goes", () => {
    const alwaysWrong = play(start(cards), () => true);
    expect(alwaysWrong.trail).toHaveLength(8); // two failures each, then out
    const worstCase = play(start(cards), (_, stage, step) => stage === "write" || step % 3 === 0);
    expect(worstCase.trail.length).toBeLessThanOrEqual(24);
    expect(worstCase.state.done).toBe(true);
  });
});

describe("cramReducer guards", () => {
  const state = start([cramCard(1), cramCard(2)]);

  it("ignores a second answer while the verdict is on screen", () => {
    const answered = cramReducer(state, { type: "answer", verdict: "wrong" });
    const again = cramReducer(answered, { type: "answer", verdict: "wrong" });
    expect(again).toBe(answered);
    expect(again.cards[0].failures).toBe(1);
  });

  it("ignores a step forward before the answer is in", () => {
    expect(cramReducer(state, { type: "next" })).toBe(state);
  });

  it("counts a tolerated typo as a pass", () => {
    const answered = cramReducer(state, { type: "answer", verdict: "close" });
    expect(answered.cards[0].failures).toBe(0);
    expect(answered.cards[0].stage).toBe(1);
  });

  it("is done before it starts when nothing is eligible", () => {
    const empty = cramReducer(initialCramState(), { type: "init", cards: [], pool: [] });
    expect(empty.done).toBe(true);
    expect(empty.step).toBeNull();
  });
});

describe("roundVerdict", () => {
  it("grades the round it was", () => {
    expect(roundVerdict(4, 4).emoji).toBe("🎉");
    expect(roundVerdict(3, 4).emoji).toBe("👏");
    expect(roundVerdict(2, 4).emoji).toBe("🙂");
    expect(roundVerdict(1, 4).emoji).toBe("💪");
    expect(roundVerdict(0, 4).emoji).toBe("💪");
  });
});

describe("normalizeAnswer", () => {
  it("keeps the word and drops everything else", () => {
    expect(normalizeAnswer("  Löffel! ")).toBe("loffel");
    expect(normalizeAnswer("well-known")).toBe("well known");
    expect(normalizeAnswer("a   lightweight  thread")).toBe("a lightweight thread");
  });
});

describe("acceptedAnswers", () => {
  it("takes either side of an alternative, and a parenthetical either way", () => {
    expect(acceptedAnswers("lift / elevator").sort()).toEqual(["elevator", "lift"]);
    expect(acceptedAnswers("(to) run").sort()).toEqual(["run", "to run"]);
  });
});

describe("gradeWritten", () => {
  it("passes the word however it was capitalised or accented", () => {
    expect(gradeWritten("GOROUTINE", "goroutine")).toBe("right");
    expect(gradeWritten("loffel", "Löffel")).toBe("right");
    expect(gradeWritten("elevator", "lift / elevator")).toBe("right");
    expect(gradeWritten("run", "(to) run")).toBe("right");
  });

  it("forgives a typo but says so", () => {
    expect(gradeWritten("gorotine", "goroutine")).toBe("close");
    expect(gradeWritten("goruotine", "goroutine")).toBe("close");
  });

  it("refuses a different word, and anything starting elsewhere", () => {
    expect(gradeWritten("channel", "goroutine")).toBe("wrong");
    expect(gradeWritten("", "goroutine")).toBe("wrong");
    expect(gradeWritten("hun", "fun")).toBe("wrong");
  });
});

describe("roundSummary", () => {
  const cards = [cramCard(1), cramCard(2), cramCard(3), cramCard(4)];

  it("marks every card with what became of it", () => {
    let failedOnce = false;
    const { state } = play(start(cards), (cardID, stage) => {
      if (cardID === "c1") return true;                       // twice wrong → out of the round
      if (cardID === "c2" && stage === "build" && !failedOnce) { failedOnce = true; return true; }
      return false;
    });
    const summary = roundSummary(state);
    expect(summary.map((r) => r.card.id)).toEqual(cards.map((c) => c.id));
    expect(summary.map((r) => r.outcome)).toEqual(["failed", "shaky", "clean", "clean"]);
    expect(summary[0].card.term).toBe("term1");
    expect(summary[0].card.definition).toBe("definition 1");
  });
});

describe("buildOptions with little to hide the answer among", () => {
  it("offers what there is rather than padding the list", () => {
    const only = [{ ID: "other", Term: "walk", Definition: "to move slowly" }];
    const two = buildOptions(cramCard(1), only, "recall", seeded());
    expect(two).toHaveLength(2);
    expect(two.filter((o) => o.isCorrect)).toHaveLength(1);

    const alone = buildOptions(cramCard(1), [], "recall", seeded());
    expect(alone.map((o) => o.text)).toEqual([cramCard(1).term]);
  });
});

describe("stepCard", () => {
  it("hands back the card the live step belongs to", () => {
    const state = start([cramCard(1), cramCard(2)]);
    expect(stepCard(state)?.id).toBe(state.step!.cardID);
    expect(stepCard(initialCramState())).toBeNull();
  });
});

describe("eligibleCards carries the card over whole", () => {
  it("keeps the hint and the image, and honours a smaller round", () => {
    const cards = eligibleCards([
      item({ ID: "a", Term: "goroutine", Definition: "a thread", Hint: "think green", Image: "pic.png" }),
      item({ ID: "b", Term: "channel", Definition: "a pipe" }),
    ], 1);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({ id: "a", term: "goroutine", definition: "a thread", hint: "think green", image: "pic.png" });
  });
});

describe("roundVerdict on a short round", () => {
  it("reads the score against the round that was actually played", () => {
    expect(roundVerdict(2, 2).emoji).toBe("\u{1F389}");
    expect(roundVerdict(1, 2).emoji).toBe("\u{1F44F}");
    expect(roundVerdict(0, 2).emoji).toBe("\u{1F4AA}");
    expect(roundVerdict(0, 0).emoji).toBe("\u{1F44F}");
  });
});

describe("gradeWritten scales its patience with the word", () => {
  it("forgives two slips in a long word but only one in a short one", () => {
    expect(gradeWritten("dilligennt", "diligent")).toBe("close");   // 8 letters, two edits
    expect(gradeWritten("dilligennts", "diligent")).toBe("wrong");  // three edits
    expect(gradeWritten("fesable", "feasible")).toBe("close");
    expect(gradeWritten("cnie", "concise")).toBe("wrong");
  });

  it("reads spacing, case and punctuation as the same answer", () => {
    expect(gradeWritten("  Well—Known  ", "well known")).toBe("right");
    expect(gradeWritten("no longer used; out of date", "No longer used; out of date")).toBe("right");
  });
});
