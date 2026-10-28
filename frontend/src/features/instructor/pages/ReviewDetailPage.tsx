import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { instructorApi } from '../services/instructorApi';

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // State lưu điểm số theo tiêu chí IELTS và nhận xét
  const [scores, setScores] = useState({
    taskAchievement: 6.0,
    coherenceCohesion: 6.0,
    lexicalResource: 6.0,
    grammarAccuracy: 6.0,
    overallScore: 6.0,
    feedback: '',
  });

  useEffect(() => {
    if (id) {
      instructorApi.getReviewDetail(id)
        .then((data) => setReview(data))
        .catch((err) => console.error('Error fetching review details:', err))
        .finally(() => setLoading(false));
    }
  }, [id]);

  // Xử lý khi giáo viên nhận bài
  const handleClaim = async () => {
    if (!id) return;
    setClaiming(true);
    try {
      await instructorApi.claimReview(id);
      setReview((prev: any) => ({ ...prev, status: 'IN_PROGRESS' }));
      alert('Successfully claimed this essay!');
    } catch {
      alert('Failed to claim essay.');
    } finally {
      setClaiming(false);
    }
  };

  // Xử lý gửi kết quả đánh giá
  const handleSubmitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    try {
      await instructorApi.publishAssessment(id, scores);
      alert('Assessment published successfully!');
      navigate('/teacher/reviews');
    } catch {
      alert('Failed to publish assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Tính tổng số từ trong bài làm
  const getWordCount = (text: string) => {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-gray-500 font-medium text-sm">Loading essay details...</div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-center">
        <p className="text-gray-600 font-medium">Essay not found.</p>
        <Link to="/teacher/reviews" className="text-blue-600 underline mt-2 inline-block text-sm">
          Back to Review Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header trên cùng & Link quay lại Queue */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="space-y-1">
            <Link
              to="/teacher/reviews"
              className="inline-flex items-center text-xs font-semibold text-gray-500 hover:text-blue-600 transition mb-1"
            >
              &larr; Back to Central Queue
            </Link>
            <h1 className="text-xl font-bold text-gray-900">{review.title || 'IELTS Writing Task 2 Essay'}</h1>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>Student: <strong className="text-gray-800">{review.studentName || 'Anonymous Student'}</strong></span>
              <span>•</span>
              <span>Submitted: {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : 'Recent'}</span>
            </div>
          </div>

          {/* Badge trạng thái */}
          <div>
            {review.status === 'IN_PROGRESS' ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <span className="w-2 h-2 mr-1.5 rounded-full bg-blue-500"></span>
                In Progress
              </span>
            ) : review.status === 'COMPLETED' ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500"></span>
                Completed
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-2 h-2 mr-1.5 rounded-full bg-amber-500"></span>
                Pending Claim
              </span>
            )}
          </div>
        </div>

        {/* Bố cục 2 Cột (Giao diện T04 Figma) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* CỘT TRÁI: Đề bài & Bài làm của Học viên (Chiếm 7 cột) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Card Đề bài */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">Writing Prompt</h2>
                <span className="text-xs bg-slate-100 text-gray-600 px-2.5 py-1 rounded-md font-medium">Task 2</span>
              </div>
              <p className="text-sm text-gray-800 leading-relaxed font-medium bg-slate-50 p-4 rounded-lg border border-gray-100">
                {review.prompt || 'Some people believe that university education should be free for everyone. To what extent do you agree or disagree?'}
              </p>
            </div>

            {/* Card Bài nộp */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-base font-bold text-gray-900">Student Response</h2>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
                  Word count: <strong className="text-gray-900">{getWordCount(review.content)}</strong> words
                </span>
              </div>

              <div className="text-sm text-gray-800 leading-relaxed space-y-4 whitespace-pre-wrap font-sans bg-slate-50/50 p-5 rounded-lg border border-gray-100 min-h-[300px]">
                {review.content || 'No submission text available.'}
              </div>
            </div>

          </div>

          {/* CỘT PHẢI: Form Chấm điểm & Nhận xét của Giáo viên (Chiếm 5 cột) */}
          <div className="lg:col-span-5 space-y-6 sticky top-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
              
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-base font-bold text-gray-900">IELTS Band Assessment</h2>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">Rubric v2.0</span>
              </div>

              {/* Thông báo Claim nếu bài chưa được nhận */}
              {review.status !== 'IN_PROGRESS' && review.status !== 'COMPLETED' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <p className="text-xs text-amber-800 font-medium">
                    You need to claim this essay before entering grades and feedback.
                  </p>
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition disabled:opacity-50 shadow-sm"
                  >
                    {claiming ? 'Claiming Essay...' : 'Claim This Essay'}
                  </button>
                </div>
              )}

              {/* Form Chấm điểm */}
              <form onSubmit={handleSubmitAssessment} className="space-y-5">
                
                {/* Khung Điểm Tổng Overall */}
                <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-semibold text-blue-900 uppercase tracking-wider">
                      Overall Band Score
                    </label>
                    <p className="text-xs text-blue-700 mt-0.5">Calculated target rating</p>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="9"
                    value={scores.overallScore}
                    onChange={(e) => setScores({ ...scores, overallScore: parseFloat(e.target.value) || 0 })}
                    className="w-20 text-center py-2 text-xl font-bold text-blue-900 bg-white rounded-lg border border-blue-200 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 4 Tiêu chí IELTS */}
                <div className="space-y-3.5">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Core Criteria (1.0 - 9.0)</h3>

                  <div className="flex items-center justify-between text-sm">
                    <label className="text-gray-700 font-medium text-xs">Task Achievement (TA)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="9"
                      value={scores.taskAchievement}
                      onChange={(e) => setScores({ ...scores, taskAchievement: parseFloat(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 text-center font-semibold text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="text-gray-700 font-medium text-xs">Coherence & Cohesion (CC)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="9"
                      value={scores.coherenceCohesion}
                      onChange={(e) => setScores({ ...scores, coherenceCohesion: parseFloat(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 text-center font-semibold text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="text-gray-700 font-medium text-xs">Lexical Resource (LR)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="9"
                      value={scores.lexicalResource}
                      onChange={(e) => setScores({ ...scores, lexicalResource: parseFloat(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 text-center font-semibold text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <label className="text-gray-700 font-medium text-xs">Grammatical Range & Accuracy (GRA)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="9"
                      value={scores.grammarAccuracy}
                      onChange={(e) => setScores({ ...scores, grammarAccuracy: parseFloat(e.target.value) || 0 })}
                      className="w-16 px-2 py-1 text-center font-semibold text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Khung Nhận xét Chi tiết */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Instructor Comments & Detailed Feedback
                  </label>
                  <textarea
                    rows={6}
                    value={scores.feedback}
                    onChange={(e) => setScores({ ...scores, feedback: e.target.value })}
                    placeholder="Write constructive feedback detailing strengths, weaknesses, and key areas for improvement..."
                    required
                    className="w-full p-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                </div>

                {/* Nút Submit */}
                <button
                  type="submit"
                  disabled={submitting || review.status !== 'IN_PROGRESS'}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm transition duration-150 disabled:opacity-50"
                >
                  {submitting ? 'Publishing Review...' : 'Publish Assessment'}
                </button>
              </form>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}