"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { fromMix, type SessionItem } from "@/lib/session";
import StudySession from "@/components/StudySession";

export default function QuizPage(props: PageProps<"/sets/[id]/quiz">) {
  const router = useRouter();
  const [items, setItems] = useState<SessionItem[]>([]);
  const [setID, setSetID] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/"); return; }
    props.params.then(({ id }) => {
      setSetID(id);
      return api.sets.get(id);
    }).then((s) => setItems(fromMix(s.Cards ?? [], s.TestQuestions ?? [])));
  }, [router, props.params]);

  return <StudySession items={items} setID={setID} doneTitle="Mix complete!" />;
}
