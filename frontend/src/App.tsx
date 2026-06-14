import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { Layout } from '@/components/layout/Layout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import Home from '@/pages/Home';
import TaskDetail from '@/pages/TaskDetail';
import AdminSetup from '@/pages/AdminSetup';
import Overview from '@/pages/admin/Overview';
import SystemConfig from '@/pages/admin/SystemConfig';
import ModelManagement from '@/pages/admin/ModelManagement';
import LlmConfig from '@/pages/admin/LlmConfig';
import LogViewer from '@/pages/admin/LogViewer';
import UserManagement from '@/pages/admin/UserManagement';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/admin/setup" element={<AdminSetup />} />

            {/* Redirects for removed pages */}
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/" replace />} />
            <Route path="/dashboard" element={<Navigate to="/#recent" replace />} />
          </Route>

          {/* Admin routes with sidebar layout */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route path="config" element={<SystemConfig />} />
            <Route path="models" element={<ModelManagement />} />
            <Route path="llm" element={<LlmConfig />} />
            <Route path="logs" element={<LogViewer />} />
            <Route path="users" element={<UserManagement />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
