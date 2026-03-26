interface ScorePillProps {
  score: number | null;
  label: string;
}

function getColor(score: number | null): string {
  if (score === null) {
    return "#444444";
  }
  if (score >= 85) {
    return "#44FF88";
  }
  if (score >= 70) {
    return "#E8F94A";
  }
  if (score >= 50) {
    return "#FF8C00";
  }
  return "#FF4444";
}

export function ScorePill({ score, label }: ScorePillProps) {
  const color = getColor(score);
  const display = score !== null ? score : "—";

  return (
    <span
      style={{
        color,
        borderColor: color,
        fontFamily: "DM Mono, monospace",
        fontSize: "11px",
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: "4px",
        border: "1px solid",
        whiteSpace: "nowrap",
        background: "transparent",
      }}
    >
      {label}: {display}
    </span>
  );
}
