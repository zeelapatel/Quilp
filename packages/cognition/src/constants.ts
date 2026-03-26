export const PRICING = {
  "claude-haiku-4-5-20251001": {
    inputPer1M: 0.8,
    outputPer1M: 4.0,
  },
  "claude-sonnet-4-20250514": {
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
} as const;

export const PLAN_COST_CAPS: Record<string, number> = {
  starter: 0.2,
  solo: 0.8,
  pro: 3.0,
  team: 10.0,
  agency: 30.0,
  enterprise: 999.99,
};

export const MODELS = {
  classifier: "claude-haiku-4-5-20251001",
  generator: "claude-sonnet-4-20250514",
  scorer: "claude-haiku-4-5-20251001",
} as const;

export const TOKEN_BUDGETS = {
  classification: { maxInput: 400, maxOutput: 150 },
  generation: { maxInput: 2500, maxOutput: 800 },
  voiceScoring: { maxInput: 1200, maxOutput: 200 },
} as const;

export const TIMEOUTS = {
  singleLlmCall: 30_000,
  totalPipeline: 90_000,
} as const;

export const VOICE_SCORE_THRESHOLD = 70;

export const VALID_CATEGORIES = [
  "thought_leadership",
  "industry_commentary",
  "case_study",
  "how_to_guide",
  "product_update",
  "company_culture",
  "sales_win",
  "event_recap",
  "personal_story",
  "data_insight",
  "partnership_announcement",
  "hiring",
] as const;
