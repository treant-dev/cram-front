const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("logged_in");
      window.location.href = "/";
    }
    throw new Error(`${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type Collection = {
  ID: string;
  UserID: string;
  Title: string;
  Description: string;
  IsPublic: boolean;
  DraftID: string | null; // populated for owners when a draft exists
  ShareToken: string | null;
  Cards: Card[] | null;
  TestQuestions: TestQuestion[] | null;
  Exercises: Exercise[] | null;
  Items?: Item[] | null; // raw unified items (with Rank) — used by the editor for ordering
  CreatedAt: string;
  UpdatedAt: string;
};

export type DraftBody = {
  title: string;
  description: string;
  is_public: boolean;
  cards: { id?: string; term: string; definition: string; image: string }[];
  test_questions: { id?: string; question: string; options: TestAnswer[]; image: string }[];
};

// Item is the unified content row (raw model), used by the granular draft API and diff.
export type Item = {
  ID: string;
  Type: string;
  CollectionID: string | null;
  ParentID: string | null;
  Content: Record<string, unknown>;
  Rank: string;
};

// DraftItemBody is the payload for staging one item (add/edit).
export type DraftItemBody = {
  type: string;
  parent_id?: string | null;
  content: Record<string, unknown>;
  rank?: string;
};

export type DraftDiffEntry = {
  ItemID: string;
  Type: string;
  Status: "added" | "changed" | "deleted";
  Before: Item | null; // published state (null when added)
  After: Item | null;  // staged result (null when deleted)
};

export type DraftDiff = { Entries: DraftDiffEntry[] };

export type PublicCollection = Collection & {
  FollowerCount: number;
  IsFollowed: boolean;
};

export type UserProfile = {
  ID: string;
  Name: string;
  Picture: string;
  Role: string;
  Collections: Collection[];
};

export type Card = {
  ID: string;
  CollectionID: string;
  Term: string;
  Definition: string;
  Image: string;
  Position: number;
  CreatedAt: string;
  UpdatedAt: string;
};

export type TestAnswer = {
  id?: string;
  text: string;
  is_correct: boolean;
  explanation?: string;
};

export type TestQuestion = {
  ID: string;
  CollectionID: string;
  Question: string;
  Options: TestAnswer[];
  Image: string;
  Position: number;
  CreatedAt: string;
  UpdatedAt: string;
};

// One prompt within an exercise. `text` contains one or more "___" blanks; `answer`
// holds the correct word for each blank in order. For "choice" exercises `distractors`
// holds the wrong option words per blank (`distractors[i]` for blank `i`).
export type ExerciseSentence = {
  id: string;
  text: string;
  answer: string[];
  distractors?: string[][]; // choice only: wrong options per blank (distractors[i] for blank i)
  position: number;
};

// Exercise is a discriminated union on Kind — each kind carries only its own fields.
type BaseExercise = {
  ID: string;
  CollectionID: string;
  Title: string;
  Position: number;
  CreatedAt: string;
  UpdatedAt: string;
};
export type BankExercise = BaseExercise & {
  Kind: "bank";
  Sentences: ExerciseSentence[];
  Distractors: string[] | null; // extra words for the shared pool
};
export type ChoiceExercise = BaseExercise & {
  Kind: "choice";
  Sentences: ExerciseSentence[];
};
export type QuizExercise = BaseExercise & {
  Kind: "quiz";
  Question: string; // multiple-choice question (a "test")
  Options: TestAnswer[];
};
export type Exercise = BankExercise | ChoiceExercise | QuizExercise;

export type ProgressEntry = {
  level: number;
  next_review_at: string;
  last_review_at?: string | null;
};

export type BlitzItem =
  | { type: "card"; card: Card }
  | { type: "tq"; tq: TestQuestion };

export type BlitzResponse = {
  items: BlitzItem[];
  card_pool: { ID: string; Term: string; Definition: string }[];
};

export type ProgressData = {
  cards: Record<string, ProgressEntry>;
  test_questions: Record<string, ProgressEntry>;
};

export type HomeData = {
  Own: Collection[];
  Following: Collection[];
};

export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  const data = await res.json();
  return data.url as string;
}

export const api = {
  auth: {
    me: () => request<{ id: string; email: string; role: string; picture: string }>("/auth/me"),
  },
  home: {
    get: () => request<HomeData>("/home"),
  },
  collections: {
    list: () => request<Collection[]>("/collections"),
    listPublic: () => request<PublicCollection[]>("/public/collections"),
    get: (id: string) => request<Collection>(`/collections/${id}`),
    getPublic: (id: string) => request<Collection>(`/public/collections/${id}`),
    create: (title: string, description: string, isPublic = false) =>
      request<Collection>("/collections", { method: "POST", body: JSON.stringify({ title, description, is_public: isPublic }) }),
    update: (id: string, title: string, description: string, isPublic: boolean) =>
      request<Collection>(`/collections/${id}`, { method: "PUT", body: JSON.stringify({ title, description, is_public: isPublic }) }),
    delete: (id: string) => request<void>(`/collections/${id}`, { method: "DELETE" }),
  },
  drafts: {
    getOrCreate: (collectionID: string) =>
      request<Collection>(`/collections/${collectionID}/draft`, { method: "POST" }),
    update: (collectionID: string, body: DraftBody) =>
      request<void>(`/collections/${collectionID}/draft`, { method: "PUT", body: JSON.stringify(body) }),
    discard: (collectionID: string) =>
      request<void>(`/collections/${collectionID}/draft`, { method: "DELETE" }),
    publish: (collectionID: string) =>
      request<void>(`/collections/${collectionID}/draft/publish`, { method: "POST" }),
    // Colored review of staged-but-unpublished changes.
    diff: (collectionID: string) =>
      request<DraftDiff>(`/collections/${collectionID}/draft/diff`),
    // Granular staging (one item at a time) — also the surface MCP tools reuse.
    addItem: (collectionID: string, item: DraftItemBody) =>
      request<Item>(`/collections/${collectionID}/draft/items`, { method: "POST", body: JSON.stringify(item) }),
    updateItem: (collectionID: string, itemID: string, item: DraftItemBody) =>
      request<Item>(`/collections/${collectionID}/draft/items/${itemID}`, { method: "PUT", body: JSON.stringify(item) }),
    deleteItem: (collectionID: string, itemID: string) =>
      request<void>(`/collections/${collectionID}/draft/items/${itemID}`, { method: "DELETE" }),
    revertItem: (collectionID: string, itemID: string) =>
      request<void>(`/collections/${collectionID}/draft/items/${itemID}/revert`, { method: "POST" }),
    // Reorder: place the item between two neighbors (either "" for a list end).
    moveItem: (collectionID: string, itemID: string, afterID: string, beforeID: string) =>
      request<void>(`/collections/${collectionID}/draft/items/${itemID}/move`, { method: "POST", body: JSON.stringify({ after_id: afterID, before_id: beforeID }) }),
  },
  follows: {
    follow: (collectionID: string) =>
      request<void>(`/collections/${collectionID}/follow`, { method: "POST" }),
    unfollow: (collectionID: string) =>
      request<void>(`/collections/${collectionID}/follow`, { method: "DELETE" }),
  },
  progress: {
    get: (collectionID: string) =>
      request<ProgressData>(`/collections/${collectionID}/progress`),
    update: (collectionID: string, itemType: "card" | "tq", itemID: string, correct: boolean, confidenceDelta: -1 | 0 | 1, retry = false) =>
      request<{ level: number; next_review_at: string }>(`/collections/${collectionID}/progress`, {
        method: "POST",
        body: JSON.stringify({ item_type: itemType, item_id: itemID, correct, confidence_delta: confidenceDelta, retry }),
      }),
    reset: (collectionID: string) =>
      request<void>(`/collections/${collectionID}/progress`, { method: "DELETE" }),
    resetCard: (collectionID: string, cardID: string) =>
      request<void>(`/collections/${collectionID}/cards/${cardID}/progress`, { method: "DELETE" }),
    resetTest: (collectionID: string, tqID: string) =>
      request<void>(`/collections/${collectionID}/tests/${tqID}/progress`, { method: "DELETE" }),
  },
  users: {
    list: () => request<UserProfile[]>("/users"),
  },
  account: {
    delete: () => request<void>("/account", { method: "DELETE" }),
  },
  share: {
    generate: (collectionID: string) =>
      request<{ token: string }>(`/collections/${collectionID}/share`, { method: "POST" }),
    revoke: (collectionID: string) =>
      request<void>(`/collections/${collectionID}/share`, { method: "DELETE" }),
    getByToken: (token: string) =>
      request<Collection>(`/shared/${token}`),
  },
  admin: {
    listUsers: () => request<UserProfile[]>("/admin/users"),
    setRole: (userID: string, role: string) =>
      request<void>(`/admin/users/${userID}/role`, { method: "PUT", body: JSON.stringify({ role }) }),
    deleteCollection: (collectionID: string) =>
      request<void>(`/admin/collections/${collectionID}`, { method: "DELETE" }),
  },
  cards: {
    add: (collectionID: string, term: string, definition: string, image: string, position: number) =>
      request<Card>(`/collections/${collectionID}/cards`, { method: "POST", body: JSON.stringify({ term, definition, image, position }) }),
    update: (collectionID: string, cardID: string, term: string, definition: string, position: number) =>
      request<Card>(`/collections/${collectionID}/cards/${cardID}`, { method: "PUT", body: JSON.stringify({ term, definition, position }) }),
    delete: (collectionID: string, cardID: string) =>
      request<void>(`/collections/${collectionID}/cards/${cardID}`, { method: "DELETE" }),
    import: (collectionID: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ imported: number; skipped: number }>(`/collections/${collectionID}/cards/import`, { method: "POST", body: form });
    },
    // Accepts a JSON or YAML list of {question, answer}. draft=true stages into the draft.
    importText: (collectionID: string, text: string, draft = false) => {
      const form = new FormData();
      form.append("file", new Blob([text], { type: "text/plain" }), "import.txt");
      return request<{ imported: number; skipped: number }>(`/collections/${collectionID}/cards/import${draft ? "?draft=true" : ""}`, { method: "POST", body: form });
    },
  },
  tests: {
    add: (collectionID: string, question: string, options: TestAnswer[], image: string, position: number) =>
      request<TestQuestion>(`/collections/${collectionID}/tests`, { method: "POST", body: JSON.stringify({ question, options, image, position }) }),
    update: (collectionID: string, tqID: string, question: string, options: TestAnswer[], position: number) =>
      request<TestQuestion>(`/collections/${collectionID}/tests/${tqID}`, { method: "PUT", body: JSON.stringify({ question, options, position }) }),
    delete: (collectionID: string, tqID: string) =>
      request<void>(`/collections/${collectionID}/tests/${tqID}`, { method: "DELETE" }),
    // Accepts a JSON or YAML list of {question, options:[{text, correct}]}. draft=true stages.
    importText: (collectionID: string, text: string, draft = false) => {
      const form = new FormData();
      form.append("file", new Blob([text], { type: "text/plain" }), "import.txt");
      return request<{ imported: number; skipped: number }>(`/collections/${collectionID}/tests/import${draft ? "?draft=true" : ""}`, { method: "POST", body: form });
    },
  },
  exercises: {
    // Import a YAML/JSON document (raw body). draft=true stages into the draft.
    importText: (collectionID: string, text: string, draft = false) =>
      request<{ imported: number; skipped: number }>(`/collections/${collectionID}/exercises/import${draft ? "?draft=true" : ""}`, {
        method: "POST",
        body: text,
        headers: { "Content-Type": "application/x-yaml" },
      }),
    delete: (collectionID: string, exID: string) =>
      request<void>(`/collections/${collectionID}/exercises/${exID}`, { method: "DELETE" }),
    // Save each answered sentence's words + correctness (one-off worksheets, no leveling).
    recordResults: (collectionID: string, results: { sentence_id: string; correct: boolean; submitted: string[] }[]) =>
      request<void>(`/collections/${collectionID}/exercises/results`, {
        method: "POST",
        body: JSON.stringify({ results }),
      }),
    // The user's saved answers, keyed by sentence id — used to restore worksheet state.
    getResults: (collectionID: string) =>
      request<Record<string, { correct: boolean; submitted: string[] }>>(`/collections/${collectionID}/exercises/results`),
    // Clear the user's own answers for one exercise (retake).
    resetExercise: (collectionID: string, exID: string) =>
      request<void>(`/collections/${collectionID}/exercises/${exID}/progress`, { method: "DELETE" }),
  },
  // Unified import: a JSON (or YAML) list of items each tagged with `type`
  // (card | quiz | exercise). draft=true stages into the draft.
  import: {
    items: (collectionID: string, text: string, draft = false) =>
      request<{ imported: number; skipped: number }>(`/collections/${collectionID}/import${draft ? "?draft=true" : ""}`, {
        method: "POST",
        body: text,
        headers: { "Content-Type": "application/json" },
      }),
  },
  blitz: {
    get: (collectionID: string) =>
      request<BlitzResponse>(`/collections/${collectionID}/blitz`),
  },
  ai: {
    suggestDefinition: (term: string) =>
      request<{ definition: string }>("/ai/suggest", { method: "POST", body: JSON.stringify({ term }) }),
  },
};
