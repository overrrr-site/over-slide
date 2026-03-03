"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";

// ============================================================
// ナビゲーション定義
// ============================================================

type NavItem = {
  href: string;
  label: string;
  icon: string;
  iconActive: string;
};

type NavGroup = {
  label: string;
  icon: string;
  items: NavItem[];
};

const HOME_ITEM: NavItem = {
  href: "/dashboard",
  label: "ホーム",
  icon: "mdi:home-outline",
  iconActive: "mdi:home",
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "企画・資料作成",
    icon: "mdi:lightbulb-on-outline",
    items: [
      {
        href: "/brainstorms",
        label: "ブレスト一覧",
        icon: "mdi:head-lightbulb-outline",
        iconActive: "mdi:head-lightbulb",
      },
      {
        href: "/projects",
        label: "資料作成一覧",
        icon: "mdi:folder-multiple-outline",
        iconActive: "mdi:folder-multiple",
      },
      {
        href: "/knowledge",
        label: "ナレッジ",
        icon: "mdi:book-open-page-variant-outline",
        iconActive: "mdi:book-open-page-variant",
      },
      {
        href: "/settings/style-guide",
        label: "スタイルガイド",
        icon: "mdi:text-box-check-outline",
        iconActive: "mdi:text-box-check",
      },
    ],
  },
  {
    label: "見積作成",
    icon: "mdi:calculator-variant-outline",
    items: [
      {
        href: "/quotes",
        label: "見積一覧",
        icon: "mdi:format-list-bulleted",
        iconActive: "mdi:format-list-bulleted",
      },
    ],
  },
];

const STANDALONE_ITEMS: NavItem[] = [
  {
    href: "/settings",
    label: "設定",
    icon: "mdi:cog-outline",
    iconActive: "mdi:cog",
  },
];

// ============================================================
// コンポーネント
// ============================================================

export function SidebarNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/projects") return pathname === "/projects" || pathname.startsWith("/projects/");
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2">
      {/* ホーム */}
      <div className="mb-2">
        {(() => {
          const active = pathname === "/dashboard";
          return (
            <Link
              href={HOME_ITEM.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-off-white font-medium text-navy"
                  : "text-text-primary hover:bg-off-white/60"
              }`}
            >
              <Icon
                icon={active ? HOME_ITEM.iconActive : HOME_ITEM.icon}
                className={`h-5 w-5 ${active ? "text-navy" : "text-text-secondary"}`}
              />
              {HOME_ITEM.label}
            </Link>
          );
        })()}
      </div>

      {/* グループ化されたメニュー */}
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label} className={gi > 0 ? "mt-6" : ""}>
          {/* グループ見出し */}
          <div className="mb-1 flex items-center gap-2 px-3 py-1">
            <Icon
              icon={group.icon}
              className="h-4 w-4 text-text-secondary"
            />
            <span className="text-xs font-semibold tracking-wider text-text-secondary">
              {group.label}
            </span>
          </div>

          {/* サブメニュー */}
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md py-2 pl-9 pr-3 text-sm transition-colors ${
                  active
                    ? "bg-off-white font-medium text-navy"
                    : "text-text-primary hover:bg-off-white/60"
                }`}
              >
                <Icon
                  icon={active ? item.iconActive : item.icon}
                  className={`h-5 w-5 ${
                    active ? "text-navy" : "text-text-secondary"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}

      {/* 独立メニュー（設定など） */}
      <div className="mt-6">
        {STANDALONE_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-off-white font-medium text-navy"
                  : "text-text-primary hover:bg-off-white/60"
              }`}
            >
              <Icon
                icon={active ? item.iconActive : item.icon}
                className={`h-5 w-5 ${
                  active ? "text-navy" : "text-text-secondary"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
