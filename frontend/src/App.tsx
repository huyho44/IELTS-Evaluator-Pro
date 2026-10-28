import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './features/auth/pages/LoginPage';
import RegisterPage from './features/auth/pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './features/auth/components/PrivateRoute';
import ReviewQueuePage from './features/instructor/pages/ReviewQueuePage';
import ReviewDetailPage from './features/instructor/pages/ReviewDetailPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Common Protected Routes (Dành cho mọi User đã đăng nhập) */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Teacher Protected Routes (Chỉ dành cho tài khoản có Role teacher/INSTRUCTOR) */}
        <Route element={<PrivateRoute allowedRoles={['teacher', 'INSTRUCTOR', 'TEACHER']} />}>
          <Route path="/teacher/reviews" element={<ReviewQueuePage />} />
          <Route path="/teacher/reviews/:id" element={<ReviewDetailPage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;