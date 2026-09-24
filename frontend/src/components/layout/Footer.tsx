import { Link } from "react-router-dom";

interface FooterProps {
  variant?: "app" | "landing";
}

export default function Footer({ variant = "app" }: FooterProps) {
  const year = new Date().getFullYear();

  if (variant === "landing") {
    return (
      <footer className="relative z-10 border-t border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 py-10 sm:px-6 lg:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-[#F4F5EE] p-1 shadow-sm">
              <img src="/logo-icon.png" alt="AcadIQ Logo" className="h-full w-full object-contain" />
            </span>
            <div>
              <span className="text-base font-extrabold tracking-tight">AcadIQ</span>
              <p className="text-[11px] text-muted-foreground">AI Academic Intelligence Platform</p>
            </div>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            <Link to="/login" className="text-small text-muted-foreground transition-colors hover:text-foreground">
              Log in
            </Link>
            <Link to="/register" className="text-small text-muted-foreground transition-colors hover:text-foreground">
              Register
            </Link>
            <a href="#features" className="text-small text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#pipeline" className="text-small text-muted-foreground transition-colors hover:text-foreground">
              Pipeline
            </a>
            <a href="#dual-eval" className="text-small text-muted-foreground transition-colors hover:text-foreground">
              Dual-LLM
            </a>
          </nav>

          <p className="text-xs text-muted-foreground">
            &copy; {year} AcadIQ &middot; Built for AUST CSE Carnival AI Build Hackathon.
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto border-t border-border/70 bg-card/50 px-5 py-4 backdrop-blur-sm sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-[#F4F5EE] p-0.5 shadow-xs">
            <img src="/logo-icon.png" alt="AcadIQ" className="h-full w-full object-contain" />
          </span>
          <span className="font-semibold text-foreground">AcadIQ</span>
          <span className="text-border">&bull;</span>
          <span>Faculty Quality Assurance Portal</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <Link to="/dashboard" className="transition-colors hover:text-foreground">
            Dashboard
          </Link>
          <Link to="/courses" className="transition-colors hover:text-foreground">
            Courses
          </Link>
          <Link to="/schedule" className="transition-colors hover:text-foreground">
            Schedule
          </Link>
          <Link to="/ai" className="transition-colors hover:text-foreground">
            AI Hub
          </Link>
          <span className="text-border">&bull;</span>
          <span>&copy; {year} AcadIQ &middot; AUST CSE Carnival</span>
        </div>
      </div>
    </footer>
  );
}
