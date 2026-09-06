import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  UploadCloud,
  Settings as SettingsIcon,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  History,
  BrainCircuit,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/courses", label: "Courses", icon: GraduationCap },
  { to: "/upload", label: "Upload & Analyze", icon: UploadCloud },
  { to: "/dual-evaluate", label: "Dual LLM Evaluator", icon: BrainCircuit },
  { to: "/question-memory", label: "Academic Memory", icon: History },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border/80 bg-primary-950 text-white transition-[width] duration-200 select-none",
        sidebarCollapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-800 border border-primary-700 text-white shadow-sm">
          <GraduationCap className="h-5 w-5 text-primary-200" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <span className="block text-body font-bold tracking-tight text-white leading-tight">AcadIQ</span>
            <span className="block text-[10px] font-medium tracking-wider uppercase text-primary-300/80">Faculty QA Portal</span>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            title={sidebarCollapsed ? link.label : undefined}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-small font-medium transition-all duration-150",
                isActive
                  ? "bg-primary-900/90 text-white font-semibold shadow-inner border border-primary-800/80"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary-400" />
                )}
                <link.icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    isActive ? "text-primary-300" : "text-white/60 group-hover:text-white"
                  )}
                />
                {!sidebarCollapsed && <span className="truncate">{link.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs font-medium text-white/60 transition-colors hover:text-white hover:bg-white/5"
      >
        {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        {!sidebarCollapsed && <span>Collapse sidebar</span>}
      </button>
    </aside>
  );
}
