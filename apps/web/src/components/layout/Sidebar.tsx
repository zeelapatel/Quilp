import { Link, useLocation } from "react-router-dom";
import { BarChart2, CalendarDays, LayoutDashboard, Link2, ListOrdered, LogOut, Settings2 } from "lucide-react";
import clsx from "clsx";
import { PlanBadge } from "../ui/Badge";
import type { QuilpUser } from "../../hooks/useUser";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/queue", label: "Queue", icon: ListOrdered },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart2 },
  { divider: true },
  { to: "/connections", label: "Connections", icon: Link2 },
  { to: "/settings", label: "Settings", icon: Settings2 }
] as const;

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-1 font-mono text-[28px] font-medium tracking-[-0.02em] text-text-primary">
      quilp
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
    </Link>
  );
}

type Props = {
  user: QuilpUser | null;
  authEmail: string;
  onSignOut: () => void;
};

export function Sidebar({ user, authEmail, onSignOut }: Props) {
  const location = useLocation();
  const initials = authEmail.slice(0, 2).toUpperCase() || "Q";

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-[220px] flex-col border-r border-border bg-bg-primary">
      <div className="border-b border-border px-4 pb-3 pt-4">
        <Wordmark />
      </div>
      <nav className="flex-1 px-0 py-2">
        {navItems.map(item =>
          "divider" in item ? (
            <div key="divider" className="my-2 border-t border-border" />
          ) : (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                "sidebar-item flex h-9 items-center gap-2 px-3 font-sans text-[13px]",
                location.pathname === item.to
                  ? "active border-l-2 border-accent bg-bg-tertiary text-text-primary"
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              )}
            >
              <item.icon size={15} />
              {item.label}
            </Link>
          )
        )}
      </nav>
      <div className="border-t border-border p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-tertiary font-mono text-[11px] text-text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-text-secondary">{authEmail}</p>
            {user ? <PlanBadge plan={user.plan} /> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="active-button flex items-center gap-2 text-xs text-text-tertiary transition-colors hover:text-danger"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
