"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { fromCards, type SessionItem } from "@/lib/session";
import StudySession from "@/components/StudySession";

export default function CardsTestPage(props: PageProps<"/collections/[id]/cards-test">) {
  const router = useRouter();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [collectionID, setCollectionID] = useState("");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    props.params.then(({ id }) => {
      setCollectionID(id);
      return api.collections.get(id);
    }).then((s) => setItems(fromCards(s.Cards ?? []))).catch(() => setError("Failed to load collection"));
  }, [router, props.params]);

  return <StudySession items={items} collectionID={collectionID} doneTitle="Done!" error={error} />;
}
