import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { usePost } from "../../hooks/usePosts";
import { useApprovePost, useDiscardPost, useEditPost, usePublishNowPost } from "../../hooks/usePostActions";
import { useToast } from "../ui/Toast";

type PostEditDrawerProps = {
  open: boolean;
  postId: string | null;
  onClose: () => void;
};

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

export function PostEditDrawer({ open, postId, onClose }: PostEditDrawerProps) {
  const { post, isLoading } = usePost(postId);
  const { edit, isEditing } = useEditPost();
  const { approve, isApproving } = useApprovePost();
  const { publishNow, isPublishingNow } = usePublishNowPost();
  const { discard, isDiscarding } = useDiscardPost();
  const { showToast } = useToast();

  const [content, setContent] = useState("");
  const [contentOriginal, setContentOriginal] = useState("");
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!post || !open) {
      return;
    }
    setContent(post.content);
    setContentOriginal(post.content_original ?? post.content);
    setShowUnsavedConfirm(false);
    setShowDiscardConfirm(false);
    setErrorMessage(null);
  }, [post, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (content !== (post?.content ?? "")) {
          setShowUnsavedConfirm(true);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [content, onClose, open, post?.content]);

  useEffect(() => {
    if (!savedFlag) {
      return;
    }
    const timer = window.setTimeout(() => setSavedFlag(false), 2000);
    return () => window.clearTimeout(timer);
  }, [savedFlag]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setIsTyping(true);
    const timer = window.setTimeout(() => setIsTyping(false), 500);
    return () => window.clearTimeout(timer);
  }, [content, open]);

  const hasUnsavedChanges = useMemo(() => {
    if (!post) {
      return false;
    }
    return content !== post.content;
  }, [content, post]);

  const charLimit = post?.platform === "linkedin_personal" ? 3000 : 3000;
  const overLimit = content.length > charLimit;

  const closeDrawer = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
      return;
    }
    onClose();
  };

  const handleSaveDraft = async () => {
    if (!postId) {
      return;
    }
    setErrorMessage(null);
    try {
      await edit({ id: postId, content });
      setSavedFlag(true);
    } catch (error) {
      setErrorMessage((error as Error).message || "Failed to save");
    }
  };

  const handleSaveAndApprove = async () => {
    if (!postId) {
      return;
    }
    setErrorMessage(null);
    try {
      await edit({ id: postId, content });
      const approveResult = await approve({ id: postId, status: post?.status });
      const scheduledAt = approveResult?.data?.scheduled_at ?? null;
      showToast(`Scheduled for ${formatScheduledTime(scheduledAt)}`, "success");
      onClose();
    } catch (error) {
      setErrorMessage((error as Error).message || "Failed to schedule");
    }
  };

  const handleSaveAndPublishNow = async () => {
    if (!postId) {
      return;
    }
    setErrorMessage(null);
    try {
      await edit({ id: postId, content });
      await publishNow({ id: postId, status: post?.status });
      showToast("Posted to LinkedIn", "success");
      onClose();
    } catch (error) {
      setErrorMessage((error as Error).message || "Failed to publish now");
    }
  };

  const handleDiscard = async () => {
    if (!postId) {
      return;
    }
    setErrorMessage(null);
    try {
      await discard(postId);
      showToast("Post discarded", "info");
      onClose();
    } catch (error) {
      setErrorMessage((error as Error).message || "Failed to discard");
    }
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={closeDrawer} />
      <aside className="fixed right-0 top-0 z-50 h-screen w-[480px] border-l border-border bg-bg-secondary">
        <header className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-sm">Edit post</h3>
              {hasUnsavedChanges ? (
                <span className="inline-flex items-center gap-1 text-xs text-[#FF8C00]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF8C00]" />
                  Unsaved changes
                </span>
              ) : null}
            </div>
            <button type="button" className="text-text-secondary hover:text-text-primary" onClick={closeDrawer}>
              <X size={16} />
            </button>
          </div>
          {showUnsavedConfirm ? (
            <p className="mt-2 text-xs text-text-secondary">
              Discard changes?{" "}
              <button type="button" className="text-danger" onClick={onClose}>
                Yes
              </button>{" "}
              <button type="button" className="text-text-primary" onClick={() => setShowUnsavedConfirm(false)}>
                Keep editing
              </button>
            </p>
          ) : null}
        </header>

        <div className="h-[calc(100vh-64px)] overflow-y-auto px-5 py-4">
          {isLoading || !post ? (
            <p className="text-sm text-text-secondary">Loading post...</p>
          ) : (
            <>
              <textarea
                value={content}
                onChange={event => setContent(event.target.value)}
                className="min-h-[280px] w-full resize-y rounded border border-border bg-bg-primary p-4 font-sans text-sm leading-[1.7] text-text-primary focus:border-border-hover focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between">
                <p className={`font-mono text-[11px] ${overLimit ? "text-danger" : "text-text-tertiary"}`}>
                  {content.length.toLocaleString()} / {charLimit.toLocaleString()}
                </p>
                {content !== contentOriginal ? (
                  <button
                    type="button"
                    className="text-[11px] text-text-tertiary hover:text-text-secondary"
                    onClick={() => setContent(contentOriginal)}
                  >
                    Reset to original
                  </button>
                ) : null}
              </div>

              <div className="mt-3 rounded border border-border bg-bg-primary p-3">
                {isTyping ? <p className="text-[11px] text-text-tertiary">Re-scoring...</p> : null}
                <p className="font-mono text-[11px] text-text-tertiary">
                  C: {post.confidence_score ?? "—"} · V: {post.voice_score ?? "—"}
                </p>
                <p className="mt-1 text-[11px] italic text-text-tertiary">Scores reflect original generation</p>
              </div>

              {errorMessage ? <p className="mt-2 text-xs text-danger">{errorMessage}</p> : null}

              <div className="mt-5 flex items-center justify-between">
                {showDiscardConfirm ? (
                  <p className="text-xs text-text-secondary">
                    Sure?{" "}
                    <button
                      type="button"
                      className="text-danger"
                      disabled={isDiscarding}
                      onClick={() => void handleDiscard()}
                    >
                      {isDiscarding ? "Discarding..." : "Yes, discard"}
                    </button>{" "}
                    <button type="button" className="text-text-primary" onClick={() => setShowDiscardConfirm(false)}>
                      Cancel
                    </button>
                  </p>
                ) : (
                  <button type="button" className="text-xs text-danger hover:underline" onClick={() => setShowDiscardConfirm(true)}>
                    Discard post
                  </button>
                )}

                <div className="flex items-center gap-2">
                  {savedFlag ? <span className="text-xs text-text-tertiary">Saved</span> : null}
                  <button
                    type="button"
                    className="rounded border border-[#333333] px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-60"
                    disabled={isEditing || isApproving || isPublishingNow}
                    onClick={() => void handleSaveDraft()}
                  >
                    {isEditing ? "Saving..." : "Save draft"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-w-[122px] items-center justify-center rounded border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-60"
                    disabled={isEditing || isApproving || isPublishingNow}
                    onClick={() => void handleSaveAndPublishNow()}
                  >
                    {isPublishingNow ? (
                      <>
                        <Loader2 size={14} className="mr-1 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      "Save & publish now"
                    )}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-w-[122px] items-center justify-center rounded border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-60"
                    disabled={isEditing || isApproving || isPublishingNow}
                    onClick={() => void handleSaveAndApprove()}
                  >
                    {isApproving ? (
                      <>
                        <Loader2 size={14} className="mr-1 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      "Save & approve"
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
