import { useNavigate } from 'react-router-dom';
import { authApi } from '../features/auth/services/authApi';

export default function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authApi.logout(); // Xóa token và xử lý đăng xuất
      navigate('/login'); // Chuyển hướng về trang đăng nhập
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Dashboard</h2>
      <p>Welcome to the system! You are successfully logged in.</p>
      
      <button 
        onClick={handleLogout} 
        style={{ padding: '10px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', cursor: 'pointer' }}
      >
        Logout
      </button>
    </div>
  );
}