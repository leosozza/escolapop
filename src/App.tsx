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
            <Route
              path="/leads"
              element={
                <AppLayout>
                  <Leads />
                </AppLayout>
              }
            />
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
