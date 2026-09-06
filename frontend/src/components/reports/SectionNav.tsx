import { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SectionNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function SectionNav({ items }: { items: SectionNavItem[] }) {
  return (
    <nav className="sticky top-0 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-card/95 p-1.5 shadow-xs backdrop-blur scrollbar-thin">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => scrollToSection(item.id)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground active:scale-98"
          )}
        >
          <item.icon className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
