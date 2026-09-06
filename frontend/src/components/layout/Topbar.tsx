import { useNavigate } from "react-router-dom";
import { LogOut, Search, User } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { ThemeToggle } from "../ui/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

function initials(name?: string) {
  if (!name) return "FA";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur sticky top-0 z-20">
      <div className="flex w-full max-w-md items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-muted-foreground focus-within:border-primary-500 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary-500/20 transition-all">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          placeholder="Search courses, papers, reports, or questions..."
          className="w-full bg-transparent text-small text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-xs">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground font-medium px-2.5 py-1 rounded-full border border-border bg-card">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span>Institutional QA Node</span>
        </div>

        <ThemeToggle variant="icon" />

        <div className="h-4 w-px bg-border mx-0.5" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="bg-primary-50 text-primary-800 font-semibold text-xs">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="text-small font-semibold leading-none text-foreground">{user?.name || "Faculty Member"}</p>
              <p className="mt-1 text-[11px] text-muted-foreground leading-none">
                {user?.role === "ADMIN" ? "Administrator" : "Department Faculty"}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
              Signed in as <span className="font-semibold text-foreground">{user?.email || "faculty@university.edu"}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <User className="h-4 w-4 mr-2 text-muted-foreground" /> Account Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-error focus:text-error"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
