import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_HIERARCHY, type UserRole } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Clock,
  BarChart3,
  ClipboardCheck,
  Building2,
  Tags,
  Users,
  LogOut,
  Timer,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  minRole?: UserRole;
}

interface NavSection {
  title?: string;
  items: NavItem[];
  minRole?: UserRole;
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
      { label: "My Entries", path: "/entries", icon: Clock, minRole: "consultant" },
      { label: "Reports", path: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "Management",
    minRole: "manager",
    items: [
      { label: "Review Periods", path: "/review", icon: ClipboardCheck, minRole: "manager" },
    ],
  },
  {
    title: "Admin",
    minRole: "admin",
    items: [
      { label: "Customers", path: "/admin/customers", icon: Building2, minRole: "admin" },
      { label: "Categories", path: "/admin/categories", icon: Tags, minRole: "admin" },
      { label: "Users & Roles", path: "/admin/users", icon: Users, minRole: "admin" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sidebar() {
  const { user, signOut } = useAuth();
  const userLevel = user ? ROLE_HIERARCHY[user.role] : -1;

  function canAccess(minRole?: UserRole): boolean {
    if (!minRole) return true;
    return userLevel >= ROLE_HIERARCHY[minRole];
  }

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-surface-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-surface-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
          <Timer className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-surface-900">
          TimeTrack
        </span>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, sIdx) => {
          if (!canAccess(section.minRole)) return null;

          const visibleItems = section.items.filter((item) =>
            canAccess(item.minRole)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={sIdx} className={cn(sIdx > 0 && "mt-6")}>
              {section.title && (
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === "/"}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                          isActive
                            ? "bg-brand-50 text-brand-700"
                            : "text-surface-600 hover:bg-surface-100 hover:text-surface-800"
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-surface-100 px-3 py-3">
        {user && (
          <div className="mb-2 flex items-center gap-2.5 px-2">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-7 w-7 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {(user.fullName ?? user.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-surface-800">
                {user.fullName ?? user.email}
              </p>
              <p className="truncate text-[11px] text-surface-400 capitalize">
                {user.role}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-700"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
