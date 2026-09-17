import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";
import { navGroupsFor } from "./navigation";
import { useAuth } from "../../hooks/useAuth";



export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const { user } = useAuth();
  const navGroups = navGroupsFor(user?.role);

  return (
    <aside
      className={cn(
        "hidden shrink-0 select-none flex-col border-r border-border bg-card transition-[width] duration-300 ease-out md:flex",
        sidebarCollapsed ? "w-[76px]" : "w-64"
      )}
    >
      {/* brand */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
          <GraduationCap className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        {!sidebarCollapsed && (
          <span className="min-w-0">
            <span className="block truncate text-body font-extrabold leading-tight tracking-tight">AcadIQ</span>
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Faculty QA Portal
            </span>
          </span>
        )}
      </div>

      {/* navigation */}
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-6 overflow-y-auto scrollbar-thin px-3 py-5">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            {!sidebarCollapsed && (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {group.label}
              </p>
            )}
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                title={sidebarCollapsed ? link.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-small font-medium transition-colors duration-200",
                    sidebarCollapsed && "justify-center px-0",
                    isActive
                      ? "bg-primary-50 font-semibold text-primary-800 dark:bg-primary-950/60 dark:text-primary-200"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active"
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <link.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    {!sidebarCollapsed && <span className="truncate">{link.label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "flex h-12 items-center gap-2.5 border-t border-border px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          sidebarCollapsed && "justify-center px-0"
        )}
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        )}
        {!sidebarCollapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
