import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// TV側: 承認済みセッションからサインイン用のマジックリンクを取得
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

  // Admin clientでユーザーのメールを取得し、マジックリンクを生成
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData, error: userError } =
    await adminClient.auth.admin.getUserById(session.user_id);

  if (userError || !userData.user?.email) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // マジックリンクを生成（メール送信せずトークンだけ取得）
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });

  if (linkError || !linkData.properties?.hashed_token) {
    return NextResponse.json(
      { error: "Failed to generate login token" },
      { status: 500 }
    );
  }

  // OTP(hashed_token)を返し、TV側でverifyOtpを呼んでセッション確立
  return NextResponse.json({
    email: userData.user.email,
    token_hash: linkData.properties.hashed_token,
  });
}
