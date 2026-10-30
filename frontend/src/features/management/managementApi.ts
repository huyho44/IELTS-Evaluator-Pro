import { isAxiosError } from "axios";
import axiosClient from "../../lib/api/axiosClient";

export type UserRow = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  roles: string[];
  targetBand: number | null;
  targetExamDate?: string | null;
};
export type SkillRow = {
  id: string;
  code: string;
  name: string;
  skillArea: string;
  observableDefinition: string;
  status: string;
  skillPrerequisites: {
    prerequisiteSkillId: string;
    minStrength: string | null;
    minSupport: string | null;
  }[];
};
export type ApplicationRow = {
  id: string;
  profileText: string;
  status: string;
  decisionReason: string | null;
  submittedAt: string;
  applicant: { displayName: string; email: string };
};
export type CourseRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  enrollmentOpen: boolean;
  chapters: { id: string; title: string; position: number }[];
  learningItems: {
    id: string;
    title: string;
    kind: string;
    position: number;
    practiceActivity: {
      skillArea: string;
      activityVersions: { id: string; versionNo: number }[];
    } | null;
  }[];
  assignments: {
    id: string;
    title: string;
    assignmentVersions: { id: string; versionNo: number; mode: string }[];
  }[];
  courseInstructors: {
    instructorId: string;
    responsibility: string;
    instructor: { displayName: string };
  }[];
};
export type Catalog = {
  courses: CourseRow[];
  skills: SkillRow[];
  rubrics: {
    id: string;
    rubricCode: string;
    versionNo: number;
    taskType: string;
  }[];
  gradingConfigs: {
    id: string;
    provider: string;
    modelId: string;
    rubricVersionId: string;
  }[];
};
export async function managementRequest<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  return (await axiosClient.request<T>({ method, url: path, data: body })).data;
}
export function managementError(cause: unknown): string {
  const message: unknown = isAxiosError(cause)
    ? cause.response?.data?.message
    : undefined;
  return typeof message === "string"
    ? message
    : cause instanceof Error
      ? cause.message
      : "The request could not be completed.";
}
export const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50";
export const button =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
export const panel =
  "space-y-4 rounded-xl border border-slate-200 bg-white p-5";
