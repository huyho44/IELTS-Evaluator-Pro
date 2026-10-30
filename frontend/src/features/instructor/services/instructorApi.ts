import axiosClient from "../../../lib/api/axiosClient";
import type {
  AcceptedAssessment,
  ConfirmResponse,
  ConfirmReviewPayload,
  ReviewCase,
  ReviewDetail,
  ReviewQueueItem,
} from "../types";

export const instructorApi = {
  // Lấy danh sách bài viết đang chờ chấm
  getReviewQueue: async (status = "OPEN") => {
    const response = await axiosClient.get<ReviewQueueItem[]>(
      `/teacher/reviews?status=${encodeURIComponent(status)}`,
    );
    return response.data;
  },

  // Chi tiết bài viết cần chấm
  getReviewDetail: async (reviewId: string) => {
    const response = await axiosClient.get<ReviewDetail>(
      `/reviews/${encodeURIComponent(reviewId)}`,
    );
    return response.data;
  },

  // Nhận bài để chấm (Claim)
  claimReview: async (reviewId: string) => {
    const response = await axiosClient.post<ReviewCase>(
      `/reviews/${encodeURIComponent(reviewId)}/claim`,
    );
    return response.data;
  },

  // Lưu điểm và nhận xét (Submit/Publish assessment)
  confirmReview: async (
    reviewId: string,
    assessmentData: ConfirmReviewPayload,
  ) => {
    const response = await axiosClient.post<ConfirmResponse>(
      `/reviews/${encodeURIComponent(reviewId)}/confirm`,
      assessmentData,
    );
    return response.data;
  },
  publishAccepted: async (acceptedId: string) => {
    const response = await axiosClient.post<AcceptedAssessment>(
      `/assessments/${encodeURIComponent(acceptedId)}/publish`,
    );
    return response.data;
  },
  releaseReview: async (id: string, lockVersion: number, reason: string) => {
    return (
      await axiosClient.post<ReviewCase>(
        `/reviews/${encodeURIComponent(id)}/release`,
        { lockVersion, reason },
      )
    ).data;
  },
  reopenReview: async (id: string, reason: string) => {
    return (
      await axiosClient.post<ReviewCase>(
        `/reviews/${encodeURIComponent(id)}/reopen`,
        { reason },
      )
    ).data;
  },
  rejectAppeal: async (id: string, lockVersion: number, reason: string) => {
    return (
      await axiosClient.post(`/reviews/${encodeURIComponent(id)}/resolve`, {
        lockVersion,
        reason,
      })
    ).data;
  },
};
