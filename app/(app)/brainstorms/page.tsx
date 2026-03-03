import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { BrainstormActions } from "./brainstorm-actions";

const STATUS_MAP: Record<string, { label: string; variant: "draft" | "active" | "success" }> = {
  active: { label: "進行中", variant: "active" },
  completed: { label: "完了", variant: "success" },
  archived: { label: "アーカイブ", variant: "draft" },
};

export default async function BrainstormsPage() {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("brainstorm_sessions")
    .select("id, title, client_name, status, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-6xl overflow-auto p-6">
      <PageHeader
        title="ブレスト一覧"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "ブレスト" },
        ]}
        actions={
          <Link href="/brainstorms/new">
            <Button size="sm">+ 新規ブレスト</Button>
          </Link>
        }
      />

      {!sessions?.length ? (
        <EmptyState
          icon="mdi:head-lightbulb-outline"
          title="ブレストがありません"
          description="新規ブレストを作成して企画の下地を作成してください"
          action={
            <Link href="/brainstorms/new">
              <Button size="sm">+ 新規ブレスト</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const status = STATUS_MAP[session.status] || STATUS_MAP.active;
            return (
              <Card key={session.id} href={`/brainstorms/${session.id}`} interactive>
                <CardHeader>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold text-navy">{session.title}</h3>
                    {session.client_name && (
                      <p className="mt-0.5 truncate text-xs text-text-secondary">
                        {session.client_name}
                      </p>
                    )}
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-text-secondary">ブリーフ作成・出力・企画書昇格</p>
                </CardContent>
                <CardFooter className="justify-between">
                  <span>{new Date(session.updated_at).toLocaleDateString("ja-JP")}</span>
                  <BrainstormActions brainstormId={session.id} />
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
