import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LogoutButton from "./logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <h1 className="text-xl font-bold text-sky-600">えでゅ</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.email}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h2 className="text-lg font-semibold text-gray-800">ダッシュボード</h2>
        <p className="mt-2 text-sm text-gray-500">
          ログインに成功しました。Supabase接続が正常に動作しています。
        </p>

        <div className="mt-6 rounded-lg border bg-white p-6 shadow-sm">
          <h3 className="font-medium text-gray-700">ユーザー情報</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500">ID:</dt>
              <dd className="font-mono text-xs text-gray-700 break-all">{user.id}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500">メール:</dt>
              <dd className="text-gray-700">{user.email}</dd>
            </div>
          </dl>
        </div>
      </main>
    </div>
  );
}
