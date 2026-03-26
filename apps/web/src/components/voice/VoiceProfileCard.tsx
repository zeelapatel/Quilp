import type { VoiceProfileSummary } from "../../hooks/useVoiceProfile";

type VoiceProfileCardProps = {
  profile: VoiceProfileSummary;
  onRecalibrate: () => void;
};

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) {
    return `${Math.max(1, mins)}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
}

export function VoiceProfileCard({ profile, onRecalibrate }: VoiceProfileCardProps) {
  return (
    <div className="rounded border border-border bg-bg-secondary p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[13px]">Personal voice</p>
        <div className="flex items-center gap-3">
          <span className="rounded border border-[#333333] px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
            v{profile.version}
          </span>
          <button type="button" className="text-xs text-text-secondary hover:text-text-primary" onClick={onRecalibrate}>
            Recalibrate
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm italic text-text-secondary">{profile.patterns.writingPersona}</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded border border-border bg-bg-primary p-2">
          <p className="font-mono text-xs">{profile.patterns.sampleCount}</p>
          <p className="text-[11px] text-text-tertiary">posts used</p>
        </div>
        <div className="rounded border border-border bg-bg-primary p-2">
          <p className="font-mono text-xs">{profile.patterns.emojiUsage}</p>
          <p className="text-[11px] text-text-tertiary">emoji usage</p>
        </div>
        <div className="rounded border border-border bg-bg-primary p-2">
          <p className="font-mono text-xs">{profile.patterns.avgSentenceLength}</p>
          <p className="text-[11px] text-text-tertiary">words/sentence</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] text-text-tertiary">Topic signatures</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {profile.patterns.topicSignatures.slice(0, 6).map(topic => (
            <span
              key={topic}
              className="inline-flex rounded-[3px] border border-[#333333] px-2 py-0.5 font-mono text-[11px] text-text-secondary"
            >
              {topic}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-4 font-mono text-[11px] text-text-tertiary">
        Calibrated {relativeTime(profile.lastCalibratedAt)}
      </p>
    </div>
  );
}
