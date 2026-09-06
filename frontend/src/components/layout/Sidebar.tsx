import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  UploadCloud,
  FileSearch2,
  Settings as SettingsIcon,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  History,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useUiStore } from "../../store/uiStore";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/courses", label: "Courses", icon: GraduationCap },
  { to: "/upload", label: "Upload & Analyze", icon: UploadCloud },
  { to: "/question-memory", label: "Academic Memory", icon: History },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-primary-950 text-white transition-[width] duration-200",
        sidebarCollapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary-500">
          <Sparkles className="h-4.5 w-4.5 text-white" />
        </div>
        {!sidebarCollapsed && <span className="text-body font-bold tracking-tight">AcadIQ</span>}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-small font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white",
                isActive && "bg-white/10 text-white"
              )
            }
          >
            <link.icon className="h-[18px] w-[18px] shrink-0" />
            {!sidebarCollapsed && <span>{link.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={toggleSidebar}
        className="flex items-center gap-2 border-t border-white/10 px-4 py-3.5 text-small text-white/60 hover:text-white"
      >
        {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        {!sidebarCollapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}
