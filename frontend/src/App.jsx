import { Route, Routes } from 'react-router-dom';
import { LoginCallback } from '@okta/okta-react';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Login />} />
        <Route path="/login/callback" element={<LoginCallback />} />

        {/* Any authenticated user */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        {/* Manager group only */}
        <Route
          path="/manager"
          element={
            <ProtectedRoute requiredGroup="Manager">
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin group only */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredGroup="Admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;
