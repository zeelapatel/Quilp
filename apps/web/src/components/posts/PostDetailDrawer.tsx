import { useEffect, useState } from "react";
import { AlertCircle, Check, Copy, X } from "lucide-react";
import type { PostDetail } from "../../hooks/usePosts";
import { PlatformBadge } from "./PlatformBadge";
import { StatusBadge } from "./StatusBadge";

type PostDetailDrawerProps = {
  open: boolean;
  post: PostDetail | null;
  onClose: () => void;
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

function scoreColor(score: number | null): string {
  if (score === null) {
    return "#444444";
  }
  if (score >= 85) {
    return "#44FF88";
  }
  if (score >= 70) {
    return "#E8F94A";
  }
  if (score >= 50) {
    return "#FF8C00";
  }
  return "#FF4444";
}

export function PostDetailDrawer({ open, post, onClose }: PostDetailDrawerProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!post) {
    return null;
  }

  const confidenceColor = scoreColor(post.confidence_score);
  const voiceColor = scoreColor(post.voice_score);

  const copyContent = async () => {
    await navigator.clipboard.writeText(post.content);
    setCopied(true);
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-screen w-[480px] border-l border-border bg-bg-secondary transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-mono text-sm">Post detail</h3>
          <button type="button" className="text-text-secondary hover:text-text-primary" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="h-[calc(100vh-57px)] overflow-y-auto p-5">
          <section>
            <p className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
              Generated content
            </p>
            <div className="mt-2 rounded border border-border bg-bg-primary p-4">
              <p className="text-sm leading-[1.7] text-text-primary">{post.content}</p>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-mono text-[11px] text-text-tertiary">
                {post.content.length.toLocaleString()} characters
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
                onClick={copyContent}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </section>

          <section className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded border border-border bg-bg-primary p-3">
              <p className="text-[11px] text-text-tertiary">Confidence</p>
              <p className="mt-1 font-mono text-[28px]" style={{ color: confidenceColor }}>
                {post.confidence_score ?? "—"}
              </p>
              <p className="text-xs text-text-secondary">Extraction quality</p>
            </div>
            <div className="rounded border border-border bg-bg-primary p-3">
              <p className="text-[11px] text-text-tertiary">Voice match</p>
              <p className="mt-1 font-mono text-[28px]" style={{ color: voiceColor }}>
                {post.voice_score ?? "—"}
              </p>
              <p className="text-xs text-text-secondary">Style alignment</p>
            </div>
          </section>

          <section className="mt-5 rounded border border-border bg-bg-primary p-3">
            <p className="text-[11px] text-text-tertiary">Classification</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex rounded-[3px] border border-[#333333] px-1.5 py-0.5 font-mono text-[10px] text-text-secondary">
                {post.category}
              </span>
              <PlatformBadge platform={post.platform} />
              <span className="text-xs text-text-secondary">{post.format.replace("_", " ")}</span>
            </div>
          </section>

          <section className="mt-5 rounded border border-border bg-bg-primary p-3">
            <p className="text-[11px] text-text-tertiary">Source</p>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={post.status} />
              <p className="text-xs text-text-secondary">
                {post.sourceEmail?.sourceType ?? "generic"} {post.sourceEmail ? `· ${post.sourceEmail.subject}` : ""}
              </p>
            </div>
            <p className="mt-2 font-mono text-[11px] text-text-tertiary">
              Processed {formatRelativeTime(post.created_at)}
            </p>
          </section>

          <section className="mt-5 rounded border border-border bg-bg-primary p-3">
            <p className="text-[11px] text-text-tertiary">Voice suggestions</p>
            <div className="mt-2 flex items-start gap-2 text-xs text-text-secondary">
              <AlertCircle size={12} className="mt-0.5" />
              <p>Voice suggestions available after calibration.</p>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
