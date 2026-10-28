import axiosClient from '../../../lib/api/axiosClient';

export const authApi = {
  login: async (credentials: any) => {
    const res = await axiosClient.post('/auth/login', credentials);
    return res.data;
  },
  
  register: async (userData: any) => {
    const res = await axiosClient.post('/auth/register', userData);
    return res.data;
  },
  
  // Bổ sung thêm hàm xử lý đăng xuất
  logout: async () => {
    localStorage.removeItem('accessToken');
    // Có thể thêm API call về backend nếu cần: await axiosClient.post('/auth/logout');
    window.location.href = '/login';
  }
};