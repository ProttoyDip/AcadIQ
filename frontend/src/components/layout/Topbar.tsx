import { useNavigate } from "react-router-dom";
import { LogOut, Search, User } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { ThemeToggle } from "../ui/ThemeToggle";
import MobileNav from "./MobileNav";
import NotificationCenter from "./NotificationCenter";
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
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MobileNav />

        <label className="group flex w-full max-w-md items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-muted-foreground shadow-xs transition-all duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Search AcadIQ</span>
          <input
            type="search"
            placeholder="Search courses, papers, reports..."
            className="w-full min-w-0 bg-transparent text-small text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground lg:inline-flex">
            &#8984;K
          </kbd>
        </label>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-success-border bg-success-bg px-2.5 py-1 text-xs font-semibold text-success xl:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          Institutional QA Node
        </span>

        <NotificationCenter />

        <ThemeToggle variant="icon" />

        <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary-50 text-xs font-bold text-primary-800 dark:bg-primary-950/70 dark:text-primary-200">
                {initials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-[10rem] truncate text-small font-semibold leading-tight">
                {user?.name || "Faculty Member"}
              </span>
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                {user?.role === "ADMIN" ? "Administrator" : "Department Faculty"}
              </span>
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Signed in as{" "}
              <span className="block truncate font-semibold text-foreground">
                {user?.email || "faculty@university.edu"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <User className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" /> Account settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-error focus:bg-error-bg focus:text-error"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
