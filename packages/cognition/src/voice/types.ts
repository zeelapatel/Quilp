export interface VoicePatterns {
  avgSentenceLength: number;
  avgParagraphLength: number;
  vocabularyPatterns: string[];
  avoidedPhrases: string[];
  emojiUsage: "none" | "minimal" | "moderate";
  punctuationStyle: {
    usesEllipsis: boolean;
    usesExclamation: boolean;
    usesDash: boolean;
  };
  openingPatterns: string[];
  closingPatterns: string[];
  usesNumberedLists: boolean;
  usesBulletPoints: boolean;
  topicSignatures: string[];
  writingPersona: string;
  sampleCount: number;
  calibratedAt: Date;
}

export interface VoiceProfile {
  id: string;
  userId: string;
  profileType: "personal" | "company";
  patterns: VoicePatterns;
  version: number;
  lastCalibratedAt: Date;
}

export interface VoiceScore {
  score: number;
  deviations: string[];
  suggestions: string[];
  passesThreshold: boolean;
}
