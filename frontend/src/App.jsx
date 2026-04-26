import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import SignupPage from './pages/SignupPage';
import SigninPage from './pages/SigninPage';
import Dashboard from './pages/Dashboard';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-base">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }
  return user ? children : <Navigate to="/signin" />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-base">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }
  return user ? <Navigate to="/dashboard" /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
          <Route path="/signin" element={<PublicRoute><SigninPage /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
