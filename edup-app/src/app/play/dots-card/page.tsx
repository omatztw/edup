import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DotsCard from "@/components/apps/DotsCard";

export default async function DotsCardPage({
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

  // 子供が自分のものか確認
  const { data: child } = await supabase
    .from("children")
    .select("id, name")
    .eq("id", childId)
    .single();

  if (!child) {
    redirect("/dashboard");
  }

  return <DotsCard childId={child.id} childName={child.name} />;
}
