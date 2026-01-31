"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

type Child = {
  id: string;
  name: string;
  birth_date: string | null;
};

export default function ChildrenManager({
  initialChildren,
  userId,
}: {
  initialChildren: Child[];
  userId: string;
}) {
  const [children, setChildren] = useState<Child[]>(initialChildren);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const supabase = createClient();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);

    const { data, error } = await supabase
      .from("children")
      .insert({ name: name.trim(), parent_id: userId })
      .select()
      .single();

    if (!error && data) {
      setChildren([...children, data]);
      setName("");
      setShowForm(false);
    }
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-700">お子さま</h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-sky-600 hover:underline"
          >
            + 追加
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="お子さまの名前"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            追加
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            取消
          </button>
        </form>
      )}

      {children.length === 0 ? (
        <p className="text-sm text-gray-400">
          お子さまのプロフィールを追加してください
        </p>
      ) : (
        <div className="space-y-2">
          {children.map((child) => (
            <a
              key={child.id}
              href={`/play/dots-card?child=${child.id}`}
              className="flex items-center justify-between rounded-lg border bg-white p-4 transition hover:border-sky-300 hover:shadow-sm"
            >
              <span className="font-medium text-gray-800">{child.name}</span>
              <span className="text-sm text-sky-500">ドッツカード →</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
