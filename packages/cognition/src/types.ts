import type { Platform, PostFormat, PostStatus, SourceType } from "@prisma/client";

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

export type ContentCategory =
  | "thought_leadership"
  | "industry_commentary"
  | "case_study"
  | "how_to_guide"
  | "product_update"
  | "company_culture"
  | "sales_win"
  | "event_recap"
  | "personal_story"
  | "data_insight"
  | "partnership_announcement"
  | "hiring";

export interface ClassificationResult {
  category: ContentCategory;
  subcategory: string;
  targetPlatforms: Array<"linkedin_personal" | "linkedin_company" | "x" | "slack">;
  toneProfile: "professional" | "casual" | "inspirational";
  urgency: "high" | "normal" | "low";
  reasoning: string;
}

export interface GeneratedPost {
  content: string;
  format: PostFormat;
  platform: Platform;
  hooks: string[];
  hashtags: string[];
  charCount: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  metadata: {
    category: ContentCategory;
    toneProfile: string;
    sourceType: SourceType;
    generatedAt: Date;
  };
}

export interface PipelineInput {
  processedEmailId: string;
  connectionId: string;
  userId: string;
  userPlan: string;
  userEmail: string;
  sourceType: SourceType;
  extractedData: ExtractedContent;
  confidenceScore: number;
  requiresReview: boolean;
  traceId: string;
}

export interface PipelineOutput {
  postId: string;
  status: PostStatus | "cost_cap";
  generationMs: number;
  confidenceScore: number;
  voiceScore: number | null;
  wasRedacted: boolean;
}
