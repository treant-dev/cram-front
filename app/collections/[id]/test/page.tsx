"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { fromTests, type SessionItem } from "@/lib/session";
import StudySession from "@/components/StudySession";

export default function TestPage(props: PageProps<"/collections/[id]/test">) {
  const router = useRouter();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [collectionID, setCollectionID] = useState("");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    props.params.then(({ id }) => {
      setCollectionID(id);
      return api.collections.get(id);
    }).then((s) => setItems(fromTests(s.TestQuestions ?? []))).catch(() => setError("Failed to load collection"));
  }, [router, props.params]);

  return <StudySession items={items} collectionID={collectionID} doneTitle="Test complete!" error={error} />;
}
