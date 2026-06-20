import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { getMe, signOut } from "@/lib/api/auth.functions";
import {
  LayoutDashboard,
  Package,
  Receipt,
  FileBarChart,
  Settings,
  LogOut,
  Wallet,
  Landmark,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthLayout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lotes", label: "Lotes", icon: Package },
  { to: "/despesas", label: "Despesas", icon: Receipt },
  { to: "/financiamento", label: "Financiamento", icon: Landmark },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function AuthLayout() {
  const router = useRouter();
  const qc = useQueryClient();

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 py-6 border-b border-sidebar-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Wallet className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-semibold text-base">Financeiro</div>
            <div className="text-xs text-sidebar-foreground/60">Gestão dos sócios</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              activeProps={{ className: "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium bg-sidebar-primary text-sidebar-primary-foreground" }}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <span className="font-display font-semibold">Financeiro</span>
          </div>
          <button onClick={handleSignOut} className="text-sm">Sair</button>
        </div>
        <nav className="px-2 pb-2 flex gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className="px-3 py-1.5 rounded-md text-xs whitespace-nowrap text-sidebar-foreground/70 hover:bg-sidebar-accent"
              activeProps={{ className: "px-3 py-1.5 rounded-md text-xs whitespace-nowrap bg-sidebar-primary text-sidebar-primary-foreground" }}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="flex-1 md:ml-0 pt-24 md:pt-0 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
