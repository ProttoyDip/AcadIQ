import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme, Theme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils";

interface ThemeToggleProps {
  variant?: "icon" | "segmented" | "dropdown";
  className?: string;
}

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { theme, effectiveTheme, setTheme, toggleTheme } = useTheme();

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background/80 text-foreground transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          className
        )}
        title={`Switch to ${effectiveTheme === "dark" ? "light" : "dark"} mode`}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </button>
    );
  }

  if (variant === "segmented") {
    const options: { value: Theme; label: string; icon: typeof Sun }[] = [
      { value: "light", label: "Light", icon: Sun },
      { value: "dark", label: "Dark", icon: Moon },
      { value: "system", label: "System", icon: Monitor },
    ];

    return (
      <div
        className={cn(
          "inline-flex items-center rounded-lg border border-border bg-muted p-1 text-muted-foreground",
          className
        )}
      >
        {options.map(({ value, label, icon: Icon }) => {
          const isActive = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                isActive
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "hover:bg-background/50 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return null;
}
