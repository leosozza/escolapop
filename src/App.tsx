import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CRM from "./pages/CRM";
import Leads from "./pages/Leads";
import Courses from "./pages/Courses";
import Appointments from "./pages/Appointments";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Students from "./pages/Students";
import LMS from "./pages/LMS";
import Reception from "./pages/Reception";
import AgentPortfolio from "./pages/AgentPortfolio";
import ProducerQueue from "./pages/ProducerQueue";
import Classes from "./pages/Classes";
import Attendance from "./pages/Attendance";
import Contracts from "./pages/Contracts";
import Payments from "./pages/Payments";
import Overdue from "./pages/Overdue";
import Certificates from "./pages/Certificates";
import Team from "./pages/Team";
import Reports from "./pages/Reports";
import Roadmap from "./pages/Roadmap";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              }
            />
            <Route
              path="/crm"
              element={
                <AppLayout>
                  <CRM />
                </AppLayout>
              }
            />
            <Route path="/leads" element={<Navigate to="/crm" replace />} />
            <Route
              path="/courses"
              element={
                <AppLayout>
                  <Courses />
                </AppLayout>
              }
            />
            <Route
              path="/appointments"
              element={
                <AppLayout>
                  <Appointments />
                </AppLayout>
              }
            />
            <Route
              path="/students"
              element={
                <AppLayout>
                  <Students />
                </AppLayout>
              }
            />
            <Route
              path="/lms"
              element={
                <AppLayout>
                  <LMS />
                </AppLayout>
              }
            />
            <Route
              path="/reception"
              element={
                <AppLayout>
                  <Reception />
                </AppLayout>
              }
            />
            <Route
              path="/agent-portfolio"
              element={
                <AppLayout>
                  <AgentPortfolio />
                </AppLayout>
              }
            />
            <Route
              path="/producer-queue"
              element={
                <AppLayout>
                  <ProducerQueue />
                </AppLayout>
              }
            />
            <Route
              path="/classes"
              element={
                <AppLayout>
                  <Classes />
                </AppLayout>
              }
            />
            <Route
              path="/attendance"
              element={
                <AppLayout>
                  <Attendance />
                </AppLayout>
              }
            />
            <Route
              path="/contracts"
              element={
                <AppLayout>
                  <Contracts />
                </AppLayout>
              }
            />
            <Route
              path="/payments"
              element={
                <AppLayout>
                  <Payments />
                </AppLayout>
              }
            />
            <Route
              path="/overdue"
              element={
                <AppLayout>
                  <Overdue />
                </AppLayout>
              }
            />
            <Route
              path="/certificates"
              element={
                <AppLayout>
                  <Certificates />
                </AppLayout>
              }
            />
            <Route
              path="/team"
              element={
                <AppLayout>
                  <Team />
                </AppLayout>
              }
            />
            <Route
              path="/reports"
              element={
                <AppLayout>
                  <Reports />
                </AppLayout>
              }
            />
            <Route
              path="/roadmap"
              element={
                <AppLayout>
                  <Roadmap />
                </AppLayout>
              }
            />
            <Route
              path="/users"
              element={
                <AppLayout>
                  <Users />
                </AppLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <AppLayout>
                  <Settings />
                </AppLayout>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
