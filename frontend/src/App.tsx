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
import UploadAnalysis from "./pages/UploadAnalysis";
import AnalysisReport from "./pages/AnalysisReport";
import QuestionMemory from "./pages/QuestionMemory";
import Settings from "./pages/Settings";
import DualEvaluatorPage from "./pages/DualEvaluatorPage";
import AdminUsers from "./pages/AdminUsers";

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
            <Route path="/upload" element={<UploadAnalysis />} />
            <Route path="/reports/:id" element={<AnalysisReport />} />
            <Route path="/question-memory" element={<QuestionMemory />} />
            <Route path="/dual-evaluate" element={<DualEvaluatorPage />} />
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

