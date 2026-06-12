"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { fromTests, type SessionItem } from "@/lib/session";
import StudySession from "@/components/StudySession";

export default function TestPage(props: PageProps<"/collections/[id]/test">) {
  const [items, setItems] = useState<SessionItem[]>([]);
  const [collectionID, setCollectionID] = useState("");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    props.params.then(({ id }) => {
      setCollectionID(id);
      return isLoggedIn() ? api.collections.get(id) : api.collections.getPublic(id);
    }).then((s) => setItems(fromTests(s.TestQuestions ?? []))).catch(() => setError("Failed to load collection"));
  }, [props.params]);

  return <StudySession items={items} collectionID={collectionID} doneTitle="Test complete!" error={error} requeueWrongCards />;
}
