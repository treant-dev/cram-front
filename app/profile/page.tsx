"use client";

import { useEffect, useState } from "react";
import { getUserInfo } from "@/lib/client";
import { User } from "@/lib/types";
import Image from 'next/image'
import { AxiosResponse } from "axios";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    getUserInfo().then((response: AxiosResponse<User>) => {
      setUser(response.data)
    });
  }, [user]);

  if (!user) return <p>Loading...</p>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white p-4">
      <Image src={user.avatar_url} width={500} height={500} priority={true} alt="avatar" className="w-24 h-24 rounded-full mb-4" />
      <h2 className="text-2xl font-bold">{user.name}</h2>
      <p className="text-lg">{user.login}</p>
      <p className="text-sm text-gray-600 dark:text-gray-300">{user.email}</p>
    </div>
  );
}
