import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthShell from "./components/layout/AuthShell";
import AppShell from "./components/layout/AppShell";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import Reports from "./pages/Reports";
import UploadAnalysis from "./pages/UploadAnalysis";
import AnalysisReport from "./pages/AnalysisReport";
import QuestionMemory from "./pages/QuestionMemory";
import PaperGenerator from "./pages/PaperGenerator";
import QuestionBank from "./pages/QuestionBank";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";
import DualEvaluatorPage from "./pages/DualEvaluatorPage";
import AdminUsers from "./pages/AdminUsers";
import AiHub from "./pages/ai/AiHub";
import PdfAssistant from "./pages/ai/PdfAssistant";
import ImageAssistant from "./pages/ai/ImageAssistant";
import QuestionGenerator from "./pages/ai/QuestionGenerator";

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Authentication Pages */}
        <Route element={<AuthShell />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* Faculty Protected Portal Routes */}
        <Route element={<ProtectedRoute role="FACULTY" />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:id" element={<CourseDetail />} />
            <Route path="/upload" element={<UploadAnalysis />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:id" element={<AnalysisReport />} />
            <Route path="/question-memory" element={<QuestionMemory />} />
            <Route path="/paper-generator" element={<PaperGenerator />} />
            <Route path="/question-bank" element={<QuestionBank />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/dual-evaluate" element={<DualEvaluatorPage />} />
            <Route path="/ai" element={<AiHub />} />
            <Route path="/ai/pdf" element={<PdfAssistant />} />
            <Route path="/ai/image" element={<ImageAssistant />} />
            <Route path="/ai/questions" element={<QuestionGenerator />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="ADMIN" />}>
          <Route element={<AppShell />}>
            <Route path="/admin/users" element={<AdminUsers />} />
          </Route>
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

