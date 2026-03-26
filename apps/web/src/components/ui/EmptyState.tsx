import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded border border-border bg-bg-secondary p-6 text-center">
      <Icon size={24} className="text-text-tertiary" />
      <p className="font-mono text-sm text-text-primary">{title}</p>
      <p className="text-xs text-text-secondary">{description}</p>
      {action}
    </div>
  );
}
