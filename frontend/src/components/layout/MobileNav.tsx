import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { GraduationCap, Menu, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { navGroupsFor } from "./navigation";
import { useAuth } from "../../hooks/useAuth";

/**
 * Portal navigation for small screens. The sidebar is desktop-only, so this
 * drawer carries the same links — core navigation stays reachable from every
 * page rather than disappearing below the md breakpoint.
 *
 * The drawer is portalled to <body>: the topbar that hosts this trigger uses
 * backdrop-blur, which makes it the containing block for fixed descendants and
 * would otherwise clip the overlay to the 64px header strip.
 */
export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();
  const navGroups = navGroupsFor(user?.role);

  // Close on navigation, and give the user an Escape route out of the drawer.
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-50 md:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.22 }}
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-sand-950/50 backdrop-blur-sm dark:bg-sand-950/70"
                aria-hidden="true"
              />

              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Navigation"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%", transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col border-r border-border bg-card shadow-float"
              >
                <div className="flex h-16 items-center justify-between gap-3 border-b border-border px-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <GraduationCap className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span className="truncate text-body font-extrabold tracking-tight">AcadIQ</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close navigation menu"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <nav aria-label="Primary mobile" className="flex flex-1 flex-col gap-6 overflow-y-auto scrollbar-thin px-3 py-5">
                  {navGroups.map((group) => (
                    <div key={group.label} className="flex flex-col gap-1">
                      <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {group.label}
                      </p>
                      {group.links.map((link) => (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          className={({ isActive }) =>
                            cn(
                              "flex h-12 items-center gap-3 rounded-lg px-3 text-small font-medium transition-colors",
                              isActive
                                ? "bg-primary-50 font-semibold text-primary-800 dark:bg-primary-950/60 dark:text-primary-200"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <link.icon
                                className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-primary" : "")}
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                              <span className="truncate">{link.label}</span>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  ))}
                </nav>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
