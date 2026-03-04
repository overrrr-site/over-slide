import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen bg-off-white">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-beige bg-white lg:flex lg:flex-col">
        <div className="px-5 py-4">
          <Link href="/dashboard" className="block">
            <img
              src="/logo.png"
              alt="OVERworks"
              className="h-7 w-auto"
            />
          </Link>
        </div>

        <SidebarNav />

        <div className="border-t border-beige px-5 py-3">
          <p className="truncate text-xs text-text-secondary">{user.email}</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
