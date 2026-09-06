import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "../lib/utils";

function initials(name?: string) {
  if (!name) return "FA";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Manage your AcadIQ profile and preferences." />

      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold">Appearance & Theme</CardTitle>
          <CardDescription>Customize how AcadIQ looks on your device. Choose between Light and Dark mode.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Light Mode Option */}
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "group relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50",
                theme === "light"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <Sun className="h-4 w-4" />
                </div>
                <div
                  className={cn(
                    "h-4 w-4 rounded-full border-2 transition-all",
                    theme === "light" ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )}
                />
              </div>
              <div>
                <p className="text-small font-semibold text-foreground">Light Mode</p>
                <p className="text-xs text-muted-foreground">Clean, crisp light interface</p>
              </div>
              {/* Visual Preview Box */}
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1.5">
                <div className="h-2 w-16 rounded bg-slate-300" />
                <div className="h-2 w-24 rounded bg-slate-200" />
                <div className="h-6 w-full rounded bg-white border border-slate-200" />
              </div>
            </button>

            {/* Dark Mode Option */}
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "group relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50",
                theme === "dark"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Moon className="h-4 w-4" />
                </div>
                <div
                  className={cn(
                    "h-4 w-4 rounded-full border-2 transition-all",
                    theme === "dark" ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )}
                />
              </div>
              <div>
                <p className="text-small font-semibold text-foreground">Dark Mode</p>
                <p className="text-xs text-muted-foreground">Sleek, eye-friendly dark interface</p>
              </div>
              {/* Visual Preview Box */}
              <div className="mt-1 rounded-lg border border-slate-700 bg-slate-900 p-2.5 space-y-1.5">
                <div className="h-2 w-16 rounded bg-slate-700" />
                <div className="h-2 w-24 rounded bg-slate-800" />
                <div className="h-6 w-full rounded bg-slate-800 border border-slate-700" />
              </div>
            </button>

            {/* System Default Option */}
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={cn(
                "group relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50",
                theme === "system"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/20 text-secondary-foreground">
                  <Monitor className="h-4 w-4" />
                </div>
                <div
                  className={cn(
                    "h-4 w-4 rounded-full border-2 transition-all",
                    theme === "system" ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )}
                />
              </div>
              <div>
                <p className="text-small font-semibold text-foreground">System Default</p>
                <p className="text-xs text-muted-foreground">Match your system preference</p>
              </div>
              {/* Visual Preview Box */}
              <div className="mt-1 flex rounded-lg overflow-hidden border border-border">
                <div className="w-1/2 bg-slate-100 p-2 space-y-1.5">
                  <div className="h-2 w-8 rounded bg-slate-300" />
                  <div className="h-4 w-full rounded bg-white" />
                </div>
                <div className="w-1/2 bg-slate-900 p-2 space-y-1.5">
                  <div className="h-2 w-8 rounded bg-slate-700" />
                  <div className="h-4 w-full rounded bg-slate-800" />
                </div>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-small font-medium text-muted-foreground">Quick Switch:</span>
            <ThemeToggle variant="segmented" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold">Profile</CardTitle>
          <CardDescription>Your faculty account details.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-body">{initials(user?.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-body font-semibold text-foreground">{user?.name}</p>
              <Badge variant="secondary" className="mt-1">
                {user?.role === "ADMIN" ? "Administrator" : "Faculty"}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Full name</Label>
              <Input value={user?.name ?? ""} disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
          </div>

          <div>
            <Button variant="outline" disabled>
              Edit profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold">Notifications</CardTitle>
          <CardDescription>Choose when AcadIQ should notify you about new analyses.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-small text-muted-foreground">Notification preferences are coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
