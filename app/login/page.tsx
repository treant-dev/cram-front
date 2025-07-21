import LoginButton from "@/components/LoginButton";

export default function LoginPage() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex w-full max-w-[400px] flex-col items-center justify-center p-4">
        <LoginButton />
      </div>
    </main>
  );
}
