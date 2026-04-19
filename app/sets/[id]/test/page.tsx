"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { fromTests, type SessionItem } from "@/lib/session";
import StudySession from "@/components/StudySession";

export default function TestPage(props: PageProps<"/sets/[id]/test">) {
  const router = useRouter();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [setID, setSetID] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    props.params.then(({ id }) => {
      setSetID(id);
      return api.sets.get(id);
    }).then((s) => setItems(fromTests(s.TestQuestions ?? [])));
  }, [router, props.params]);

  return <StudySession items={items} setID={setID} doneTitle="Test complete!" />;
}
