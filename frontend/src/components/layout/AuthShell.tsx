import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, LineChart, FileSearch } from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";

const highlights = [
  { icon: LineChart, text: "AI-scored exam quality across every course you teach" },
  { icon: FileSearch, text: "Automatic duplicate & similarity detection against past papers" },
  { icon: ShieldCheck, text: "You stay in control — AI recommends, faculty decide" },
];

export default function AuthShell() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary-500">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-body font-bold tracking-tight">AcadIQ</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md"
        >
          <p className="text-display leading-[1.05] tracking-tight">
            Academic quality intelligence, built for faculty.
          </p>
          <div className="mt-10 flex flex-col gap-5">
            {highlights.map((h) => (
              <div key={h.text} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10">
                  <h.icon className="h-4 w-4" />
                </div>
                <p className="text-small text-white/80">{h.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="text-xs text-white/40">AUST CSE Carnival — AI Build Hackathon</p>

        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-secondary-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-primary-700/30 blur-3xl" />
      </div>

      <div className="relative flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="absolute right-6 top-6">
          <ThemeToggle variant="icon" />
        </div>
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
