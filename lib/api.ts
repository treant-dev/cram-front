const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

function token(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = token();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/";
    }
    throw new Error(`${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export type StudySet = {
  ID: string;
  UserID: string;
  Title: string;
  Description: string;
  Cards: Card[] | null;
  TestQuestions: TestQuestion[] | null;
  CreatedAt: string;
  UpdatedAt: string;
};

export type Card = {
  ID: string;
  SetID: string;
  Question: string;
  Answer: string;
  Position: number;
  CreatedAt: string;
  UpdatedAt: string;
};

export type TestOption = {
  text: string;
  is_correct: boolean;
};

export type TestQuestion = {
  ID: string;
  SetID: string;
  Question: string;
  Options: TestOption[];
  Position: number;
  CreatedAt: string;
  UpdatedAt: string;
};

export const api = {
  sets: {
    list: () => request<StudySet[]>("/sets"),
    get: (id: string) => request<StudySet>(`/sets/${id}`),
    create: (title: string, description: string) =>
      request<StudySet>("/sets", { method: "POST", body: JSON.stringify({ title, description }) }),
    update: (id: string, title: string, description: string) =>
      request<StudySet>(`/sets/${id}`, { method: "PUT", body: JSON.stringify({ title, description }) }),
    delete: (id: string) => request<void>(`/sets/${id}`, { method: "DELETE" }),
  },
  cards: {
    add: (setID: string, question: string, answer: string, position: number) =>
      request<Card>(`/sets/${setID}/cards`, { method: "POST", body: JSON.stringify({ question, answer, position }) }),
    update: (setID: string, cardID: string, question: string, answer: string, position: number) =>
      request<Card>(`/sets/${setID}/cards/${cardID}`, { method: "PUT", body: JSON.stringify({ question, answer, position }) }),
    delete: (setID: string, cardID: string) =>
      request<void>(`/sets/${setID}/cards/${cardID}`, { method: "DELETE" }),
    import: (setID: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ imported: number }>(`/sets/${setID}/cards/import`, {
        method: "POST",
        body: form,
        headers: {},
      });
    },
  },
  tests: {
    add: (setID: string, question: string, options: TestOption[], position: number) =>
      request<TestQuestion>(`/sets/${setID}/tests`, { method: "POST", body: JSON.stringify({ question, options, position }) }),
    update: (setID: string, tqID: string, question: string, options: TestOption[], position: number) =>
      request<TestQuestion>(`/sets/${setID}/tests/${tqID}`, { method: "PUT", body: JSON.stringify({ question, options, position }) }),
    delete: (setID: string, tqID: string) =>
      request<void>(`/sets/${setID}/tests/${tqID}`, { method: "DELETE" }),
  },
};
