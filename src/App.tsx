
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate  } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PocListPage from "./pages/PocListPage";
import PocDetailPage from "./pages/PocDetailPage";
import PocFormPage from "./pages/PocFormPage";
//import EmployeeListPage from "./pages/EmployeeListPage";
import AllEmployeesPage from "./pages/AllEmployeesPage";
import DeliveryTeamPage from "./pages/DeliveryTeamPage";
import ManagedServicesPage from "./pages/ManagedServicesPage";
import AccountManagersPage from "./pages/AccountManagersPage";
import TechnicalTeamMemberDetailPage from "./pages/TechnicalTeamMemberDetailPage"; 
import TechnicalProfileFormPage from "./pages/TechnicalProfileFormPage";
import MyInfoPage from "./pages/MyInfoPage";
import CustomersPage from "./pages/CustomersPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import NotFound from "./pages/NotFound";
import ResetPasswordPage from './pages/ResetPasswordPage';

// Project pages
import ProjectListPage from './pages/ProjectListPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectFormPage from './pages/ProjectFormPage';
import ProjectTasksPage from './pages/ProjectTasksPage';


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>

            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/action" element={<ResetPasswordPage />} /> 
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            
            
            
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/pocs" 
              element={
                <ProtectedRoute>
                  <PocListPage />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/pocs/:id" 
              element={
                <ProtectedRoute>
                  <PocDetailPage />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/pocs/create" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'poc', action: 'create' }}>
                  <PocFormPage />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/pocs/:id/edit" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'poc', action: 'edit' }}>
                  <PocFormPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/projects" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'project', action: 'view' }}>
                  <ProjectListPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/projects/create" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'project', action: 'create' }}>
                  <ProjectFormPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/projects/:id" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'project', action: 'view' }}>
                  <ProjectDetailPage />
                </ProtectedRoute>
              } 
            />
            <Route 
            path="/projects/:projectId/tasks" 
            element={
              <ProtectedRoute requiredPermission={{ resource: 'project', action: 'view' }}>
                <ProjectTasksPage />
              </ProtectedRoute>
            } 
          />
            <Route 
              path="/projects/:id/edit" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'project', action: 'edit' }}>
                  <ProjectFormPage />
                </ProtectedRoute>
              } 
            />
            
            <Route path="/employees" element={<Navigate to="/employees/all" replace />} /> 
            <Route 
              path="/employees/all" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'employee', action: 'manage' }}>
                  <AllEmployeesPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/employees/delivery-team" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'employee', action: 'manage' }}>
                  <DeliveryTeamPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/employees/managed-services" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'employee', action: 'manage' }}>
                  <ManagedServicesPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/employees/account-managers" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'employee', action: 'manage' }}>
                  <AccountManagersPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/employees/technical-profile/:employeeId" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'employee', action: 'manage' }}>
                  <TechnicalTeamMemberDetailPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/employees/technical-profile/:employeeId/edit" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'employee', action: 'manage' }}> {/* Ensure this permission is correct */}
                  <TechnicalProfileFormPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/my-info" 
              element={
                <ProtectedRoute>
                  <MyInfoPage />
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/customers" 
              element={
                <ProtectedRoute requiredPermission={{ resource: 'customer', action: 'view' }}>
                  <CustomersPage />
                </ProtectedRoute>
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
