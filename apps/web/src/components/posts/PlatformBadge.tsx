import type { PostPlatform } from "../../hooks/usePosts";

type PlatformBadgeProps = {
  platform: PostPlatform;
};

const PLATFORM_STYLES: Record<PostPlatform, { label: string; bg: string }> = {
  linkedin_personal: { label: "LI", bg: "#0077B5" },
  linkedin_company: { label: "LI", bg: "#0077B5" },
  x: { label: "X", bg: "#000000" },
  instagram: { label: "IG", bg: "#E4405F" },
  facebook: { label: "FB", bg: "#1877F2" },
  substack: { label: "SS", bg: "#FF6719" },
  beehiiv: { label: "BH", bg: "#F7B500" },
  slack: { label: "SL", bg: "#611f69" },
  notion: { label: "NO", bg: "#2F3437" },
};

export function PlatformBadge({ platform }: PlatformBadgeProps) {
  const style = PLATFORM_STYLES[platform] ?? PLATFORM_STYLES.linkedin_personal;
  return (
    <span
      className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-sm font-mono text-[10px] text-white"
      style={{ backgroundColor: style.bg }}
      title={platform}
    >
      {style.label}
    </span>
  );
}
