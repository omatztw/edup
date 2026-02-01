import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// TV側: 承認済みセッションからカスタムトークンでサインイン
// 承認後、TV側がこのエンドポイントを呼んでセッションCookieを取得
export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("tv_login_sessions")
    .select("status, user_id")
    .eq("token", token)
    .single();

  if (!session || session.status !== "approved" || !session.user_id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  // セッションを使用済みにする
  await supabase
    .from("tv_login_sessions")
    .update({ status: "expired" })
    .eq("token", token);

  // user_idを返す（TV側はこの情報でログイン状態を表示）
  // 注意: 実際のSupabaseセッション確立にはサービスロールキーが必要
  // ここではuser_idを返し、TV側でカスタムトークン認証を行う
  return NextResponse.json({ userId: session.user_id });
}
