import SidebarNav from "@/components/SidebarNav";
"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  MessageSquare,
  BookOpen,
  FileText,
  ShieldCheck,
  User2,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  match?: "exact" | "prefix";
};

type ProfileLite = {
  name: string | null;
  role: "admin" | "consultant" | "viewer" | null;
};

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/workspace/command", label: "指挥中心", icon: <LayoutGrid size={18} />, match: "exact" },
      { href: "/workspace/sales", label: "销售工作台", icon: <MessageSquare size={18} />, match: "prefix" },
      { href: "/workspace/kb", label: "企业知识库", icon: <BookOpen size={18} />, match: "prefix" },
      { href: "/workspace/contracts", label: "合同与审批", icon: <FileText size={18} />, match: "prefix" },
      { href: "/workspace/qc", label: "质控中心", icon: <ShieldCheck size={18} />, match: "prefix" },
    ],
    []
  );

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;

        setUserEmail(user?.email ?? null);

        if (!user?.id) {
          setProfile(null);
          return;
        }

        const { data: p } = await supabase
          .from("profiles")
          .select("name, role")
          .eq("id", user.id)
          .maybeSingle();

        setProfile({
          name: (p as any)?.name ?? null,
          role: (p as any)?.role ?? null,
        });
      } catch {
        setProfile(null);
      }
    }

    load();
  }, []);

  const displayName = profile?.name || userEmail || "未登录";
  const displayRole = profile?.role || null;

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r bg-white">
        <div className="px-4 py-6">
          <div className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
              ★
            </span>
            柯维工作台
          </div>

          <nav className="space-y-1 text-sm">
            {navItems.filter((item) => canSeeNav(item.href)).map((item) => (
              <SidebarItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                active={isActive(pathname, item.href, item.match)}
              >
                {item.label}
              </SidebarItem>
            ))}
          </nav>
        </div>

        {/* Bottom user panel */}
        <div className="mt-auto border-t bg-white px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <User2 size={18} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-medium text-slate-900">
                  {displayName}
                </div>
                {displayRole ? (
                  <RolePill role={displayRole} />
                ) : null}
              </div>
              <div className="truncate text-xs text-slate-500">
                {userEmail ?? "当前未登录"}
              </div>
            </div>

            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={async () => {
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              title="退出登录"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

function isActive(pathname: string, href: string, match: NavItem["match"] = "exact") {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function SidebarItem({
  href,
  icon,
  children,
  active,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 rounded-xl px-3 py-2 transition",
        active
          ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      ].join(" ")}
    >
      <span className={active ? "text-blue-700" : "text-slate-500"}>{icon}</span>
      <span className="font-medium">{children}</span>
      {active ? <span className="ml-auto h-2 w-2 rounded-full bg-blue-600" /> : null}
    </Link>
  );
}

function RolePill({ role }: { role: "admin" | "consultant" | "viewer" }) {
  const label =
    role === "admin" ? "Admin" : role === "consultant" ? "Consultant" : "Viewer";

  const cls =
    role === "admin"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : role === "consultant"
      ? "bg-blue-50 text-blue-700 ring-blue-100"
      : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}
