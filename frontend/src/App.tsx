import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthShell from "./components/layout/AuthShell";
import AppShell from "./components/layout/AppShell";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import UploadAnalysis from "./pages/UploadAnalysis";
import AnalysisReport from "./pages/AnalysisReport";
import QuestionMemory from "./pages/QuestionMemory";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthShell />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/upload" element={<UploadAnalysis />} />
            <Route path="/reports/:id" element={<AnalysisReport />} />
            <Route path="/question-memory" element={<QuestionMemory />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
