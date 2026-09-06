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
    <nav className="sticky top-0 z-10 -mx-1 flex gap-1.5 overflow-x-auto rounded-lg border border-border bg-card/95 p-1.5 shadow-card backdrop-blur scrollbar-thin">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => scrollToSection(item.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-small font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          )}
        >
          <item.icon className="h-3.5 w-3.5" />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
