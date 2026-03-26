import { Lock } from "lucide-react";

type Props = {
  message?: string;
  sprint?: string;
};

export function ComingSoon({ message, sprint }: Props) {
  return (
    <div className="coming-soon-overlay">
      <Lock size={18} color="#444" />
      <p className="font-mono text-[11px] tracking-[0.06em] text-text-tertiary">
        {sprint ? `Available ${sprint}` : "Coming soon"}
      </p>
      {message ? <p className="max-w-[240px] text-center text-xs text-[#555]">{message}</p> : null}
    </div>
  );
}
