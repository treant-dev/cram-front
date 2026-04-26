import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "@/contexts/UserContext";

export const metadata: Metadata = {
  title: "Cram",
  description: "Solo flashcard study tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 antialiased">
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
