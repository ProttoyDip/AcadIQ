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
} from "lucide-react";
import { Button } from "../components/ui/button";
import { ThemeToggle } from "../components/ui/ThemeToggle";

// Framer motion animation variants respecting prefers-reduced-motion
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
    },
  },
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      {/* PERSISTENT TOP NAV BAR */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
              AcadIQ
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle variant="icon" />

            <Link to="/login">
              <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800/60 font-medium">
                Log In
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.02]">
                Get Started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative pt-20 pb-24 lg:pt-32 lg:pb-36 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-pink-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider shadow-inner"
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span>Next-Gen Academic Intelligence Platform</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]"
              >
                Elevate Exam Quality & Curriculum Alignment with <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-300 to-indigo-200">AI Intelligence</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed"
              >
                AcadIQ empowers faculty members and academic heads to automatically evaluate exam paper depth, map Bloom's Taxonomy, audit syllabus coverage, and maintain outcome quality.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4"
              >
                <Link to="/register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-6 text-base rounded-xl shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02]">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/login" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-slate-700 bg-slate-800/40 text-slate-200 hover:bg-slate-800 hover:text-white px-8 py-6 text-base rounded-xl transition-all">
                    Log In to Portal
                  </Button>
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="mt-16 relative max-w-5xl mx-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-sm overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs font-medium text-slate-400">AcadIQ Evaluation System</span>
                </div>
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  AI Audit Ready
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>Bloom's Taxonomy Index</span>
                    <Brain className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="text-[15px] font-semibold text-white">Cognitive Level Analysis</div>
                  <div className="mt-2 text-xs text-indigo-300">Audits Remember vs HOTS balance</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>Syllabus Coverage</span>
                    <BookOpen className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="text-[15px] font-semibold text-white">Curriculum Mapping</div>
                  <div className="mt-2 text-xs text-emerald-400">Tracks topic distribution & missing modules</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                    <span>Question Memory</span>
                    <Layers className="h-4 w-4 text-pink-400" />
                  </div>
                  <div className="text-[15px] font-semibold text-white">Similarity Detection</div>
                  <div className="mt-2 text-xs text-slate-300">Compares current exam vs past papers</div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="features" className="py-24 bg-slate-900/60 border-t border-b border-slate-800/80 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
              <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Purpose-Built for Academics</h2>
              <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Everything You Need for Academic Excellence</p>
              <p className="text-slate-400 text-sm sm:text-base">Comprehensive AI tools tailored specifically for faculty members, course coordinators, and accreditation committees.</p>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              <motion.div variants={fadeIn} className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 hover:border-indigo-500/50 hover:bg-slate-800/80 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5 text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Brain className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Bloom's Taxonomy Audit</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Automatically categorize questions into Remember, Apply, Analyze, and Create cognitive levels with actionable feedback.
                </p>
              </motion.div>

              <motion.div variants={fadeIn} className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 hover:border-purple-500/50 hover:bg-slate-800/80 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-5 text-purple-400 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all">
                  <BookOpen className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Syllabus Alignment</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Cross-examine exam papers against course outlines to guarantee 100% curriculum coverage and spot missing topics.
                </p>
              </motion.div>

              <motion.div variants={fadeIn} className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 hover:border-pink-500/50 hover:bg-slate-800/80 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mb-5 text-pink-400 group-hover:scale-110 group-hover:bg-pink-600 group-hover:text-white transition-all">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Question Memory Bank</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Prevent repetitive exam papers across semesters with AI semantic similarity checks and reusable question repositories.
                </p>
              </motion.div>

              <motion.div variants={fadeIn} className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Award className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">CO-PO Mapping & Rubrics</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Generate accreditation-ready outcome reports (OBE) and standardized AI grading rubrics effortlessly.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section id="how-it-works" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
              <h2 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Streamlined Workflow</h2>
              <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Four Steps to Superior Academic Quality</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
              <div className="relative flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/30">
                  01
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Upload Files</h4>
                <p className="text-slate-400 text-sm">Upload question papers and course syllabus documents in PDF format.</p>
              </div>

              <div className="relative flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/30">
                  02
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">AI Extraction</h4>
                <p className="text-slate-400 text-sm">Our AI parses structure, question metadata, marks distribution, and topic tags.</p>
              </div>

              <div className="relative flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/30">
                  03
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Multi-Axis Audit</h4>
                <p className="text-slate-400 text-sm">Evaluates cognitive depth, curriculum alignment, and question uniqueness.</p>
              </div>

              <div className="relative flex flex-col items-center text-center">
                <div className="h-14 w-14 rounded-2xl bg-indigo-600 text-white font-bold text-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-600/30">
                  04
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Export Insights</h4>
                <p className="text-slate-400 text-sm">Download detailed faculty analytics and OBE accreditation compliance reports.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 relative overflow-hidden">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Ready to Upgrade Your Academic Evaluation Process?
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto text-base sm:text-lg">
              Join faculty members transforming course quality, exam balance, and outcome accreditation with AcadIQ.
            </p>
            <div className="pt-4 flex justify-center">
              <Link to="/register">
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-9 py-6 text-lg rounded-xl shadow-2xl shadow-indigo-600/40 transition-all hover:scale-105">
                  Get Started Free Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">AcadIQ</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
            <Link to="/login" className="hover:text-white transition-colors">Log In</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
            <Link to="/forgot-password" className="hover:text-indigo-400 transition-colors font-medium">
              Forgot password?
            </Link>
          </div>

          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} AcadIQ Academic Intelligence Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
