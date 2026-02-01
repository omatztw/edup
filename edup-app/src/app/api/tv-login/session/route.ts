import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// TV側: 承認済みセッションからセッションCookieを確立
export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = await createClient();

  const { data: tvSession } = await supabase
    .from("tv_login_sessions")
    .select("status, user_id")
    .eq("token", token)
    .single();

  if (!tvSession || tvSession.status !== "approved" || !tvSession.user_id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  // セッションを使用済みにする
  await supabase
    .from("tv_login_sessions")
    .update({ status: "expired" })
    .eq("token", token);

  // Admin clientでユーザーのメールを取得し、マジックリンクを生成
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData, error: userError } =
    await adminClient.auth.admin.getUserById(tvSession.user_id);

  if (userError || !userData.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // マジックリンクを生成（メール送信せずトークンだけ取得）
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });

  if (linkError || !linkData.properties?.action_link) {
    return NextResponse.json(
      { error: "Failed to generate login token" },
      { status: 500 }
    );
  }

  // action_linkからcodeパラメータを抽出
  const actionUrl = new URL(linkData.properties.action_link);
  // Supabaseのaction_linkはリダイレクト先にcodeが含まれる場合と
  // token_hash + typeがクエリパラメータに含まれる場合がある
  const tokenHash = actionUrl.searchParams.get("token_hash") ||
    actionUrl.hash?.match(/token_hash=([^&]+)/)?.[1];
  const type = actionUrl.searchParams.get("type") || "magiclink";

  if (!tokenHash) {
    return NextResponse.json(
      { error: "Failed to extract token" },
      { status: 500 }
    );
  }

  // サーバー側のSupabaseクライアントでverifyOtpしてCookieセッションを確立
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "magiclink",
  });

  if (verifyError) {
    return NextResponse.json(
      { error: "Session verification failed: " + verifyError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
