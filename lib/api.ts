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
  IsDraft: boolean;
  DraftOf: string | null;
  DraftID: string | null; // populated for owners when a draft exists
  ShareToken: string | null;
  Cards: Card[] | null;
  TestQuestions: TestQuestion[] | null;
  CreatedAt: string;
  UpdatedAt: string;
};

export type DraftBody = {
  title: string;
  description: string;
  is_public: boolean;
  cards: { id?: string; question: string; answer: string; image: string }[];
  test_questions: { id?: string; question: string; options: TestOption[]; image: string }[];
};

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

export type CardStats = {
  Correct: number;
  Incorrect: number;
  Streak: number;
  LastSeen: string | null;
};

export type Card = {
  ID: string;
  CollectionID: string;
  Question: string;
  Answer: string;
  Image: string;
  Position: number;
  Stats?: CardStats | null;
  CreatedAt: string;
  UpdatedAt: string;
};

export type TQStats = {
  Correct: number;
  Incorrect: number;
  Streak: number;
  LastSeen: string | null;
};

export type TestOption = {
  text: string;
  is_correct: boolean;
};

export type TestQuestion = {
  ID: string;
  CollectionID: string;
  Question: string;
  Options: TestOption[];
  Image: string;
  Position: number;
  Stats?: TQStats | null;
  CreatedAt: string;
  UpdatedAt: string;
};

export type StudyAnswer = {
  card_id?: string;
  tq_id?: string;
  correct: boolean;
};

export type DailyBucket = {
  date: string;
  correct: number;
  incorrect: number;
};

export type StudyHistoryData = {
  cards: Record<string, DailyBucket[]>;
  test_questions: Record<string, DailyBucket[]>;
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
  },
  follows: {
    follow: (collectionID: string) =>
      request<void>(`/collections/${collectionID}/follow`, { method: "POST" }),
    unfollow: (collectionID: string) =>
      request<void>(`/collections/${collectionID}/follow`, { method: "DELETE" }),
  },
  study: {
    submit: (collectionID: string, sessionID: string, answers: StudyAnswer[]) =>
      request<void>(`/collections/${collectionID}/study`, {
        method: "POST",
        body: JSON.stringify({ session_id: sessionID, answers }),
      }),
    history: (collectionID: string, days = 30) =>
      request<StudyHistoryData>(`/collections/${collectionID}/history?days=${days}`),
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
    add: (collectionID: string, question: string, answer: string, position: number) =>
      request<Card>(`/collections/${collectionID}/cards`, { method: "POST", body: JSON.stringify({ question, answer, position }) }),
    update: (collectionID: string, cardID: string, question: string, answer: string, position: number) =>
      request<Card>(`/collections/${collectionID}/cards/${cardID}`, { method: "PUT", body: JSON.stringify({ question, answer, position }) }),
    delete: (collectionID: string, cardID: string) =>
      request<void>(`/collections/${collectionID}/cards/${cardID}`, { method: "DELETE" }),
    import: (collectionID: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ imported: number }>(`/collections/${collectionID}/cards/import`, { method: "POST", body: form });
    },
    importText: (collectionID: string, text: string) => {
      const form = new FormData();
      form.append("file", new Blob([text], { type: "text/csv" }), "import.csv");
      return request<{ imported: number }>(`/collections/${collectionID}/cards/import`, { method: "POST", body: form });
    },
  },
  tests: {
    add: (collectionID: string, question: string, options: TestOption[], position: number) =>
      request<TestQuestion>(`/collections/${collectionID}/tests`, { method: "POST", body: JSON.stringify({ question, options, position }) }),
    update: (collectionID: string, tqID: string, question: string, options: TestOption[], position: number) =>
      request<TestQuestion>(`/collections/${collectionID}/tests/${tqID}`, { method: "PUT", body: JSON.stringify({ question, options, position }) }),
    delete: (collectionID: string, tqID: string) =>
      request<void>(`/collections/${collectionID}/tests/${tqID}`, { method: "DELETE" }),
  },
};
