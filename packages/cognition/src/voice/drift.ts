export interface DriftResult {
  hasDrifted: boolean;
  similarityScore: number;
  lastCheckedAt: Date;
  alertTriggered: boolean;
}

// Scaffold only - full implementation is scheduled for S6.
export async function checkVoiceDrift(
  _userId: string,
  _profileType: "personal" | "company"
): Promise<DriftResult> {
  return {
    hasDrifted: false,
    similarityScore: 1.0,
    lastCheckedAt: new Date(),
    alertTriggered: false,
  };
}
