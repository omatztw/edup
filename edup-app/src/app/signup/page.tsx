"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-3xl font-bold text-sky-600">えでゅ</h1>
          <div className="rounded-lg bg-green-50 p-4 text-green-700">
            <p className="font-medium">確認メールを送信しました</p>
            <p className="mt-1 text-sm">
              メール内のリンクをクリックして登録を完了してください。
            </p>
          </div>
          <div className="rounded-lg bg-amber-50 p-4 text-amber-700">
            <p className="text-sm font-medium">メールが届かない場合</p>
            <p className="mt-1 text-sm">
              迷惑メールフォルダをご確認ください。
              送信元は <span className="font-mono text-xs">noreply@mail.app.supabase.io</span> です。
            </p>
          </div>
          <Link href="/login" className="inline-block text-sm text-sky-600 hover:underline">
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-sky-600">えでゅ</h1>
          <p className="mt-2 text-sm text-gray-500">新規登録</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
              表示名
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              パスワード（6文字以上）
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-500 py-3 text-base font-medium text-white transition hover:bg-sky-600 disabled:opacity-50"
          >
            {loading ? "登録中..." : "アカウント作成"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="font-medium text-sky-600 hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
