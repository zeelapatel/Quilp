import { Decimal } from "decimal.js";
import { PLAN_COST_CAPS, PRICING } from "./constants.js";
import { prisma } from "./db.js";

export interface CostCapResult {
  allowed: boolean;
  currentSpendUsd: number;
  capUsd: number;
  remainingUsd: number;
  reason: string | null;
}

export async function checkCostCap(userId: string, userPlan: string): Promise<CostCapResult> {
  const month = getCurrentMonth();
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { llm_monthly_cap_usd: true },
  });

  const planCapUsd = PLAN_COST_CAPS[userPlan] ?? PLAN_COST_CAPS.starter ?? 0.2;
  const userOverrideCap = user?.llm_monthly_cap_usd ? Number(user.llm_monthly_cap_usd) : null;
  const capUsd: number = userOverrideCap ?? planCapUsd;

  const usage = await prisma.llm_usage.upsert({
    where: {
      user_id_month: {
        user_id: userId,
        month,
      },
    },
    create: {
      user_id: userId,
      month,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: new Decimal(0).toFixed(6),
      call_count: 0,
    },
    update: {},
  });

  const currentSpend = Number(usage.cost_usd);
  const remaining = Math.max(0, capUsd - currentSpend);

  if (currentSpend >= capUsd) {
    return {
      allowed: false,
      currentSpendUsd: currentSpend,
      capUsd,
      remainingUsd: 0,
      reason: `Monthly LLM cap of $${capUsd} reached. Resets on the 1st. Posts moved to review queue.`,
    };
  }

  return {
    allowed: true,
    currentSpendUsd: currentSpend,
    capUsd,
    remainingUsd: remaining,
    reason: null,
  };
}

export async function recordLlmUsage(userId: string, model: string, inputTokens: number, outputTokens: number): Promise<void> {
  const month = getCurrentMonth();
  const modelPricing = PRICING[model as keyof typeof PRICING];
  if (!modelPricing) {
    return;
  }

  const costUsd = new Decimal(inputTokens)
    .div(1_000_000)
    .mul(modelPricing.inputPer1M)
    .plus(new Decimal(outputTokens).div(1_000_000).mul(modelPricing.outputPer1M))
    .toFixed(6);

  await prisma.llm_usage.upsert({
    where: {
      user_id_month: {
        user_id: userId,
        month,
      },
    },
    create: {
      user_id: userId,
      month,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      call_count: 1,
    },
    update: {
      input_tokens: { increment: inputTokens },
      output_tokens: { increment: outputTokens },
      cost_usd: { increment: Number(costUsd) },
      call_count: { increment: 1 },
    },
  });
}

export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
