import clsx from "clsx";

type Plan = "starter" | "pro" | "agency";

const planStyles: Record<Plan, string> = {
  starter: "border-[#333] text-text-secondary",
  pro: "border-accent text-accent",
  agency: "border-[#C084FC] text-[#C084FC]"
};

export function PlanBadge({ plan }: { plan: Plan }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]",
        planStyles[plan]
      )}
    >
      {plan}
    </span>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-sm border px-1.5 py-0.5 font-sans text-[11px]",
        active ? "border-success text-success" : "border-danger text-danger"
      )}
    >
      {active ? "Active" : "Disconnected"}
    </span>
  );
}
