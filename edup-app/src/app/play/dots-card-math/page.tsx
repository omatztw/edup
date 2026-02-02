import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DotsCardMath from "@/components/apps/DotsCardMath";

export default async function DotsCardMathPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const { child: childId } = await searchParams;

  if (!childId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: child } = await supabase
    .from("children")
    .select("id, name")
    .eq("id", childId)
    .single();

  if (!child) {
    redirect("/dashboard");
  }

  return <DotsCardMath childId={child.id} childName={child.name} />;
}
