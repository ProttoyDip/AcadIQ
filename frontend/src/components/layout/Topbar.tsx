import { useNavigate } from "react-router-dom";
import { LogOut, Search, User } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Avatar, AvatarFallback } from "../ui/avatar";
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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
      <div className="flex w-full max-w-sm items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-muted-foreground">
        <Search className="h-4 w-4" />
        <input
          placeholder="Search courses, papers, reports..."
          className="w-full bg-transparent text-small outline-none placeholder:text-muted-foreground"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="text-small font-medium leading-none">{user?.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{user?.role === "ADMIN" ? "Administrator" : "Faculty"}</p>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>My account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <User className="h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
