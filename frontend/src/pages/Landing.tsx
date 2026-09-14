import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  Layers,
  Brain,
  ArrowRight,
  Award,
  ShieldCheck,
  BarChart3,
  FileSearch,
  Check,
  Menu,
  X,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { fadeUp, stagger, inView } from "../lib/motion";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#outcomes", label: "Outcomes" },
];

const features = [
  {
    icon: Brain,
    title: "Bloom's Taxonomy Audit",
    body: "Every question is classified across Remember through Create, so you can see at a glance whether a paper leans on recall or genuinely tests higher-order thinking.",
  },
  {
    icon: BookOpen,
    title: "Syllabus Alignment",
    body: "Papers are cross-examined against the course outline to surface uncovered modules and over-weighted topics before the exam goes out.",
  },
  {
    icon: Layers,
    title: "Academic Memory",
    body: "Semantic similarity checks against every past paper you have uploaded, so repeated questions are caught while there is still time to change them.",
  },
  {
    icon: Award,
    title: "CO-PO Outcome Mapping",
    body: "Accreditation-ready outcome attainment reports generated from the same analysis, with no separate spreadsheet exercise at audit time.",
  },
  {
    icon: BarChart3,
    title: "Difficulty & Marks Balance",
    body: "Marks distribution, difficulty spread and section weighting charted together, with concrete suggestions where the balance drifts.",
  },
  {
    icon: ShieldCheck,
    title: "Explainable by Default",
    body: "Every score shows the evidence behind it and cites the source text. The AI recommends; the faculty member decides.",
  },
];

const steps = [
  { n: "01", title: "Upload", body: "Drop in the question paper and the course syllabus as PDFs." },
  { n: "02", title: "Extract", body: "Questions, marks, sections and topic tags are parsed automatically." },
  { n: "03", title: "Audit", body: "Cognitive depth, curriculum coverage and uniqueness are scored together." },
  { n: "04", title: "Export", body: "Share faculty analytics and OBE compliance reports with your department." },
];

const outcomes = [
  "Catch repeated questions before the paper is printed",
  "Show outcome attainment without a manual spreadsheet",
  "Give every reviewer the same objective quality baseline",
  "Keep a searchable record of every paper across semesters",
];

const stats = [
  { value: "6", label: "Quality axes scored per paper" },
  { value: "< 2 min", label: "From upload to full report" },
  { value: "100%", label: "Findings traced to source text" },
];

