import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { useSession } from "../auth/session";
import Spinner from "../../components/ui/Spinner";
import ReportButton from "../moderation/ReportButton";
import {
  BODY_MAX,
  TITLE_MAX,
  discussionError,
  discussionsApi,
  postPlaceholder,
  type DiscussionPost,
  type ThreadDetail,
  type ThreadList,
} from "./discussionsApi";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const when = (value: string) => dateFormat.format(new Date(value));

type BoardProps = {
  courseId: string;
  /** Limits the board to one lesson or activity (lesson Q&A). */
  contextItemId?: string;
  heading?: string;
  description?: string;
  /** Controlled selection, e.g. from the URL. Omit for internal state. */
  selectedThreadId?: string | null;
  onSelectThread?: (threadId: string | null) => void;
  /** Shown when the viewer has no access (for example, not enrolled). */
  noAccessMessage?: string;
};

// Course discussion / lesson Q&A for learners, instructors and admins.
export default function DiscussionBoard({
  courseId,
  contextItemId,
  heading = "Discussion",
  description = "Ask questions and discuss the course with classmates and instructors.",
  selectedThreadId,
  onSelectThread,
  noAccessMessage = "Enroll in this course to read and join its discussion.",
}: BoardProps) {
  const { session } = useSession();
  const [internalThread, setInternalThread] = useState<string | null>(null);
  const controlled = selectedThreadId !== undefined;
  const threadId = controlled ? selectedThreadId : internalThread;
  const select = useCallback(
    (id: string | null) => {
      if (!controlled) setInternalThread(id);
      onSelectThread?.(id);
    },
    [controlled, onSelectThread],
  );

  if (!session) {
    return (
      <BoardFrame heading={heading} description={description}>
        <p className="text-sm text-slate-600">
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>{" "}
          and enroll to join the discussion.
        </p>
      </BoardFrame>
    );
  }

  return (
    <BoardFrame heading={heading} description={description}>
      {threadId ? (
        <ThreadView
          key={threadId}
          threadId={threadId}
          onBack={() => select(null)}
          noAccessMessage={noAccessMessage}
        />
      ) : (
        <ThreadListView
          courseId={courseId}
          contextItemId={contextItemId}
          onOpen={select}
          noAccessMessage={noAccessMessage}
        />
      )}
    </BoardFrame>
  );
}

function BoardFrame({
  heading,
  description,
  children,
}: {
  heading: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={heading}
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-900">{heading}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "OPEN") return null;
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
        (status === "LOCKED"
          ? "bg-slate-100 text-slate-600"
          : "bg-amber-50 text-amber-700")
      }
    >
      {status === "LOCKED" ? "Locked" : "Hidden"}
    </span>
  );
}

function useAccessError(noAccessMessage: string) {
  return useCallback(
    (cause: unknown, fallback: string) =>
      (cause as { response?: { status?: number } })?.response?.status === 403
        ? noAccessMessage
        : discussionError(cause, fallback),
    [noAccessMessage],
  );
}

