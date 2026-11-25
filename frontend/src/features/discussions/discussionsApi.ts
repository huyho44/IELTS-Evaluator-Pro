import axiosClient from "../../lib/api/axiosClient";

export const TITLE_MAX = 240;
export const BODY_MAX = 5000;

export type ThreadStatus = "OPEN" | "LOCKED" | "HIDDEN";
export type PostStatus = "VISIBLE" | "HIDDEN" | "DELETED";

type Person = { id: string; displayName: string };
type ContextItem = { id: string; title: string; kind: string } | null;

export type ThreadSummary = {
  id: string;
  title: string;
  status: ThreadStatus;
  createdAt: string;
  contextItem: ContextItem;
  creator: Person;
  replyCount: number;
  lastActivityAt: string;
};

export type ThreadList = {
  courseId: string;
  canPost: boolean;
  canModerate: boolean;
  threads: ThreadSummary[];
};

export type DiscussionPost = {
  id: string;
  parentPostId: string | null;
  author: Person & { role: "INSTRUCTOR" | null };
  body: string | null;
  status: PostStatus;
  createdAt: string;
  editedAt: string | null;
  mine: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type ThreadDetail = {
  id: string;
  courseId: string;
  title: string;
  status: ThreadStatus;
  createdAt: string;
  contextItem: ContextItem;
  creator: Person;
  canPost: boolean;
  canModerate: boolean;
  posts: (DiscussionPost & { replies: DiscussionPost[] })[];
};

export type StaffCourse = {
  id: string;
  title: string;
  status: string;
  openThreads: number;
};

const path = (value: string) => encodeURIComponent(value);

export const discussionsApi = {
  async staffCourses() {
    return (await axiosClient.get<StaffCourse[]>("/discussions/courses")).data;
  },
  async list(courseId: string, contextItemId?: string) {
    return (
      await axiosClient.get<ThreadList>(`/courses/${path(courseId)}/threads`, {
        params: contextItemId ? { contextItemId } : undefined,
      })
    ).data;
  },
  async create(
    courseId: string,
    input: { title: string; body: string; contextItemId?: string },
  ) {
    return (
      await axiosClient.post<ThreadDetail>(
        `/courses/${path(courseId)}/threads`,
        input,
      )
    ).data;
  },
  async detail(threadId: string) {
    return (await axiosClient.get<ThreadDetail>(`/threads/${path(threadId)}`))
      .data;
  },
  async reply(threadId: string, body: string, parentPostId?: string) {
    return (
      await axiosClient.post<ThreadDetail>(`/threads/${path(threadId)}/posts`, {
        body,
        ...(parentPostId ? { parentPostId } : {}),
      })
    ).data;
  },
  async edit(postId: string, body: string) {
    return (
      await axiosClient.patch<ThreadDetail>(`/posts/${path(postId)}`, { body })
    ).data;
  },
  async remove(postId: string) {
    return (await axiosClient.delete<ThreadDetail>(`/posts/${path(postId)}`))
      .data;
  },
  async lock(threadId: string, locked: boolean) {
    return (
      await axiosClient.post<ThreadDetail>(`/threads/${path(threadId)}/lock`, {
        locked,
      })
    ).data;
  },
};

// Reads the server message without depending on axios at runtime.
export function discussionError(cause: unknown, fallback: string): string {
  const response = (
    cause as { response?: { status?: number; data?: { message?: unknown } } }
  )?.response;
  if (response?.status === 403 && !response.data?.message)
    return "You do not have access to this discussion.";
  const message = response?.data?.message;
  if (typeof message === "string" && message) return message;
  if (Array.isArray(message) && typeof message[0] === "string")
    return message[0];
  return fallback;
}

// Text shown for a post that is not readable by the viewer.
export function postPlaceholder(post: Pick<DiscussionPost, "status" | "body">) {
  if (post.body !== null) return null;
  return post.status === "DELETED"
    ? "This post was deleted by its author."
    : "This post was hidden by a moderator.";
}
