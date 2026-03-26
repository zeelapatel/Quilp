import type { ReactNode } from "react";

type Props = {
  title: string;
  actions?: ReactNode;
};

export function TopBar({ title, actions }: Props) {
  return (
    <header className="flex h-12 items-center justify-between border-b border-border px-8">
      <h1 className="font-mono text-base text-text-primary">{title}</h1>
      <div>{actions}</div>
    </header>
  );
}
