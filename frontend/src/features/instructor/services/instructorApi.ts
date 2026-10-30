import axiosClient from '../../../lib/api/axiosClient';
import type {
  AcceptedAssessment,
  ConfirmResponse,
  ConfirmReviewPayload,
  ReviewCase,
  ReviewDetail,
  ReviewQueueItem,
} from '../types';

export const instructorApi = {
  // Lấy danh sách bài viết đang chờ chấm
  getReviewQueue: async () => {
    const response = await axiosClient.get<ReviewQueueItem[]>('/teacher/reviews');
    return response.data;
  },

  // Chi tiết bài viết cần chấm
  getReviewDetail: async (reviewId: string) => {
    const response = await axiosClient.get<ReviewDetail>(`/reviews/${encodeURIComponent(reviewId)}`);
    return response.data;
  },

  // Nhận bài để chấm (Claim)
  claimReview: async (reviewId: string) => {
    const response = await axiosClient.post<ReviewCase>(`/reviews/${encodeURIComponent(reviewId)}/claim`);
    return response.data;
  },

  // Lưu điểm và nhận xét (Submit/Publish assessment)
  confirmReview: async (reviewId: string, assessmentData: ConfirmReviewPayload) => {
    const response = await axiosClient.post<ConfirmResponse>(`/reviews/${encodeURIComponent(reviewId)}/confirm`, assessmentData);
    return response.data;
  },
  publishAccepted: async (acceptedId: string) => {
    const response = await axiosClient.post<AcceptedAssessment>(`/assessments/${encodeURIComponent(acceptedId)}/publish`);
    return response.data;
  },
};
