import { Inbox } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { AppShell } from "../../components/layout/AppShell";
import { EmptyState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import { PostCard, PostDetailDrawer, PostEditDrawer } from "../../components/posts";
import { useToast } from "../../components/ui/Toast";
import { useApprovePost, useDeletePost, useDiscardPost, usePublishNowPost } from "../../hooks/usePostActions";
import { usePost, usePosts, type PostStatus } from "../../hooks/usePosts";
import { get } from "../../lib/api";
import type { AppOutletContext } from "../types";

type QueueTab = "all" | "queued" | "posted" | "failed";

type PostsCountResponse = {
  data: unknown[];
  meta: {
    total: number;
  };
};

function usePostsCount(status?: string) {
  return useQuery({
    queryKey: ["posts-count", status ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "1" });
      if (status && status !== "all") {
        params.set("status", status);
      }
      const response = await get<PostsCountResponse>(`/api/v1/posts?${params.toString()}`);
      return response.meta.total;
    },
  });
}

function formatScheduledTime(iso: string | null | undefined): string {
  if (!iso) {
    return "soon";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "soon";
  }
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isWithinUndoWindow(postedAt: string | null): boolean {
  if (!postedAt) {
    return false;
  }
  const postedTime = new Date(postedAt).getTime();
  if (Number.isNaN(postedTime)) {
    return false;
  }
  return Date.now() - postedTime <= 15 * 60 * 1000;
}

export function QueuePage() {
  const { authUser, user, signOut } = useOutletContext<AppOutletContext>();
  const [activeTab, setActiveTab] = useState<QueueTab>("all");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [exitingIds, setExitingIds] = useState<Record<string, true>>({});
  const [dismissedIds, setDismissedIds] = useState<Record<string, true>>({});
  const [actionErrorById, setActionErrorById] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [publishingNowId, setPublishingNowId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showToast } = useToast();
  const { approve } = useApprovePost();
  const { publishNow } = usePublishNowPost();
  const { discard } = useDiscardPost();
  const { deletePost } = useDeletePost();

  const filters = useMemo(() => (activeTab === "all" ? {} : { status: activeTab }), [activeTab]);
  const postsQuery = usePosts(filters);
  const selectedPostQuery = usePost(selectedPostId);

  const allCount = usePostsCount("all");
  const queuedCount = usePostsCount("queued");
  const postedCount = usePostsCount("posted");
  const failedCount = usePostsCount("failed");

  const tabs: Array<{ key: QueueTab; label: string; count: number }> = [
    { key: "all", label: "All", count: allCount.data ?? 0 },
    { key: "queued", label: "Pending", count: queuedCount.data ?? 0 },
    { key: "posted", label: "Published", count: postedCount.data ?? 0 },
    { key: "failed", label: "Failed", count: failedCount.data ?? 0 },
  ];

  const visiblePosts = useMemo(
    () => postsQuery.posts.filter(post => !dismissedIds[post.id]),
    [dismissedIds, postsQuery.posts]
  );

  const startOptimisticExit = (postId: string) => {
    setExitingIds(current => ({ ...current, [postId]: true }));
    window.setTimeout(() => {
      setDismissedIds(current => ({ ...current, [postId]: true }));
      setExitingIds(current => {
        const next = { ...current };
        delete next[postId];
        return next;
      });
    }, 180);
  };

  const rollbackOptimisticExit = (postId: string) => {
    setDismissedIds(current => {
      const next = { ...current };
      delete next[postId];
      return next;
    });
    setExitingIds(current => {
      const next = { ...current };
      delete next[postId];
      return next;
    });
  };

  const handleApprove = async (postId: string, status: PostStatus) => {
    if (status !== "queued") {
      showToast("This post needs to be in queue first", "error");
      return;
    }
    setActionErrorById(current => ({ ...current, [postId]: "" }));
    setApprovingId(postId);
    startOptimisticExit(postId);
    try {
      const response = await approve({ id: postId, status });
      showToast(`Scheduled for ${formatScheduledTime(response?.data?.scheduled_at)}`, "success");
    } catch (error) {
      const message = (error as Error).message;
      rollbackOptimisticExit(postId);
      setActionErrorById(current => ({ ...current, [postId]: "Failed to schedule — try again" }));
      showToast(message || "Failed to publish — try again", "error");
    } finally {
      setApprovingId(current => (current === postId ? null : current));
    }
  };

  const handleDiscard = async (postId: string) => {
    setActionErrorById(current => ({ ...current, [postId]: "" }));
    setDiscardingId(postId);
    startOptimisticExit(postId);
    try {
      await discard(postId);
      showToast("Post discarded", "info");
    } catch {
      rollbackOptimisticExit(postId);
      setActionErrorById(current => ({ ...current, [postId]: "Failed to discard — try again" }));
      showToast("Failed to discard — try again", "error");
    } finally {
      setDiscardingId(current => (current === postId ? null : current));
    }
  };

  const handlePublishNow = async (postId: string, status: PostStatus) => {
    if (!["draft", "queued", "approved"].includes(status)) {
      showToast("This post cannot be published now", "error");
      return;
    }
    setActionErrorById(current => ({ ...current, [postId]: "" }));
    setPublishingNowId(postId);
    startOptimisticExit(postId);
    try {
      await publishNow({ id: postId, status });
      showToast("Posted to LinkedIn", "success");
    } catch (error) {
      rollbackOptimisticExit(postId);
      setActionErrorById(current => ({ ...current, [postId]: "Failed to publish now — try again" }));
      showToast((error as Error).message || "Failed to publish now", "error");
    } finally {
      setPublishingNowId(current => (current === postId ? null : current));
    }
  };

  const handleDeletePosted = async (postId: string) => {
    setDeletingId(postId);
    try {
      await deletePost(postId);
      showToast("Post removed from LinkedIn", "success");
    } catch (error) {
      const message = (error as Error).message;
      showToast(message === "Undo window expired" ? "Undo window expired" : "Failed to delete post", "error");
    } finally {
      setDeletingId(current => (current === postId ? null : current));
    }
  };

  return (
    <AppShell title="Post queue" user={user} authEmail={authUser?.email ?? ""} onSignOut={signOut}>
      <div className="rounded border border-border bg-bg-secondary p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-mono text-2xl">Post queue</h2>
            <p className="mt-1 text-sm text-text-secondary">Review generated posts and quality scores</p>
          </div>
          <div className="flex items-center gap-4">
            {tabs.map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`border-b-2 pb-1 text-sm ${
                  activeTab === tab.key
                    ? "border-accent text-accent"
                    : "border-transparent text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                <span className="ml-1 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {postsQuery.isLoading ? (
          <div className="mt-5 space-y-3">
            <Skeleton variant="card" className="h-[220px]" />
            <Skeleton variant="card" className="h-[220px]" />
            <Skeleton variant="card" className="h-[220px]" />
          </div>
        ) : postsQuery.isError ? (
          <p className="mt-6 text-sm text-danger">Failed to load posts. Try refreshing.</p>
        ) : visiblePosts.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={Inbox}
              title="No posts generated yet"
              description="Connect your Gmail and we'll start processing your meeting summaries automatically"
              action={
                <Link to="/connections" className="mt-2 inline-flex rounded border border-border px-3 py-1.5 text-xs hover:border-border-hover">
                  Go to connections →
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {visiblePosts.map(post => (
              <div
                key={post.id}
                className={`transition-all duration-150 ${
                  exitingIds[post.id] ? "pointer-events-none translate-y-1 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                <PostCard
                  post={post}
                  onOpen={setSelectedPostId}
                  onEdit={setEditingPostId}
                  onApprove={post.status !== "posted" ? id => void handleApprove(id, post.status) : undefined}
                  onPublishNow={post.status !== "posted" ? id => void handlePublishNow(id, post.status) : undefined}
                  onDiscard={post.status !== "posted" ? id => void handleDiscard(id) : undefined}
                  onDeletePost={post.status === "posted" ? id => void handleDeletePosted(id) : undefined}
                  canDeletePosted={post.status === "posted" && isWithinUndoWindow(post.posted_at)}
                  isApproving={approvingId === post.id}
                  isPublishingNow={publishingNowId === post.id}
                  isDiscarding={discardingId === post.id}
                  isDeleting={deletingId === post.id}
                  actionError={actionErrorById[post.id] ?? null}
                />
              </div>
            ))}
            {postsQuery.hasNextPage ? (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  className="rounded border border-[#333333] px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                  onClick={() => void postsQuery.fetchNextPage()}
                  disabled={postsQuery.isFetchingNextPage}
                >
                  {postsQuery.isFetchingNextPage ? "Loading..." : "Load more"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <PostDetailDrawer
        open={selectedPostId !== null}
        post={selectedPostQuery.post}
        onClose={() => setSelectedPostId(null)}
      />
      <PostEditDrawer open={editingPostId !== null} postId={editingPostId} onClose={() => setEditingPostId(null)} />
    </AppShell>
  );
}
