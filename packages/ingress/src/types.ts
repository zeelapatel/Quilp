import type { SourceType } from "@prisma/client";

// Raw email from Gmail API - never persisted.
export interface RawEmail {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  receivedAt: Date;
  headers: Record<string, string>;
}

// What every parser must produce.
export interface ExtractedContent {
  sourceType: SourceType;
  title: string;
  keyPoints: string[];
  entities: string[];
  numericalData: Record<string, number>;
  actionItems: string[];
  rawExcerpt: string;
  extractedAt: Date;
  metadata: Record<string, unknown>;
}

// Parser confidence result.
export interface ConfidenceResult {
  score: number;
  missingFields: string[];
  fallbackUsed: boolean;
  reason: string;
}

// Parser interface - every parser implements this.
export interface IEmailParser {
  source: SourceType;
  canParse(email: RawEmail): boolean;
  parse(email: RawEmail): Promise<ExtractedContent>;
  validate(content: ExtractedContent): ConfidenceResult;
}

// Confidentiality check result.
export interface ConfidentialityResult {
  isConfidential: boolean;
  reason: string | null;
  signal: string | null;
}

// Sender fingerprint definition.
export interface SenderFingerprint {
  source: SourceType;
  senderPatterns: string[];
  subjectPatterns: RegExp[];
  parserModule: string;
}
