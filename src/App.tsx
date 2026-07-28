import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "@/lib/router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SessionGate } from "@/components/SessionGate";
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const IncomePage = lazy(() => import("./pages/Income"));
const ExpensePage = lazy(() => import("./pages/Expense"));
const BillsPage = lazy(() => import("./pages/Bills"));
const BudgetPage = lazy(() => import("./pages/Budget"));
const SavingsPage = lazy(() => import("./pages/Savings"));
const ReportsPage = lazy(() => import("./pages/Reports"));
const MasterDataPage = lazy(() => import("./pages/MasterData"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const InsightsPage = lazy(() => import("./pages/Insights"));
const HealthScorePage = lazy(() => import("./pages/HealthScore"));
const HeatmapPage = lazy(() => import("./pages/Heatmap"));
const TargetsPage = lazy(() => import("./pages/Targets"));
const UserManagementPage = lazy(() => import("./pages/UserManagement"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SessionGate>
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-background" aria-busy="true" />}>
            <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/income" element={<ProtectedRoute><IncomePage /></ProtectedRoute>} />
            <Route path="/expense" element={<ProtectedRoute><ExpensePage /></ProtectedRoute>} />
            <Route path="/bills" element={<ProtectedRoute><BillsPage /></ProtectedRoute>} />
            <Route path="/budget" element={<ProtectedRoute><BudgetPage /></ProtectedRoute>} />
            <Route path="/savings" element={<ProtectedRoute><SavingsPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />
            <Route path="/health-score" element={<ProtectedRoute><HealthScorePage /></ProtectedRoute>} />
            <Route path="/heatmap" element={<ProtectedRoute><HeatmapPage /></ProtectedRoute>} />
            <Route path="/targets" element={<ProtectedRoute><TargetsPage /></ProtectedRoute>} />
            <Route path="/master-data" element={<ProtectedRoute><MasterDataPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/user-management" element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </SessionGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
