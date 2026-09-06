"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  ContactRound,
  Users,
  Banknote,
  Sparkles,
  Play,
  Globe,
  Star,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronLeft,
  AlertCircle,
  Zap,
  Search,
  Share2,
  MessageCircle,
  Mail,
} from "lucide-react";
import Logo from "@/components/Logo";
import { t, type DictKey } from "@/lib/i18n";
import { useStore } from "@/store/useStore";
import clsx from "clsx";

type NavItem = { href: string; key: DictKey; icon: typeof LayoutDashboard };

const primary: NavItem[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/dashboard/conversations", key: "conversations", icon: MessageSquare },
  { href: "/dashboard/calendars", key: "calendars", icon: Calendar },
  { href: "/dashboard/contacts", key: "contacts", icon: ContactRound },
  { href: "/dashboard/opportunities", key: "opportunities", icon: Users },
  { href: "/dashboard/payments", key: "payments", icon: Banknote },
];

const secondary: NavItem[] = [
  { href: "/dashboard/ai-assistants", key: "aiAssistants", icon: Sparkles },
  { href: "/dashboard/marketing", key: "marketing", icon: Share2 },
  { href: "/dashboard/sms-marketing", key: "smsMarketing", icon: MessageCircle },
  { href: "/dashboard/email-marketing", key: "emailMarketing", icon: Mail },
  { href: "/dashboard/automation", key: "automation", icon: Play },
  { href: "/dashboard/sites", key: "sites", icon: Globe },
  { href: "/dashboard/reputation", key: "reputation", icon: Star },
  { href: "/dashboard/reporting", key: "reporting", icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const language = useStore((s) => s.settings.language);
  const companyName = useStore((s) => s.settings.companyName);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useStore((s) => s.toggleSidebar);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function renderItem(item: NavItem) {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={clsx(
          "mx-2 flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium transition",
          active
            ? "bg-[var(--brand)] font-semibold text-white shadow-sm"
            : "text-[#64748b] hover:bg-slate-50"
        )}
        title={t(language, item.key)}
      >
        <Icon
          className={clsx(
            "h-[18px] w-[18px] shrink-0",
            active ? "text-white" : "text-[#94a3b8]"
          )}
        />
        {!collapsed && <span className="truncate">{t(language, item.key)}</span>}
      </Link>
    );
  }

  return (
    <aside
      className={clsx(
        "relative flex h-full flex-col border-r border-slate-200 bg-white transition-all duration-200",
        collapsed ? "w-[68px]" : "w-[250px]"
      )}
    >
      <div className={clsx("border-b border-slate-100", collapsed ? "px-2 py-3" : "px-3 py-3")}>
        {!collapsed ? (
          <>
            <Logo />
            <button className="mt-3 flex w-full items-center gap-2 rounded-lg bg-slate-100 px-2 py-1.5 text-left hover:bg-slate-200/70">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-[9px] font-bold text-slate-600">
                MM
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-slate-800">
                  {companyName || "More Marketing"}
                </div>
                <div className="truncate text-[9px] uppercase tracking-wide text-slate-400">
                  Atlanta, DE
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                placeholder={t(language, "searchSidebar")}
                className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-8 pr-14 text-xs outline-none focus:border-[var(--brand)]"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                <span className="rounded border border-slate-200 bg-slate-50 px-1 text-[9px] text-slate-400">
                  ctrl K
                </span>
                <Zap className="h-3 w-3 text-emerald-500" />
              </div>
            </div>
          </>
        ) : (
          <div className="flex justify-center">
            <Zap className="h-4 w-4 text-emerald-500" />
          </div>
        )}
      </div>

      <div className="px-2 pt-2">
        <Link
          href="/dashboard/start-here"
          className={clsx(
            "flex items-center justify-center gap-2 rounded-md px-2.5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:opacity-95",
            collapsed ? "mx-auto h-10 w-10" : "mx-1"
          )}
          style={{
            backgroundColor: pathname.startsWith("/dashboard/start-here")
              ? "#0f172a"
              : "var(--brand)",
          }}
          title={t(language, "startHere")}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20">
            <AlertCircle className="h-3.5 w-3.5" />
          </span>
          {!collapsed && <span>{t(language, "startHere")}</span>}
        </Link>
      </div>

      <nav className="mt-1 flex-1 space-y-0.5 overflow-y-auto py-1">
        {primary.map(renderItem)}
        <div className="mx-4 my-2 border-t border-slate-200" />
        {secondary.map(renderItem)}
      </nav>

      <div className="border-t border-slate-100 p-2 pb-4">
        {renderItem({ href: "/dashboard/settings", key: "settings", icon: Settings })}
      </div>

      <button
        onClick={toggleSidebar}
        className="absolute -right-3 bottom-6 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow hover:bg-emerald-600"
        aria-label="Toggle sidebar"
      >
        <ChevronLeft className={clsx("h-3.5 w-3.5 transition", collapsed && "rotate-180")} />
      </button>
    </aside>
  );
}
