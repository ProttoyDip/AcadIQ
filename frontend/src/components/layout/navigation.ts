import {
  LayoutDashboard,
  GraduationCap,
  UploadCloud,
  Settings as SettingsIcon,
  History,
  BrainCircuit,
  FileBarChart,
  Wand2,
  Library,
  CalendarDays,
  Cpu,
  FileText,
  Eye,
  ListOrdered,
  type LucideIcon,
} from "lucide-react";

export interface NavLinkItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  links: NavLinkItem[];
}

/** Single source of truth for portal navigation — the sidebar and the mobile
 *  drawer render the same structure so placement never drifts between them. */
export const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    links: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/courses", label: "Courses", icon: GraduationCap },
      { to: "/schedule", label: "Schedule", icon: CalendarDays },
      { to: "/upload", label: "Upload & Analyze", icon: UploadCloud },
      { to: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    label: "Local AI",
    links: [
      { to: "/ai", label: "AI Hub", icon: Cpu },
      { to: "/ai/pdf", label: "PDF Assistant", icon: FileText },
      { to: "/ai/image", label: "Image Assistant", icon: Eye },
      { to: "/ai/questions", label: "Question Generator", icon: ListOrdered },
    ],
  },
  {
    label: "Intelligence",
    links: [
      { to: "/dual-evaluate", label: "Dual LLM Evaluator", icon: BrainCircuit },
      { to: "/question-memory", label: "Academic Memory", icon: History },
      { to: "/paper-generator", label: "Paper Generator", icon: Wand2 },
      { to: "/question-bank", label: "Question Bank", icon: Library },
    ],
  },
  {
    label: "Account",
    links: [{ to: "/settings", label: "Settings", icon: SettingsIcon }],
  },
];
