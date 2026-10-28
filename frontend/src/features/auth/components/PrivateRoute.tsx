import { Navigate, Outlet } from 'react-router-dom';

interface PrivateRouteProps {
  allowedRoles?: string[];
}

export default function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const token = localStorage.getItem('accessToken');
  
  // Lấy thông tin role của người dùng từ LocalStorage
  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  const userRole = user?.role || localStorage.getItem('userRole'); // Hỗ trợ cả 'teacher' hoặc 'INSTRUCTOR'

  // 1. Nếu chưa đăng nhập -> Chuyển về trang Sign In
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 2. Nếu Route yêu cầu Role cụ thể mà người dùng không đáp ứng -> Đẩy về Dashboard
  if (allowedRoles && (!userRole || !allowedRoles.includes(userRole))) {
    alert('Tài khoản của bạn không có quyền truy cập vào khu vực Giáo viên!');
    return <Navigate to="/dashboard" replace />;
  }

  // 3. Đúng quyền -> Cho phép truy cập route con
  return <Outlet />;
}