const coRows = [
  { co: "CO1", label: "Explain core concepts", pct: 94 },
  { co: "CO2", label: "Apply design techniques", pct: 78 },
  { co: "CO3", label: "Analyse trade-offs", pct: 61 },
  { co: "CO4", label: "Design a full solution", pct: 42 },
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-small focus:font-semibold focus:shadow-elevated"
      >
        Skip to content
      </a>

      {/* ---------------------------------------------------------------- nav */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
          <Link to="/" className="group flex items-center gap-2.5" aria-label="AcadIQ home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-glow transition-transform duration-200 ease-out group-hover:scale-105">
              <GraduationCap className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">AcadIQ</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="relative text-small font-medium text-muted-foreground transition-colors hover:text-foreground after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-0 after:bg-primary after:transition-all after:duration-200 hover:after:w-full"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle variant="icon" />
            <Link to="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link to="/register" className="hidden sm:block">
              <Button size="sm" className="group">
                Get started
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Button>
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-nav" className="border-t border-border bg-card px-5 py-4 md:hidden">
            <nav aria-label="Mobile" className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md px-3 py-2.5 text-small font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                <Button variant="outline" className="w-full">
                  Log in
                </Button>
              </Link>
              <Link to="/register" onClick={() => setMenuOpen(false)}>
                <Button className="w-full">Get started free</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main id="main">
        {/* -------------------------------------------------------------- hero */}
        <section className="brand-wash relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-grid-sand [background-size:64px_64px] [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]"
          />
          <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-24">
            <motion.div variants={stagger(0.08)} initial="hidden" animate="visible" className="mx-auto max-w-3xl text-center">
              <motion.p variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3.5 py-1.5 text-eyebrow uppercase text-primary-700 dark:border-primary-800 dark:bg-primary-950/60 dark:text-primary-300">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Academic intelligence platform
                </span>
              </motion.p>

              <motion.h1 variants={fadeUp} className="mt-6 text-hero">
                Exam quality you can <span className="text-gradient-brand">actually prove</span>
              </motion.h1>

              <motion.p variants={fadeUp} className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                AcadIQ reads your question papers the way a moderation committee would, scoring cognitive depth,
                auditing syllabus coverage, catching repeated questions and mapping course outcomes, with the
                evidence attached to every finding.
              </motion.p>

              <motion.div variants={fadeUp} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/register" className="w-full sm:w-auto">
                  <Button size="lg" className="group w-full sm:w-auto">
                    Get started free
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Button>
                </Link>
                <Link to="/login" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    Log in to portal
                  </Button>
                </Link>
              </motion.div>

              <motion.p variants={fadeUp} className="mt-5 text-small text-muted-foreground">
                No credit card required &middot; Built for faculty and accreditation committees
              </motion.p>
            </motion.div>

            {/* product preview */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto mt-16 max-w-5xl"
            >
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-float">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sand-300" />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sand-300" />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sand-300" />
                    <span className="ml-2 truncate text-xs font-medium text-muted-foreground">
                      CSE 3201 Final Exam &middot; Evaluation report
                    </span>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-success-border bg-success-bg px-2.5 py-1 text-xs font-semibold text-success sm:inline-flex">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Audit ready
                  </span>
                </div>

                <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-3">
                  <PreviewTile
                    icon={Brain}
                    label="Cognitive depth"
                    value="72 / 100"
                    note="HOTS share below target, 3 recall items flagged"
                    tone="warning"
                  />
                  <PreviewTile
                    icon={BookOpen}
                    label="Syllabus coverage"
                    value="91%"
                    note="Module 4 (Concurrency) not represented"
                    tone="success"
                  />
                  <PreviewTile
                    icon={FileSearch}
                    label="Question uniqueness"
                    value="2 matches"
                    note="Q3(b) is 88% similar to Spring 2024 Q5"
                    tone="error"
                  />
                </div>

                <div className="border-t border-border px-4 pb-5 pt-4 sm:px-6">
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                    <span>Overall quality score</span>
                    <span className="tnum font-semibold text-foreground">84 / 100</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "84%" }}
                      transition={{ duration: 1, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ------------------------------------------------------------- stats */}
        <section className="border-y border-border bg-card/60">
          <motion.dl
            variants={stagger()}
            {...inView}
            className="mx-auto grid max-w-5xl grid-cols-1 divide-y divide-border px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8"
          >
            {stats.map((s) => (
              <motion.div key={s.label} variants={fadeUp} className="px-4 py-8 text-center">
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block text-display text-primary">{s.value}</span>
                  <span className="mt-1.5 block text-small text-muted-foreground">{s.label}</span>
                </dd>
              </motion.div>
            ))}
          </motion.dl>
        </section>

        {/* ---------------------------------------------------------- features */}
        <section id="features" className="scroll-mt-20 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <motion.div variants={stagger()} {...inView} className="mx-auto max-w-2xl text-center">
              <motion.p variants={fadeUp} className="text-eyebrow uppercase text-primary">
                Purpose-built for academics
              </motion.p>
              <motion.h2 variants={fadeUp} className="mt-3 text-display">
                Everything a moderation committee checks, automated
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-body text-muted-foreground">
                Six analyses run on every upload, each producing findings you can defend in a departmental review.
              </motion.p>
            </motion.div>

            <motion.ul variants={stagger()} {...inView} className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <motion.li
                  key={f.title}
                  variants={fadeUp}
                  className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-200 ease-out hover:-translate-y-1 hover:border-primary-300 hover:shadow-elevated dark:hover:border-primary-700"
                >
                  <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-700 transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground dark:border-primary-800/60 dark:bg-primary-950/60 dark:text-primary-300">
                    <f.icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="text-section">{f.title}</h3>
                  <p className="mt-2 text-small leading-relaxed text-muted-foreground">{f.body}</p>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </section>

        {/* ------------------------------------------------------ how it works */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-card/60 py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
            <motion.div variants={stagger()} {...inView} className="mx-auto max-w-2xl text-center">
              <motion.p variants={fadeUp} className="text-eyebrow uppercase text-primary">
                Streamlined workflow
              </motion.p>
              <motion.h2 variants={fadeUp} className="mt-3 text-display">
                Four steps from PDF to defensible report
              </motion.h2>
            </motion.div>

            <motion.ol
              variants={stagger(0.1)}
              {...inView}
              className="relative mt-14 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
              />
              {steps.map((s) => (
                <motion.li key={s.n} variants={fadeUp} className="relative text-center">
                  <span className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold tabular-nums text-primary-foreground shadow-glow ring-8 ring-card">
                    {s.n}
                  </span>
                  <h3 className="mt-5 text-section">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-small leading-relaxed text-muted-foreground">{s.body}</p>
                </motion.li>
              ))}
            </motion.ol>
          </div>
        </section>

        {/* ---------------------------------------------------------- outcomes */}
        <section id="outcomes" className="scroll-mt-20 py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-6 lg:grid-cols-2 lg:px-8">
            <motion.div variants={stagger()} {...inView}>
              <motion.p variants={fadeUp} className="text-eyebrow uppercase text-primary">
                Why departments adopt it
              </motion.p>
              <motion.h2 variants={fadeUp} className="mt-3 text-display">
                Less paperwork at audit time, better papers all year
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-4 text-body text-muted-foreground">
                The same analysis that improves an individual paper also produces the evidence trail your
                accreditation committee asks for, so quality work and compliance work stop being two jobs.
              </motion.p>

              <motion.ul variants={stagger()} className="mt-8 flex flex-col gap-4">
                {outcomes.map((o) => (
                  <motion.li key={o} variants={fadeUp} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="text-small leading-relaxed text-foreground">{o}</span>
                  </motion.li>
                ))}
              </motion.ul>
            </motion.div>

            <motion.div variants={fadeUp} {...inView} className="relative">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-elevated sm:p-8">
                <div className="flex items-center gap-3 border-b border-border pb-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                    <Award className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-small font-semibold">Outcome attainment</p>
                    <p className="text-xs text-muted-foreground">CSE 3201 &middot; Spring 2026</p>
                  </div>
                </div>

                <ul className="mt-5 flex flex-col gap-5">
                  {coRows.map((row, i) => (
                    <li key={row.co}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="min-w-0 text-small font-medium">
                          <span className="font-semibold text-primary">{row.co}</span>{" "}
                          <span className="text-muted-foreground">{row.label}</span>
                        </span>
                        <span className="tnum shrink-0 text-small font-semibold">{row.pct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${row.pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full bg-primary"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </section>

        {/* --------------------------------------------------------------- CTA */}
        <section className="px-5 pb-20 sm:px-6 lg:px-8 lg:pb-28">
          <motion.div
            variants={fadeUp}
            {...inView}
            className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-primary-800 px-6 py-16 text-center shadow-float dark:bg-primary-900 sm:px-12"
          >
            <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl" />
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-primary-300/10 blur-3xl" />
            <div className="relative">
              <h2 className="text-display text-white">Ready to upgrade your evaluation process?</h2>
              <p className="mx-auto mt-4 max-w-xl text-body text-primary-100">
                Set up your first course and run a paper through AcadIQ in under five minutes.
              </p>
              <div className="mt-9 flex justify-center">
                <Link to="/register">
                  <Button
                    size="lg"
                    className="group bg-white text-primary-800 shadow-elevated hover:bg-primary-50 focus-visible:ring-white focus-visible:ring-offset-primary-800"
                  >
                    Get started free
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* ------------------------------------------------------------- footer */}
      <footer className="border-t border-border bg-card/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 py-10 sm:px-6 lg:flex-row lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-bold tracking-tight">AcadIQ</span>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            <Link to="/login" className="text-small text-muted-foreground transition-colors hover:text-foreground">
              Log in
            </Link>
            <Link to="/register" className="text-small text-muted-foreground transition-colors hover:text-foreground">
              Register
            </Link>
            <Link to="/forgot-password" className="text-small text-muted-foreground transition-colors hover:text-foreground">
              Forgot password
            </Link>
          </nav>

          <p className="text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} AcadIQ Academic Intelligence Platform
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

const tones = {
  success: "border-success-border bg-success-bg text-success",
  warning: "border-warning-border bg-warning-bg text-warning",
  error: "border-error-border bg-error-bg text-error",
} as const;

function PreviewTile({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: typeof Brain;
  label: string;
  value: string;
  note: string;
  tone: keyof typeof tones;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <p className="mt-2 tnum text-xl font-bold tracking-tight">{value}</p>
      <p className={`mt-3 rounded-md border px-2 py-1.5 text-xs leading-snug ${tones[tone]}`}>{note}</p>
    </div>
  );
}
