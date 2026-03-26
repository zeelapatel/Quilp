import { useEffect, useMemo, useState } from "react";
import { Loader2, Video, BarChart2, Mail } from "lucide-react";
import type { PostItem } from "../../hooks/usePosts";
import { PlatformBadge } from "./PlatformBadge";
import { ScorePill } from "./ScorePill";
import { StatusBadge } from "./StatusBadge";

type PostCardProps = {
  post: PostItem;
  sourceLabel?: string;
  onOpen?: (postId: string) => void;
  onApprove?: (postId: string) => void;
  onPublishNow?: (postId: string) => void;
  onDiscard?: (postId: string) => void;
  onEdit?: (postId: string) => void;
  onDeletePost?: (postId: string) => void;
  actionError?: string | null;
  isApproving?: boolean;
  isPublishingNow?: boolean;
  isDiscarding?: boolean;
  isDeleting?: boolean;
  canDeletePosted?: boolean;
};

function formatRelativeTime(iso: string): string {
  const created = new Date(iso).getTime();
  const diffMs = Math.max(0, Date.now() - created);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) {
    return "just now";
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function sourceIcon(source: string) {
  const normalized = source.toLowerCase();
  if (["fathom", "fireflies", "zoom", "tldv", "loom"].some(item => normalized.includes(item))) {
    return <Video size={12} className="text-text-tertiary" />;
  }
  if (["phantom", "apollo", "gong"].some(item => normalized.includes(item))) {
    return <BarChart2 size={12} className="text-text-tertiary" />;
  }
  return <Mail size={12} className="text-text-tertiary" />;
}

export function PostCard({
  post,
  sourceLabel,
  onOpen,
  onApprove,
  onPublishNow,
  onDiscard,
  onEdit,
  onDeletePost,
  actionError,
  isApproving,
  isPublishingNow,
  isDiscarding,
  isDeleting,
  canDeletePosted,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const preview = expanded ? post.content : `${post.content.slice(0, 200)}${post.content.length > 200 ? "..." : ""}`;
  const source = sourceLabel ?? "Generated";
  const relativeTime = useMemo(() => formatRelativeTime(post.created_at), [post.created_at]);
  const isPublished = post.status === "posted";
  const canApprove = post.status === "queued";
  const canPublishNow = ["draft", "queued", "approved"].includes(post.status);

  useEffect(() => {
    if (!showDiscardConfirm) {
      return;
    }
    const timer = window.setTimeout(() => setShowDiscardConfirm(false), 5000);
    return () => window.clearTimeout(timer);
  }, [showDiscardConfirm]);

  const linkedInUrl = post.platform_post_id
    ? `https://www.linkedin.com/feed/update/${post.platform_post_id}`
    : null;
  const postedAtLabel = post.posted_at
    ? new Date(post.posted_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <article
      className="rounded border border-border bg-bg-secondary p-4 transition-colors duration-100 hover:border-border-hover"
      onClick={() => onOpen?.(post.id)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <PlatformBadge platform={post.platform} />
          {sourceIcon(source)}
          <p className="truncate text-xs text-text-secondary">{source}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={post.status} />
          <span className="font-mono text-[11px] text-text-tertiary">{relativeTime}</span>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-sm leading-relaxed text-text-primary">{preview}</p>
        {post.content.length > 200 ? (
          <button
            type="button"
            className="mt-2 text-xs text-text-secondary hover:text-text-primary"
            onClick={event => {
              event.stopPropagation();
              setExpanded(current => !current);
            }}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="inline-flex rounded-[3px] border border-[#333333] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
          {post.category}
        </span>
        <div className="flex items-center gap-1.5">
          <ScorePill score={post.confidence_score} label="C" />
          <ScorePill score={post.voice_score} label="V" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs">
        {isPublished && postedAtLabel ? (
          <span className="mr-auto font-mono text-[11px] text-text-tertiary">Posted {postedAtLabel}</span>
        ) : null}
        {showDiscardConfirm ? (
          <p
            className="mr-auto text-xs text-text-secondary"
            onClick={event => {
              event.stopPropagation();
            }}
          >
            Sure?{" "}
            <button
              type="button"
              className="text-danger"
              onClick={event => {
                event.stopPropagation();
                onDiscard?.(post.id);
                setShowDiscardConfirm(false);
              }}
            >
              Yes, discard
            </button>{" "}
            <button
              type="button"
              className="text-text-secondary hover:text-text-primary"
              onClick={event => {
                event.stopPropagation();
                setShowDiscardConfirm(false);
              }}
            >
              Cancel
            </button>
          </p>
        ) : null}
        {isPublished ? (
          <>
            {linkedInUrl ? (
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded border border-border px-2 py-1 text-text-secondary hover:text-text-primary"
                onClick={event => event.stopPropagation()}
              >
                View on LinkedIn →
              </a>
            ) : null}
            {canDeletePosted ? (
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-danger hover:border-danger disabled:opacity-60"
                disabled={isDeleting}
                onClick={event => {
                  event.stopPropagation();
                  onDeletePost?.(post.id);
                }}
              >
                {isDeleting ? "Deleting..." : "Delete post"}
              </button>
            ) : null}
          </>
        ) : (
          <>
            {!showDiscardConfirm ? (
              <button
                type="button"
                className="rounded border border-border px-2 py-1 text-text-tertiary hover:border-danger hover:text-danger disabled:opacity-60"
                disabled={isDiscarding}
                onClick={event => {
                  event.stopPropagation();
                  setShowDiscardConfirm(true);
                }}
              >
                Discard
              </button>
            ) : null}
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-text-secondary hover:text-text-primary"
              onClick={event => {
                event.stopPropagation();
                onEdit?.(post.id);
              }}
            >
              Edit
            </button>
            <button
              type="button"
              title={canPublishNow ? "Publish immediately" : "Post cannot be published now"}
              className="inline-flex min-w-[102px] items-center justify-center gap-1 rounded border border-accent bg-accent px-2 py-1 text-black disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPublishingNow || !canPublishNow}
              onClick={event => {
                event.stopPropagation();
                onPublishNow?.(post.id);
              }}
            >
              {isPublishingNow ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Publishing...
                </>
              ) : (
                "Publish now"
              )}
            </button>
            <button
              type="button"
              title={canApprove ? "Approve post" : "Post needs review before approving"}
              className="inline-flex min-w-[94px] items-center justify-center gap-1 rounded border border-accent px-2 py-1 text-accent hover:bg-accent hover:text-black disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-accent"
              disabled={isApproving || !canApprove}
              onClick={event => {
                event.stopPropagation();
                onApprove?.(post.id);
              }}
            >
              {isApproving ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Scheduling...
                </>
              ) : (
                canApprove ? "Approve" : "Needs review"
              )}
            </button>
          </>
        )}
      </div>
      {actionError ? <p className="mt-2 text-xs text-danger">{actionError}</p> : null}
    </article>
  );
}
