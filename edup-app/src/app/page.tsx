import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-50 to-white px-4">
      <h1 className="text-5xl font-bold text-sky-600">えでゅ</h1>
      <p className="mt-3 text-gray-500">親子で楽しむ知育アプリ</p>

      <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/login"
          className="block w-full rounded-lg bg-sky-500 py-3 text-center text-base font-medium text-white transition hover:bg-sky-600"
        >
          ログイン
        </Link>
        <Link
          href="/signup"
          className="block w-full rounded-lg border border-sky-500 py-3 text-center text-base font-medium text-sky-600 transition hover:bg-sky-50"
        >
          新規登録
        </Link>
      </div>
    </div>
  );
}
