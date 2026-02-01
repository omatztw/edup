"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import QRCode from "qrcode";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [qrStatus, setQrStatus] = useState<"loading" | "ready" | "approved" | "expired" | "error">("loading");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(nextUrl || "/dashboard");
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ""}`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startQRLogin = useCallback(async () => {
    setQrStatus("loading");
    setShowQR(true);
    stopPolling();

    try {
      const res = await fetch("/api/tv-login", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create session");
      const { token } = await res.json();
      setQrToken(token);

      const url = `${window.location.origin}/tv-login/approve?token=${token}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: { dark: "#0ea5e9", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
      setQrStatus("ready");

      // ポーリング開始（3秒間隔、5分でタイムアウト）
      const startTime = Date.now();
      pollingRef.current = setInterval(async () => {
        if (Date.now() - startTime > 5 * 60 * 1000) {
          stopPolling();
          setQrStatus("expired");
          return;
        }

        try {
          const pollRes = await fetch(`/api/tv-login?token=${token}`);
          if (!pollRes.ok) return;
          const data = await pollRes.json();

          if (data.status === "approved") {
            stopPolling();
            setQrStatus("approved");

            // 承認されたのでセッションを確立
            const sessionRes = await fetch("/api/tv-login/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });

            if (sessionRes.ok) {
              const { token_hash } = await sessionRes.json();
              // verifyOtpでSupabaseセッションを確立
              const { error: verifyError } = await supabase.auth.verifyOtp({
                token_hash,
                type: "magiclink",
              });

              if (!verifyError) {
                router.push("/dashboard");
                router.refresh();
              } else {
                setQrStatus("error");
              }
            }
          }
        } catch {
          // ポーリングエラーは無視
        }
      }, 3000);
    } catch {
      setQrStatus("error");
    }
  }, [stopPolling, router]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const closeQR = () => {
    setShowQR(false);
    stopPolling();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-sky-600">えでゅ</h1>
          <p className="mt-2 text-sm text-gray-500">親子で楽しむ知育アプリ</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
              パスワード
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-500 py-3 text-base font-medium text-white transition hover:bg-sky-600 disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-400">または</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white py-3 text-base font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Googleでログイン
        </button>

        <button
          onClick={startQRLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white py-3 text-base font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="3" height="3" />
            <rect x="18" y="14" width="3" height="3" />
            <rect x="14" y="18" width="3" height="3" />
            <rect x="18" y="18" width="3" height="3" />
          </svg>
          QRコードでログイン
        </button>

        <p className="text-center text-sm text-gray-500">
          アカウントをお持ちでない方は{" "}
          <Link href="/signup" className="font-medium text-sky-600 hover:underline">
            新規登録
          </Link>
        </p>
      </div>

      {/* QRコードモーダル */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4 text-center">
            <h2 className="text-lg font-bold text-gray-800">
              QRコードでログイン
            </h2>

            {qrStatus === "loading" && (
              <p className="text-gray-500">QRコードを生成中...</p>
            )}

            {qrStatus === "ready" && (
              <>
                <p className="text-sm text-gray-500">
                  スマホのカメラでこのQRコードを読み取ってください
                </p>
                <div className="flex justify-center">
                  <img src={qrDataUrl} alt="QRコード" className="h-64 w-64" />
                </div>
                <p className="text-xs text-gray-400">
                  5分間有効です
                </p>
              </>
            )}

            {qrStatus === "approved" && (
              <div className="space-y-2">
                <p className="text-green-600 font-medium">
                  ログインが承認されました
                </p>
                <p className="text-sm text-gray-500">リダイレクト中...</p>
              </div>
            )}

            {qrStatus === "expired" && (
              <div className="space-y-3">
                <p className="text-amber-600">QRコードの有効期限が切れました</p>
                <button
                  onClick={startQRLogin}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
                >
                  再生成
                </button>
              </div>
            )}

            {qrStatus === "error" && (
              <div className="space-y-3">
                <p className="text-red-600">エラーが発生しました</p>
                <button
                  onClick={startQRLogin}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600"
                >
                  再試行
                </button>
              </div>
            )}

            <button
              onClick={closeQR}
              className="w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-gray-500">読み込み中...</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
