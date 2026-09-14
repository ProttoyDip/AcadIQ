import { Outlet, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, ShieldCheck, LineChart, FileSearch } from "lucide-react";
import { ThemeToggle } from "../ui/ThemeToggle";
import { fadeUp, stagger } from "../../lib/motion";

const highlights = [
  { icon: LineChart, text: "AI-scored exam quality across every course you teach" },
  { icon: FileSearch, text: "Automatic duplicate and similarity detection against past papers" },
  { icon: ShieldCheck, text: "You stay in control: AI recommends, faculty decide" },
];

export default function AuthShell() {
  return (
    <div className="flex min-h-dvh bg-background">
      {/* brand panel — desktop only */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary-800 p-12 text-white lg:flex dark:bg-primary-950">
        <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary-400/20 blur-3xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-primary-300/10 blur-3xl" />

        <Link to="/" className="relative flex w-fit items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <GraduationCap className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="text-body font-extrabold tracking-tight">AcadIQ</span>
        </Link>

        <motion.div variants={stagger()} initial="hidden" animate="visible" className="relative max-w-md">
          <motion.p variants={fadeUp} className="text-display text-white">
            Academic quality intelligence, built for faculty.
          </motion.p>

          <motion.ul variants={stagger()} className="mt-10 flex flex-col gap-5">
            {highlights.map((h) => (
              <motion.li key={h.text} variants={fadeUp} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                  <h.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="text-small leading-relaxed text-primary-100">{h.text}</span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        <p className="relative text-xs text-primary-200/70">AUST CSE Carnival &mdash; AI Build Hackathon</p>
      </div>

      {/* form panel */}
      <div className="relative flex w-full items-center justify-center px-5 py-12 sm:px-6 lg:w-1/2">
        <div className="absolute right-5 top-5 sm:right-6 sm:top-6">
          <ThemeToggle variant="icon" />
        </div>

        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex w-fit items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow">
              <GraduationCap className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="text-body font-extrabold tracking-tight">AcadIQ</span>
          </Link>

          <Outlet />
        </div>
      </div>
    </div>
  );
}
