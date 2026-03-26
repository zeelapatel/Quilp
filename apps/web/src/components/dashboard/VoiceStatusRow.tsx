import { Mic } from "lucide-react";
import { Link } from "react-router-dom";
import type { VoiceProfileSummary } from "../../hooks/useVoiceProfile";

type VoiceStatusRowProps = {
  profile: VoiceProfileSummary | null;
};

export function VoiceStatusRow({ profile }: VoiceStatusRowProps) {
  if (!profile) {
    return (
      <div className="flex h-10 items-center justify-between rounded border border-dashed border-[#333333] bg-bg-secondary px-3">
        <div className="flex items-center gap-2">
          <Mic size={14} className="text-text-tertiary" />
          <p className="text-xs text-text-secondary">
            Voice not calibrated - posts use default style
          </p>
        </div>
        <Link to="/settings#voice" className="text-xs text-accent hover:underline">
          Calibrate →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-8 items-center justify-between rounded border border-border bg-bg-secondary px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Mic size={14} className="text-success" />
        <p className="truncate text-xs text-text-secondary">
          Voice v{profile.version} active - {profile.patterns.writingPersona}
        </p>
      </div>
      <span className="ml-3 rounded border border-[#333333] px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
        v{profile.version}
      </span>
    </div>
  );
}
