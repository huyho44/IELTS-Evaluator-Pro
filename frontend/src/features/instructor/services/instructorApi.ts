import axiosClient from '../../../lib/api/axiosClient';
import type {
  AcceptedAssessment,
  ConfirmResponse,
  ConfirmReviewPayload,
  CourseDetail,
  CourseSection,
  CourseSummary,
  CreateActivityPayload,
  CreateAssignmentPayload,
  CreateCoursePayload,
  CreatedActivityResponse,
  CreatedAssignmentVersionResponse,
  CreatedRubricResponse,
  CreateGradingConfigPayload,
  CreateLessonPayload,
  CreateRubricPayload,
  CreateSectionPayload,
  ReviewCase,
  ReviewDetail,
  ReviewQueueItem,
  UpdateCoursePayload,
} from '../types';

export const instructorApi = {
  // ==========================================================================
  // Review Queue & Evaluation
  // ==========================================================================

  getReviewQueue: async () => {
    const response = await axiosClient.get<ReviewQueueItem[]>('/teacher/reviews');
    return response.data;
  },

  getReviewDetail: async (reviewId: string) => {
    const response = await axiosClient.get<ReviewDetail>(
      `/reviews/${encodeURIComponent(reviewId)}`,
    );
    return response.data;
  },

  claimReview: async (reviewId: string) => {
    const response = await axiosClient.post<ReviewCase>(
      `/reviews/${encodeURIComponent(reviewId)}/claim`,
    );
    return response.data;
  },

  confirmReview: async (reviewId: string, assessmentData: ConfirmReviewPayload) => {
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

  // ==========================================================================
  // Course Authoring & Curriculum
  // ==========================================================================

  getPublishedCourses: async () => {
    const response = await axiosClient.get<CourseSummary[]>('/courses');
    return response.data;
  },

  getCourseDetail: async (courseId: string) => {
    const response = await axiosClient.get<CourseDetail>(
      `/courses/${encodeURIComponent(courseId)}`,
    );
    return response.data;
  },

  createCourse: async (payload: CreateCoursePayload) => {
    const response = await axiosClient.post<CourseSummary>('/courses', payload);
    return response.data;
  },

  updateCourse: async (courseId: string, payload: UpdateCoursePayload) => {
    const response = await axiosClient.patch<CourseSummary>(
      `/courses/${encodeURIComponent(courseId)}`,
      payload,
    );
    return response.data;
  },

  createSection: async (courseId: string, payload: CreateSectionPayload) => {
    const response = await axiosClient.post<CourseSection>(
      `/courses/${encodeURIComponent(courseId)}/sections`,
      payload,
    );
    return response.data;
  },

  createLesson: async (courseId: string, payload: CreateLessonPayload) => {
    const response = await axiosClient.post(
      `/courses/${encodeURIComponent(courseId)}/lessons`,
      payload,
    );
    return response.data;
  },

  createActivity: async (courseId: string, payload: CreateActivityPayload) => {
    const response = await axiosClient.post<CreatedActivityResponse>(
      `/courses/${encodeURIComponent(courseId)}/activities`,
      payload,
    );
    return response.data;
  },

  createAssignment: async (courseId: string, payload: CreateAssignmentPayload) => {
    const response = await axiosClient.post<CreatedAssignmentVersionResponse>(
      `/courses/${encodeURIComponent(courseId)}/assignments`,
      payload,
    );
    return response.data;
  },

  createAssignmentVersion: async (
    courseId: string,
    assignmentId: string,
    payload: CreateAssignmentPayload,
  ) => {
    const response = await axiosClient.post<CreatedAssignmentVersionResponse>(
      `/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/versions`,
      payload,
    );
    return response.data;
  },

  // ==========================================================================
  // Rubrics & Grading Configurations
  // ==========================================================================

  createRubric: async (payload: CreateRubricPayload) => {
    const response = await axiosClient.post<CreatedRubricResponse>(
      '/grading/rubrics',
      payload,
    );
    return response.data;
  },

  createGradingConfig: async (payload: CreateGradingConfigPayload) => {
    const response = await axiosClient.post('/grading/configs', payload);
    return response.data;
  },
};