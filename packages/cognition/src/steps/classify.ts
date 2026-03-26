import { callLLM } from "../client.js";
import { MODELS, TOKEN_BUDGETS, VALID_CATEGORIES } from "../constants.js";
import { checkCostCap, recordLlmUsage } from "../cost-cap.js";
import { CostCapExceededError } from "../errors.js";
import type { ClassificationResult, ExtractedContent } from "../types.js";

const CLASSIFICATION_SYSTEM_PROMPT = `
You are a content strategist specializing in B2B social media.
Your job is to classify extracted meeting/tool content into exactly one category.

Allowed categories:
thought_leadership
industry_commentary
case_study
how_to_guide
product_update
company_culture
sales_win
event_recap
personal_story
data_insight
partnership_announcement
hiring

Rules:
- Return ONLY valid JSON. No prose, no markdown, no code fences.
- category must be one of the allowed categories exactly.
- targetPlatforms must only include values from ["linkedin_personal","linkedin_company","x","slack"].
- toneProfile must be one of ["professional","casual","inspirational"].
- urgency must be one of ["high","normal","low"].
- reasoning max length 100 chars.
`;

export async function classifyContent(extracted: ExtractedContent, userId: string, userPlan: string): Promise<ClassificationResult> {
  const capResult = await checkCostCap(userId, userPlan);
  if (!capResult.allowed) {
    throw new CostCapExceededError(capResult.reason ?? "Cost cap exceeded");
  }

  const userPrompt = `
Classify this content extracted from a ${extracted.sourceType} email:

Title: ${extracted.title}
Key Points:
${extracted.keyPoints.map(item => `- ${item}`).join("\n")}

Action Items:
${extracted.actionItems.map(item => `- ${item}`).join("\n")}

Excerpt:
${extracted.rawExcerpt.slice(0, 300)}

Return exact JSON:
{
  "category": "string",
  "subcategory": "string",
  "targetPlatforms": ["linkedin_personal"],
  "toneProfile": "professional",
  "urgency": "normal",
  "reasoning": "string"
}
`;

  try {
    const result = await callLLM({
      model: MODELS.classifier,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: TOKEN_BUDGETS.classification.maxOutput,
    });
    await recordLlmUsage(userId, MODELS.classifier, result.inputTokens, result.outputTokens);
    return parseClassificationJson(result.content);
  } catch (error) {
    console.warn("Classification failed, using fallback:", String(error));
    return getDefaultClassification();
  }
}

function parseClassificationJson(raw: string): ClassificationResult {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Classification returned invalid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Classification payload is not an object");
  }

  const obj = parsed as Record<string, unknown>;
  const category = typeof obj.category === "string" ? obj.category : "";
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    throw new Error(`Invalid category: ${category}`);
  }

  const targetPlatforms = Array.isArray(obj.targetPlatforms) ? obj.targetPlatforms : [];
  const normalizedPlatforms = targetPlatforms
    .filter((platform): platform is string => typeof platform === "string")
    .filter(platform => ["linkedin_personal", "linkedin_company", "x", "slack"].includes(platform)) as ClassificationResult["targetPlatforms"];

  const toneProfile = typeof obj.toneProfile === "string" ? obj.toneProfile : "professional";
  const urgency = typeof obj.urgency === "string" ? obj.urgency : "normal";
  const validTone = ["professional", "casual", "inspirational"].includes(toneProfile) ? toneProfile : "professional";
  const validUrgency = ["high", "normal", "low"].includes(urgency) ? urgency : "normal";

  return {
    category: category as ClassificationResult["category"],
    subcategory: typeof obj.subcategory === "string" ? obj.subcategory : "general",
    targetPlatforms: normalizedPlatforms.length > 0 ? normalizedPlatforms : ["linkedin_personal"],
    toneProfile: validTone as ClassificationResult["toneProfile"],
    urgency: validUrgency as ClassificationResult["urgency"],
    reasoning: typeof obj.reasoning === "string" ? obj.reasoning.slice(0, 100) : "LLM classification",
  };
}

function getDefaultClassification(): ClassificationResult {
  return {
    category: "thought_leadership",
    subcategory: "general insight",
    targetPlatforms: ["linkedin_personal"],
    toneProfile: "professional",
    urgency: "normal",
    reasoning: "Default classification fallback",
  };
}
