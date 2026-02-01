import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// スマホ側: TVログインを承認
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  // セッションが存在し、pendingであることを確認
  const { data: session } = await supabase
    .from("tv_login_sessions")
    .select("id, created_at, status")
    .eq("token", token)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "pending") {
    return NextResponse.json(
      { error: "Session already processed" },
      { status: 400 }
    );
  }

  // 5分以上経過していたら期限切れ
  const createdAt = new Date(session.created_at).getTime();
  if (Date.now() - createdAt > 5 * 60 * 1000) {
    await supabase
      .from("tv_login_sessions")
      .update({ status: "expired" })
      .eq("id", session.id);
    return NextResponse.json({ error: "Session expired" }, { status: 410 });
  }

  // 承認: user_idを紐付け
  const { error } = await supabase
    .from("tv_login_sessions")
    .update({
      status: "approved",
      user_id: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
