"use client";

import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";

function SignupForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("招待トークンが必要です。管理者から招待リンクを受け取ってください。");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          invitation_token: token,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
    }
  };

  if (!token) {
    return (
      <div className="rounded-lg border border-beige bg-white p-8 shadow-sm">
        <h1 className="mb-4 text-center text-2xl font-bold text-navy">
          招待が必要です
        </h1>
        <p className="text-center text-sm text-text-secondary">
          このシステムは招待制です。管理者から招待リンクを受け取ってください。
        </p>
        <a
          href="/login"
          className="mt-4 block text-center text-sm text-green hover:underline"
        >
          ログインページに戻る
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-lg border border-beige bg-white p-8 shadow-sm">
        <h1 className="mb-4 text-center text-2xl font-bold text-navy">
          アカウント作成完了
        </h1>
        <p className="text-center text-sm text-text-secondary">
          確認メールを送信しました。メール内のリンクをクリックしてアカウントを有効化してください。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-beige bg-white p-8 shadow-sm">
      <h1 className="mb-6 text-center text-2xl font-bold text-navy">
        アカウント作成
      </h1>
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label
            htmlFor="displayName"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            表示名
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            パスワード
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-navy py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
        >
          {loading ? "作成中..." : "アカウント作成"}
        </button>
      </form>
      <a
        href="/login"
        className="mt-4 block text-center text-sm text-green hover:underline"
      >
        ログインページに戻る
      </a>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-beige bg-white p-8 shadow-sm">
          <p className="text-center text-sm text-text-secondary">読み込み中...</p>
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
