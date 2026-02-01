import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import crypto from "crypto";

// TV側: 新しいログインセッションを作成
export async function POST() {
  const supabase = await createClient();
  const token = crypto.randomBytes(32).toString("hex");

  const { data, error } = await supabase
    .from("tv_login_sessions")
    .insert({ token })
    .select("id, token")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, token: data.token });
}

// TV側: セッションのステータスをポーリング
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tv_login_sessions")
    .select("status, user_id")
    .eq("token", token)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // 5分以上経過したセッションは期限切れ
  return NextResponse.json({ status: data.status, userId: data.user_id });
}
