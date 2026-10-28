import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { instructorApi } from '../services/instructorApi';

export default function ReviewQueuePage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    instructorApi.getReviewQueue()
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Error fetching review queue:', err))
      .finally(() => setLoading(false));
  }, []);

  // Hàm hỗ trợ render Badge trạng thái theo màu chuẩn Figma
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-blue-500"></span>
            In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-emerald-500"></span>
            Completed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-amber-500"></span>
            Pending
          </span>
        );
    }
  };

  // Lọc danh sách theo Tab và Search
  const filteredReviews = reviews.filter((item) => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesSearch = 
      (item.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.studentName || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Tiêu đề */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Central Grading Queue</h1>
            <p className="text-sm text-gray-500 mt-1">Manage, claim, and evaluate submitted IELTS Writing essays.</p>
          </div>
        </div>

        {/* Thống kê nhanh (Stats Overview Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Review</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {reviews.filter(r => !r.status || r.status === 'PENDING').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-semibold">
              ⏳
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">In Progress</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {reviews.filter(r => r.status === 'IN_PROGRESS').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-semibold">
              ✍️
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Completed Today</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {reviews.filter(r => r.status === 'COMPLETED').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-semibold">
              ✅
            </div>
          </div>
        </div>

        {/* Khung tìm kiếm và bộ lọc Tab */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Thanh Tab trạng thái */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg self-start">
              {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    statusFilter === tab
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab === 'ALL' ? 'All Submissions' : tab.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Ô tìm kiếm */}
            <div className="relative w-full md:w-64">
              <input
                type="text"
                placeholder="Search student or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="absolute left-3 top-2 text-gray-400 text-xs">🔍</span>
            </div>
          </div>

          {/* Bảng danh sách bài nộp */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Loading submissions...</div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500 font-medium text-sm">No essays found matching your criteria.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Essay Details</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Submitted Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredReviews.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      
                      {/* Tiêu đề & Loại bài */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-gray-900">{item.title || 'IELTS Writing Task 2'}</div>
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.prompt || 'Writing Assessment'}</div>
                      </td>

                      {/* Tên học viên */}
                      <td className="py-4 px-4 text-gray-700 font-medium">
                        {item.studentName || 'Student User'}
                      </td>

                      {/* Ngày nộp */}
                      <td className="py-4 px-4 text-gray-500 text-xs">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Just now'}
                      </td>

                      {/* Badge trạng thái */}
                      <td className="py-4 px-4">
                        {renderStatusBadge(item.status)}
                      </td>

                      {/* Nút xem chi tiết / chấm bài */}
                      <td className="py-4 px-4 text-right">
                        <Link
                          to={`/teacher/reviews/${item.id}`}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                        >
                          {item.status === 'IN_PROGRESS' ? 'Continue Grading' : 'Review Essay'} &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}