"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function ApproveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<
    "loading" | "confirm" | "approving" | "done" | "error" | "login_required"
  >("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setStatus("error");
        setError("無効なリンクです");
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus("login_required");
        return;
      }

      setStatus("confirm");
    }
    checkAuth();
  }, [token]);

  const handleApprove = async () => {
    setStatus("approving");
    try {
      const res = await fetch("/api/tv-login/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "承認に失敗しました");
      }

      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    }
  };

  const handleLoginRedirect = () => {
    router.push(`/login?next=${encodeURIComponent(`/tv-login/approve?token=${token}`)}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-bold text-sky-600">えでゅ</h1>

        {status === "loading" && (
          <p className="text-gray-500">読み込み中...</p>
        )}

        {status === "login_required" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-amber-700">
                TVでログインするには、先にこのスマホでログインしてください
              </p>
            </div>
            <button
              onClick={handleLoginRedirect}
              className="w-full rounded-lg bg-sky-500 py-3 text-base font-medium text-white transition hover:bg-sky-600"
            >
              ログインする
            </button>
          </div>
        )}

        {status === "confirm" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-sky-50 p-4">
              <p className="text-lg text-sky-700">
                TVでのログインを許可しますか？
              </p>
            </div>
            <button
              onClick={handleApprove}
              className="w-full rounded-lg bg-sky-500 py-3 text-base font-medium text-white transition hover:bg-sky-600"
            >
              許可する
            </button>
          </div>
        )}

        {status === "approving" && (
          <p className="text-gray-500">承認中...</p>
        )}

        {status === "done" && (
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-lg text-green-700">
              TVでのログインが完了しました
            </p>
            <p className="mt-2 text-sm text-green-600">
              このページは閉じて大丈夫です
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ApprovePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      }
    >
      <ApproveContent />
    </Suspense>
  );
}
