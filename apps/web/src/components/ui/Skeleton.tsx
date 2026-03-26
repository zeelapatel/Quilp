import clsx from "clsx";

type Variant = "text" | "card" | "row";

type Props = {
  variant?: Variant;
  className?: string;
};

const styles: Record<Variant, string> = {
  text: "h-4 w-28",
  card: "h-24 w-full rounded",
  row: "h-10 w-full rounded"
};

export function Skeleton({ variant = "text", className }: Props) {
  return <div className={clsx("animate-pulse rounded bg-bg-tertiary", styles[variant], className)} />;
}
