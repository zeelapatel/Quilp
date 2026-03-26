import type { ConfidenceResult, ExtractedContent, IEmailParser, RawEmail } from "../types.js";

export class GenericParser implements IEmailParser {
  source = "generic" as const;

  canParse(_email: RawEmail): boolean {
    return true;
  }

  async parse(email: RawEmail): Promise<ExtractedContent> {
    return {
      sourceType: "generic",
      title: email.subject,
      keyPoints: this.extractBulletPoints(email.bodyText),
      entities: this.extractNames(email.bodyText),
      numericalData: this.extractNumbers(email.bodyText),
      actionItems: this.extractActionItems(email.bodyText),
      rawExcerpt: email.bodyText.slice(0, 500),
      extractedAt: new Date(),
      metadata: {
        from: email.from,
        isDebugMode: true,
      },
    };
  }

  validate(_content: ExtractedContent): ConfidenceResult {
    return {
      score: 45,
      missingFields: ["structured_source"],
      fallbackUsed: true,
      reason: "Generic parser - debug mode only. Score capped at 45 to force review queue.",
    };
  }

  private extractBulletPoints(text: string): string[] {
    return text
      .split("\n")
      .filter(line => /^[-*\u2022]|^\d+\./.test(line))
      .map(line => line.replace(/^(?:[-*\u2022]|\d+\.)\s*/, "").trim())
      .filter(line => line.length > 10)
      .slice(0, 10);
  }

  private extractActionItems(text: string): string[] {
    const match = text.match(/action\s+items?:?\s*\n([\s\S]*?)(?:\n\n|$)/i);
    if (!match) {
      return [];
    }
    return (match[1] ?? "")
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 5)
      .slice(0, 5);
  }

  private extractNames(text: string): string[] {
    const matches = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g);
    return [...new Set(matches ?? [])].slice(0, 8);
  }

  private extractNumbers(text: string): Record<string, number> {
    const result: Record<string, number> = {};
    const percentages = text.match(/(\d+(?:\.\d+)?)\s*%/g);
    if (percentages?.length) {
      result.percentage_mentions = percentages.length;
    }
    const currency = text.match(/\$[\d,]+(?:\.\d+)?[KMB]?/g);
    if (currency?.length) {
      result.currency_mentions = currency.length;
    }
    return result;
  }
}
