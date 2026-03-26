import type { PostStatus } from "../../hooks/usePosts";

type StatusBadgeProps = {
  status: PostStatus;
};

const STATUS_STYLE: Record<PostStatus, { color: string; label: string }> = {
  queued: { color: "#888888", label: "Queued" },
  approved: { color: "#E8F94A", label: "Approved" },
  posted: { color: "#44FF88", label: "Posted" },
  failed: { color: "#FF4444", label: "Failed" },
  discarded: { color: "#444444", label: "Discarded" },
  draft: { color: "#888888", label: "Draft" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.queued;
  return (
    <span
      className="inline-flex rounded-sm border px-2 py-0.5 font-mono text-[11px]"
      style={{ color: style.color, borderColor: style.color }}
    >
      {style.label}
    </span>
  );
}
