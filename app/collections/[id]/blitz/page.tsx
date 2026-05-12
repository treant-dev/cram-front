"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { fromBlitz, type SessionItem } from "@/lib/session";
import StudySession from "@/components/StudySession";

export default function BlitzPage(props: PageProps<"/collections/[id]/blitz">) {
  const router = useRouter();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [collectionID, setCollectionID] = useState("");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    props.params.then(({ id }) => {
      setCollectionID(id);
      return api.blitz.get(id);
    }).then((result) => setItems(fromBlitz(result))).catch(() => setError("Failed to load blitz"));
  }, [router, props.params]);

  return <StudySession items={items} collectionID={collectionID} doneTitle="Blitz complete!" error={error} />;
}