function ThreadListView({
  courseId,
  contextItemId,
  onOpen,
  noAccessMessage,
}: {
  courseId: string;
  contextItemId?: string;
  onOpen: (threadId: string) => void;
  noAccessMessage: string;
}) {
  const [data, setData] = useState<ThreadList | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const toError = useAccessError(noAccessMessage);

  useEffect(() => {
    let active = true;
    discussionsApi
      .list(courseId, contextItemId)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
      })
      .catch((cause) => {
        if (active) setError(toError(cause, "Unable to load the discussion."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [courseId, contextItemId, toError]);

  if (loading && !data)
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner className="h-4 w-4 text-brand-600" /> Loading discussion...
      </p>
    );
  if (error && !data) return <p className="text-sm text-slate-600">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {data.canPost &&
        (asking ? (
          <NewThreadForm
            courseId={courseId}
            contextItemId={contextItemId}
            onCancel={() => setAsking(false)}
            onCreated={(thread) => onOpen(thread.id)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="ui-btn-primary"
          >
            Ask a question
          </button>
        ))}
      {!data.canPost && (
        <p className="text-xs text-slate-500">
          This discussion is read-only for you.
        </p>
      )}
      {data.threads.length === 0 ? (
        <p className="text-sm text-slate-500">
          No questions yet.{data.canPost ? " Be the first to ask." : ""}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
          {data.threads.map((thread) => (
            <li key={thread.id}>
              <button
                type="button"
                onClick={() => onOpen(thread.id)}
                className="block w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="break-words text-sm font-semibold text-slate-900">
                    {thread.title}
                  </span>
                  <StatusBadge status={thread.status} />
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {thread.creator.displayName}
                  {!contextItemId && thread.contextItem
                    ? ` · ${thread.contextItem.title}`
                    : ""}
                  {` · ${thread.replyCount} ${thread.replyCount === 1 ? "reply" : "replies"}`}
                  {` · ${when(thread.lastActivityAt)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewThreadForm({
  courseId,
  contextItemId,
  onCancel,
  onCreated,
}: {
  courseId: string;
  contextItemId?: string;
  onCancel: () => void;
  onCreated: (thread: ThreadDetail) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      onCreated(
        await discussionsApi.create(courseId, {
          title: title.trim(),
          body: body.trim(),
          ...(contextItemId ? { contextItemId } : {}),
        }),
      );
    } catch (cause) {
      setError(discussionError(cause, "Unable to post your question."));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
    >
      <fieldset disabled={busy} className="min-w-0 space-y-3">
        <div>
          <label htmlFor={`thread-title-${courseId}`} className="ui-label">
            Question title
          </label>
          <input
            id={`thread-title-${courseId}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={TITLE_MAX}
            required
            className="ui-input"
          />
        </div>
        <div>
          <label htmlFor={`thread-body-${courseId}`} className="ui-label">
            Details
          </label>
          <textarea
            id={`thread-body-${courseId}`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={BODY_MAX}
            rows={4}
            required
            className="ui-input"
          />
        </div>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="ui-btn-primary">
            {busy ? "Posting..." : "Post question"}
          </button>
          <button type="button" onClick={onCancel} className="ui-btn-secondary">
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function ThreadView({
  threadId,
  onBack,
  noAccessMessage,
}: {
  threadId: string;
  onBack: () => void;
  noAccessMessage: string;
}) {
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const toError = useAccessError(noAccessMessage);

  useEffect(() => {
    let active = true;
    discussionsApi
      .detail(threadId)
      .then((result) => {
        if (active) setThread(result);
      })
      .catch((cause) => {
        if (active)
          setError(
            (cause as { response?: { status?: number } })?.response?.status === 404
              ? "This thread is unavailable."
              : toError(cause, "Unable to load this thread."),
          );
      });
    return () => {
      active = false;
    };
  }, [threadId, toError]);

  // Runs one mutation at a time; the server returns the updated thread.
  const run = useCallback(
    async (action: () => Promise<ThreadDetail>, fallback: string) => {
      setBusy(true);
      setActionError("");
      try {
        setThread(await action());
        return true;
      } catch (cause) {
        setActionError(discussionError(cause, fallback));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const back = (
    <button type="button" onClick={onBack} className="ui-btn-ghost -ml-3">
      ← All questions
    </button>
  );
  if (error)
    return (
      <div className="space-y-3">
        {back}
        <p className="text-sm text-slate-600">{error}</p>
      </div>
    );
  if (!thread)
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner className="h-4 w-4 text-brand-600" /> Loading thread...
      </p>
    );

  const [opening, ...answers] = thread.posts;
  const actions = {
    busy,
    canPost: thread.canPost,
    reply: (body: string, parentPostId?: string) =>
      run(
        () => discussionsApi.reply(thread.id, body, parentPostId),
        "Unable to post your reply.",
      ),
    edit: (postId: string, body: string) =>
      run(() => discussionsApi.edit(postId, body), "Unable to save your changes."),
    remove: (postId: string) =>
      run(() => discussionsApi.remove(postId), "Unable to delete this post."),
  };

  return (
    <div className="space-y-4">
      {back}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 break-words text-base font-semibold text-slate-900">
            {thread.title} <StatusBadge status={thread.status} />
          </h3>
          {thread.contextItem && (
            <p className="mt-0.5 text-xs text-slate-500">
              About: {thread.contextItem.title}
            </p>
          )}
        </div>
        {thread.canModerate && thread.status !== "HIDDEN" && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () => discussionsApi.lock(thread.id, thread.status === "OPEN"),
                "Unable to change the thread status.",
              )
            }
            className="ui-btn-secondary"
          >
            {thread.status === "OPEN" ? "Lock thread" : "Unlock thread"}
          </button>
        )}
      </div>
      {thread.status === "LOCKED" && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          This thread is locked. New replies and edits are disabled.
        </p>
      )}
      {actionError && <ErrorText>{actionError}</ErrorText>}

      {opening && (
        <PostCard post={opening} actions={actions} highlight>
          <Replies post={opening} actions={actions} />
        </PostCard>
      )}

      {answers.length > 0 && (
        <ul className="space-y-3">
          {answers.map((post) => (
            <li key={post.id}>
              <PostCard post={post} actions={actions}>
                <Replies post={post} actions={actions} />
              </PostCard>
            </li>
          ))}
        </ul>
      )}

      {thread.canPost && (
        <Composer
          label="Your answer"
          submitLabel="Post answer"
          busy={busy}
          onSubmit={(body) => actions.reply(body)}
        />
      )}
    </div>
  );
}

type Actions = {
  busy: boolean;
  canPost: boolean;
  reply: (body: string, parentPostId?: string) => Promise<boolean>;
  edit: (postId: string, body: string) => Promise<boolean>;
  remove: (postId: string) => Promise<boolean>;
};

function Replies({
  post,
  actions,
}: {
  post: DiscussionPost & { replies: DiscussionPost[] };
  actions: Actions;
}) {
  const [replying, setReplying] = useState(false);
  return (
    <div className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
      {post.replies.map((reply) => (
        <PostCard key={reply.id} post={reply} actions={actions} />
      ))}
      {actions.canPost && post.status === "VISIBLE" &&
        (replying ? (
          <Composer
            label={`Reply to ${post.author.displayName}`}
            submitLabel="Reply"
            busy={actions.busy}
            onCancel={() => setReplying(false)}
            onSubmit={async (body) => {
              const ok = await actions.reply(body, post.id);
              if (ok) setReplying(false);
              return ok;
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setReplying(true)}
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            Reply
          </button>
        ))}
    </div>
  );
}

function PostCard({
  post,
  actions,
  highlight = false,
  children,
}: {
  post: DiscussionPost;
  actions: Actions;
  highlight?: boolean;
  children?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const placeholder = postPlaceholder(post);
  return (
    <article
      className={
        "rounded-lg border p-4 " +
        (highlight ? "border-brand-200 bg-brand-50/40" : "border-slate-200 bg-white")
      }
    >
      <header className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-800">{post.author.displayName}</span>
        {post.author.role === "INSTRUCTOR" && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-800">
            Instructor
          </span>
        )}
        <span>{when(post.createdAt)}</span>
        {post.editedAt && post.body !== null && <span>(edited)</span>}
        {post.status === "HIDDEN" && post.body !== null && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            Hidden from learners
          </span>
        )}
      </header>
      {editing && post.body !== null ? (
        <div className="mt-2">
          <Composer
            label="Edit post"
            submitLabel="Save"
            initial={post.body}
            busy={actions.busy}
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              const ok = await actions.edit(post.id, body);
              if (ok) setEditing(false);
              return ok;
            }}
          />
        </div>
      ) : placeholder ? (
        <p className="mt-2 text-sm italic text-slate-400">{placeholder}</p>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
          {post.body}
        </p>
      )}
      {!editing && (post.canEdit || post.canDelete) && (
        <div className="mt-2 flex gap-3 text-xs font-semibold">
          {post.canEdit && (
            <button
              type="button"
              disabled={actions.busy}
              onClick={() => setEditing(true)}
              className="text-slate-600 hover:underline"
            >
              Edit
            </button>
          )}
          {post.canDelete && (
            <button
              type="button"
              disabled={actions.busy}
              onClick={() => {
                if (window.confirm("Delete this post? This cannot be undone."))
                  void actions.remove(post.id);
              }}
              className="text-red-600 hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      )}
      {!post.mine && post.status === "VISIBLE" && (
        <div className="mt-2">
          <ReportButton targetType="POST" targetId={post.id} />
        </div>
      )}
      {children}
    </article>
  );
}

function Composer({
  label,
  submitLabel,
  initial = "",
  busy,
  onSubmit,
  onCancel,
}: {
  label: string;
  submitLabel: string;
  initial?: string;
  busy: boolean;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initial);
  const id = useId();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !body.trim()) return;
        void onSubmit(body.trim()).then((ok) => {
          if (ok && !initial) setBody("");
        });
      }}
      className="space-y-2"
    >
      <label htmlFor={id} className="ui-label">
        {label}
      </label>
      <textarea
        id={id}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={BODY_MAX}
        rows={3}
        required
        disabled={busy}
        className="ui-input"
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy || !body.trim()} className="ui-btn-primary">
          {busy ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="ui-btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
