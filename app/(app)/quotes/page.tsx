import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { QUOTE_STATUSES } from "@/lib/quotes/constants";
import { formatCurrency } from "@/lib/quotes/calculations";
import { QuoteListActions } from "./quote-list-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const BADGE_VARIANT_MAP: Record<string, "draft" | "active" | "success" | "error"> = {
  draft: "draft",
  submitted: "active",
  won: "success",
  lost: "error",
};

export default async function QuotesListPage() {
  const supabase = await createClient();

  const { data: quotes } = await supabase
    .from("quotes")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-6xl overflow-auto p-6">
      <PageHeader
        title="見積一覧"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "見積" },
        ]}
        actions={
          <Link href="/quotes/new">
            <Button size="sm">+ 新規見積</Button>
          </Link>
        }
      />

      {!quotes?.length ? (
        <EmptyState
          icon="mdi:calculator-variant-outline"
          title="見積がありません"
          description="「新規見積」ボタンから見積を作成してください"
          action={
            <Link href="/quotes/new">
              <Button size="sm">+ 新規見積</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige text-left text-xs text-text-secondary">
                  <th className="pb-2.5 font-medium">見積番号</th>
                  <th className="pb-2.5 font-medium">案件名</th>
                  <th className="pb-2.5 font-medium">クライアント</th>
                  <th className="pb-2.5 font-medium text-right">合計金額（税込）</th>
                  <th className="pb-2.5 font-medium">状態</th>
                  <th className="pb-2.5 font-medium text-right">更新日</th>
                  <th className="pb-2.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => {
                  const statusConfig =
                    QUOTE_STATUSES[quote.status as keyof typeof QUOTE_STATUSES] ||
                    QUOTE_STATUSES.draft;
                  return (
                    <tr key={quote.id} className="border-b border-beige/50 last:border-0 hover:bg-off-white/50 transition-colors">
                      <td className="py-3 font-en text-xs text-text-secondary">
                        {quote.quote_number}
                      </td>
                      <td className="py-3">
                        <Link href={`/quotes/${quote.id}`} className="font-medium text-navy hover:underline">
                          {quote.project_name || "無題の見積"}
                        </Link>
                      </td>
                      <td className="py-3 text-text-secondary">
                        {quote.client_name || "—"}
                      </td>
                      <td className="py-3 text-right font-en font-medium text-navy">
                        ¥{formatCurrency(quote.total)}
                      </td>
                      <td className="py-3">
                        <Badge variant={BADGE_VARIANT_MAP[quote.status] || "draft"}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="py-3 text-right text-xs text-text-secondary">
                        {new Date(quote.updated_at).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="py-3 text-right">
                        <QuoteListActions quoteId={quote.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
