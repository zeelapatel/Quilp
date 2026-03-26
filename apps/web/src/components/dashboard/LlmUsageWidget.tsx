import { AlertTriangle } from "lucide-react";
import type { LlmUsage } from "../../hooks/useLlmUsage";
import { Skeleton } from "../ui/Skeleton";

type LlmUsageWidgetProps = {
  usage: LlmUsage | null;
  isLoading: boolean;
};

function formatUsd(value: number): string {
  return `$${value.toFixed(3)}`;
}

export function LlmUsageWidget({ usage, isLoading }: LlmUsageWidgetProps) {
  if (isLoading) {
    return (
      <div className="rounded border border-border bg-bg-secondary p-4">
        <Skeleton variant="row" className="h-16" />
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="rounded border border-border bg-bg-secondary p-4">
        <p className="text-xs text-text-secondary">AI usage this month</p>
        <p className="mt-1 font-mono text-sm text-text-tertiary">No usage yet</p>
      </div>
    );
  }

  const fillColor = usage.percentUsed > 80 ? "#FF4444" : "#E8F94A";

  return (
    <div className="rounded border border-border bg-bg-secondary p-4">
      <div className="grid items-center gap-4 md:grid-cols-[1fr_2fr_auto]">
        <div>
          <p className="text-xs text-text-secondary">AI usage this month</p>
          <p className="mt-1 font-mono text-[13px]">
            {formatUsd(usage.spendUsd)} / {formatUsd(usage.capUsd)}
          </p>
        </div>
        <div>
          <div className="h-1 rounded-sm bg-bg-tertiary">
            <div
              className="h-1 rounded-sm transition-all"
              style={{ width: `${Math.max(0, Math.min(100, usage.percentUsed))}%`, backgroundColor: fillColor }}
            />
          </div>
        </div>
        <p className="font-mono text-xs text-text-secondary">{usage.callCount} calls</p>
      </div>
      {usage.percentUsed >= 90 ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-danger">
          <AlertTriangle size={12} />
          Approaching monthly limit
        </p>
      ) : null}
    </div>
  );
}
