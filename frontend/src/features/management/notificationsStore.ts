import { useEffect, useSyncExternalStore } from "react";
import { managementError, managementRequest } from "./managementApi";

export type NotificationItem = {
  id: string;
  notificationType?: string;
  title: string;
  body: string;
  navigationPath: string | null;
  readAt: string | null;
  createdAt: string;
  assignmentTitle?: string | null;
  courseTitle?: string | null;
  attemptNo?: number | null;
  revisionNo?: number | null;
};

export function getNotificationActionLabel(
  notification: Pick<NotificationItem, "notificationType" | "navigationPath">,
): string {
  if (
    notification.notificationType === "ASSESSMENT_PUBLISHED" ||
    notification.navigationPath?.startsWith("/submissions/")
  ) {
    return "View assessment";
  }
  if (notification.navigationPath?.startsWith("/courses/")) {
    return "Open course";
  }
  return "View details";
}

export function formatNotificationContext(
  notification: Pick<
    NotificationItem,
    "assignmentTitle" | "courseTitle" | "attemptNo" | "revisionNo"
  >,
): string | null {
  const parts: string[] = [];
  if (notification.assignmentTitle) {
    parts.push(notification.assignmentTitle);
  }
  if (notification.attemptNo != null && notification.revisionNo != null) {
    parts.push(
      `Attempt ${notification.attemptNo} · Revision ${notification.revisionNo}`,
    );
  } else if (notification.attemptNo != null) {
    parts.push(`Attempt ${notification.attemptNo}`);
  } else if (notification.revisionNo != null) {
    parts.push(`Revision ${notification.revisionNo}`);
  }
  if (notification.courseTitle && !notification.assignmentTitle) {
    parts.push(notification.courseTitle);
  }
  return parts.length > 0 ? parts.join(" — ") : null;
}

type NotificationState = {
  userId: string | null;
  items: NotificationItem[];
  loading: boolean;
  error: string;
  markingIds: Record<string, boolean>;
};

const EMPTY_STATE: NotificationState = {
  userId: null,
  items: [],
  loading: false,
  error: "",
  markingIds: {},
};

let state: NotificationState = { ...EMPTY_STATE };
let sessionEpoch = 0;
let loadSeq = 0;
let hasLoadedCurrentSession = false;
let visibilitySubscribers = 0;

const listeners = new Set<() => void>();
const inFlightMarks = new Set<string>();

function emit(next: NotificationState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function isInternalNavigationPath(
  path: string | null | undefined,
): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\")
  );
}

export function syncNotificationSession(userId: string | null) {
  if (userId === state.userId) return;
  sessionEpoch += 1;
  loadSeq += 1;
  hasLoadedCurrentSession = false;
  inFlightMarks.clear();
  emit({
    userId,
    items: [],
    loading: false,
    error: "",
    markingIds: {},
  });
}

export async function loadNotifications() {
  const expectedUserId = state.userId;
  if (!expectedUserId) return;

  const expectedEpoch = sessionEpoch;
  const seq = ++loadSeq;
  hasLoadedCurrentSession = true;

  emit({
    ...state,
    loading: true,
    error: "",
  });

  try {
    const data = await managementRequest<NotificationItem[]>(
      "GET",
      "/notifications",
    );
    if (!Array.isArray(data)) {
      throw new Error("The notifications response could not be verified.");
    }
    if (
      state.userId !== expectedUserId ||
      sessionEpoch !== expectedEpoch ||
      loadSeq !== seq
    ) {
      return;
    }
    // A refresh started before a successful mark may still return unread rows.
    const confirmedReadTimes = new Map(
      state.items.map((item) => [item.id, item.readAt]),
    );
    emit({
      ...state,
      items: data.map((item) => {
        const confirmedReadAt = confirmedReadTimes.get(item.id);
        return item.readAt || !confirmedReadAt
          ? item
          : { ...item, readAt: confirmedReadAt };
      }),
      loading: false,
      error: "",
    });
  } catch (cause) {
    if (
      state.userId !== expectedUserId ||
      sessionEpoch !== expectedEpoch ||
      loadSeq !== seq
    ) {
      return;
    }
    emit({
      ...state,
      loading: false,
      error: managementError(cause),
    });
  }
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const expectedUserId = state.userId;
  if (!expectedUserId) return false;

  const expectedEpoch = sessionEpoch;
  const markKey = `${expectedEpoch}:${id}`;
  if (inFlightMarks.has(markKey)) return false;
  inFlightMarks.add(markKey);

  emit({
    ...state,
    error: "",
    markingIds: { ...state.markingIds, [id]: true },
  });

  try {
    const updated = await managementRequest<NotificationItem>(
      "POST",
      `/notifications/${encodeURIComponent(id)}/read`,
    );
    if (state.userId !== expectedUserId || sessionEpoch !== expectedEpoch) {
      return false;
    }
    const restMarking = { ...state.markingIds };
    delete restMarking[id];
    emit({
      ...state,
      items: state.items.map((notification) =>
        notification.id === id ? { ...notification, ...updated } : notification,
      ),
      markingIds: restMarking,
    });
    return true;
  } catch (cause) {
    if (state.userId !== expectedUserId || sessionEpoch !== expectedEpoch) {
      return false;
    }
    const restMarking = { ...state.markingIds };
    delete restMarking[id];
    emit({
      ...state,
      error: managementError(cause),
      markingIds: restMarking,
    });
    return false;
  } finally {
    inFlightMarks.delete(markKey);
  }
}

export function formatUnreadBadge(items: NotificationItem[]): {
  count: number;
  badgeText: string;
  summaryText: string;
} {
  const count = items.filter((item) => !item.readAt).length;
  const badgeText = count > 99 ? "99+" : String(count);
  const hitLimit = items.length >= 200;

  const summaryText =
    count === 0
      ? hitLimit
        ? "0 unread in latest 200"
        : "All caught up"
      : hitLimit
        ? `${badgeText} unread in latest 200`
        : `${badgeText} unread`;

  return { count, badgeText, summaryText };
}

function handleVisibilityChange() {
  if (!document.hidden && state.userId) {
    void loadNotifications();
  }
}

export function useNotifications(userId: string | null | undefined) {
  const normalizedUserId = userId ?? null;
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
  );

  useEffect(() => {
    syncNotificationSession(normalizedUserId);
    if (normalizedUserId && !hasLoadedCurrentSession) {
      void loadNotifications();
    }
  }, [normalizedUserId]);

  useEffect(() => {
    if (!normalizedUserId) return;
    if (visibilitySubscribers === 0) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    visibilitySubscribers += 1;

    return () => {
      visibilitySubscribers -= 1;
      if (visibilitySubscribers === 0) {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
  }, [normalizedUserId]);

  if (!normalizedUserId || snapshot.userId !== normalizedUserId) {
    return EMPTY_STATE;
  }
  return snapshot;
}
