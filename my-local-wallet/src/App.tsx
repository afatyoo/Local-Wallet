import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import IncomePage from "./pages/Income";
import ExpensePage from "./pages/Expense";
import BillsPage from "./pages/Bills";
import BudgetPage from "./pages/Budget";
import SavingsPage from "./pages/Savings";
import ReportsPage from "./pages/Reports";
import MasterDataPage from "./pages/MasterData";
import SettingsPage from "./pages/Settings";
import InsightsPage from "./pages/Insights";
import HealthScorePage from "./pages/HealthScore";
import HeatmapPage from "./pages/Heatmap";
import TargetsPage from "./pages/Targets";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
