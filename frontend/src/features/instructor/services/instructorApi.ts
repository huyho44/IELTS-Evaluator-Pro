import axiosClient from '../../../lib/api/axiosClient';

export const instructorApi = {
  // Lấy danh sách bài viết đang chờ chấm
  getReviewQueue: async () => {
    const response = await axiosClient.get('/teacher/reviews');
    return response.data;
  },

  // Chi tiết bài viết cần chấm
  getReviewDetail: async (reviewId: string) => {
    const response = await axiosClient.get(`/reviews/${reviewId}`);
    return response.data;
  },

  // Nhận bài để chấm (Claim)
  claimReview: async (reviewId: string) => {
    const response = await axiosClient.post(`/reviews/${reviewId}/claim`);
    return response.data;
  },

  // Lưu điểm và nhận xét (Submit/Publish assessment)
  publishAssessment: async (reviewId: string, assessmentData: any) => {
    const response = await axiosClient.post(`/reviews/${reviewId}/publish`, assessmentData);
    return response.data;
  },
};