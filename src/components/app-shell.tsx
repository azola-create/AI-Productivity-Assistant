import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  CalendarCheck,
  ChevronLeft,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import { seedWorkspace } from "@/lib/seed";

export const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/plan", label: "Plan My Day", icon: CalendarCheck },
  { to: "/meetings", label: "Meeting Summariser", icon: FileText },
  { to: "/email", label: "Draft an Email", icon: Mail },
  { to: "/research", label: "Research Assistant", icon: Search },
  { to: "/chat", label: "AURA Chat", icon: MessageCircle },
  { to: "/library", label: "Task Library", icon: FolderOpen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="aura-surface flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border font-display text-sm font-bold text-primary"
      >
        A
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-bold leading-tight">AURAwork</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            Less admin. More leadership.
          </span>
        </span>
      )}
    </div>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        const link = (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            } ${collapsed ? "justify-center px-0" : ""}`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            {!collapsed && <span className="truncate">{label}</span>}
            {collapsed && <span className="sr-only">{label}</span>}
          </Link>
        );
        return collapsed ? (
          <Tooltip key={to}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ) : (
          link
        );
      })}
    </nav>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { theme, toggle } = useTheme();
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const name = profile?.full_name || user?.email?.split("@")[0] || "Manager";

  return (
    <div className="mt-auto border-t border-sidebar-border p-3">
      <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
        >
          {name.slice(0, 2).toUpperCase()}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {profile?.job_title || user?.email}
            </span>
          </span>
        )}
      </div>
      <div className={`mt-3 flex gap-1 ${collapsed ? "flex-col items-center" : ""}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {!collapsed && <span>{theme === "dark" ? "Light" : "Dark"}</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Sign out"
          onClick={async () => {
            await signOut();
            void navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign out</span>}
        </Button>
      </div>
    </div>
  );
}

export function AppLayout({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, loading, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile && !profile.seeded && user) {
      void seedWorkspace(user.id).then(() => refreshProfile());
    }
  }, [profile, user, refreshProfile]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex ${
            collapsed ? "w-[76px]" : "w-[260px]"
          }`}
        >
          <div className={`flex items-center justify-between p-4 ${collapsed ? "justify-center" : ""}`}>
            <Wordmark compact={collapsed} />
          </div>
          <NavList collapsed={collapsed} />
          <SidebarFooter collapsed={collapsed} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3.5 top-8 h-7 w-7 rounded-full bg-card shadow-soft"
          >
            <ChevronLeft className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </Button>
        </aside>

        <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[260px]"}`}>
          {/* Mobile bar */}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
            <Wordmark />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Open navigation">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-[270px] flex-col bg-sidebar p-0">
                <SheetTitle className="p-4 text-left">
                  <Wordmark />
                </SheetTitle>
                <NavList collapsed={false} onNavigate={() => setMobileOpen(false)} />
                <SidebarFooter collapsed={false} />
              </SheetContent>
            </Sheet>
          </div>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
                <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
                {description && (
                  <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </header>
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
