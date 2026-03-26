import type { ConfidenceResult, ExtractedContent, IEmailParser, RawEmail } from "../types.js";

export class FathomParser implements IEmailParser {
  source = "fathom" as const;

  canParse(email: RawEmail): boolean {
    return email.from.toLowerCase().includes("@fathom.video") && /meeting\s+recap|notes\s+from|your\s+meeting/i.test(email.subject);
  }

  async parse(email: RawEmail): Promise<ExtractedContent> {
    const text = email.bodyText;
    const html = email.bodyHtml;
    const title = this.extractTitle(email.subject, html);
    const entities = this.extractAttendees(text, html);
    const keyPoints = this.extractKeyPoints(text, html);
    const actionItems = this.extractActionItems(text, html);
    const numericalData = this.extractNumbers(text);
    const rawExcerpt = this.extractExcerpt(text);

    return {
      sourceType: "fathom",
      title,
      keyPoints,
      entities,
      numericalData,
      actionItems,
      rawExcerpt,
      extractedAt: new Date(),
      metadata: {
        originalSubject: email.subject,
        receivedAt: email.receivedAt,
      },
    };
  }

  validate(content: ExtractedContent): ConfidenceResult {
    const missing: string[] = [];
    let score = 100;

    if (!content.title || content.title.length < 3) {
      missing.push("title");
      score -= 20;
    }
    if (content.keyPoints.length === 0) {
      missing.push("keyPoints");
      score -= 30;
    }
    if (content.entities.length === 0) {
      missing.push("entities");
      score -= 15;
    }
    if (content.actionItems.length === 0) {
      missing.push("actionItems");
      score -= 10;
    }
    if (!content.rawExcerpt || content.rawExcerpt.length < 50) {
      missing.push("rawExcerpt");
      score -= 25;
    }

    return {
      score: Math.max(0, score),
      missingFields: missing,
      fallbackUsed: false,
      reason: missing.length === 0 ? "All fields extracted successfully" : `Missing fields: ${missing.join(", ")}`,
    };
  }

  private extractTitle(subject: string, _html: string): string {
    return subject.replace(/^(re:|fwd:|meeting recap:|notes from:)\s*/i, "").trim();
  }

  private extractAttendees(text: string, _html: string): string[] {
    const patterns = [/attendees?:?\s*\n?([\s\S]*?)(?:\n\n|\n[A-Z])/i, /participants?:?\s*\n?([\s\S]*?)(?:\n\n|\n[A-Z])/i];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1]
          .split(/[,\n•-]/)
          .map(segment => segment.trim())
          .filter(segment => segment.length > 2 && segment.length < 60)
          .slice(0, 10);
      }
    }

    return [];
  }

  private extractKeyPoints(text: string, _html: string): string[] {
    const sectionPatterns = [
      /(?:key\s+highlights?|decisions?|highlights?):?\s*\n([\s\S]*?)(?:\n\n[A-Z]|\n##|$)/i,
      /(?:summary|overview):?\s*\n([\s\S]*?)(?:\n\n[A-Z]|\n##|$)/i,
    ];

    for (const pattern of sectionPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1]
          .split(/\n[•\-*]|\n\d+\./)
          .map(segment => segment.trim())
          .filter(segment => segment.length > 10 && segment.length < 300)
          .slice(0, 10);
      }
    }

    return [];
  }

  private extractActionItems(text: string, _html: string): string[] {
    const patterns = [/(?:action\s+items?|next\s+steps?|follow.ups?|todos?):?\s*\n([\s\S]*?)(?:\n\n[A-Z]|\n##|$)/i];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1]
          .split(/\n[•\-*]|\n\d+\./)
          .map(segment => segment.trim())
          .filter(segment => segment.length > 10 && segment.length < 300)
          .slice(0, 8);
      }
    }

    return [];
  }

  private extractNumbers(text: string): Record<string, number> {
    const result: Record<string, number> = {};
    const patterns = [
      { regex: /\$([0-9,]+(?:\.[0-9]+)?[KMB]?)/gi, key: "revenue" },
      { regex: /([0-9]+(?:\.[0-9]+)?)\s*%/gi, key: "percentage" },
      { regex: /([0-9]+)\s+attendees?/gi, key: "attendees" },
    ];

    for (const { regex, key } of patterns) {
      const match = text.match(regex);
      if (match && match[0]) {
        const numeric = Number.parseFloat(match[0].replace(/[^0-9.]/g, ""));
        if (!Number.isNaN(numeric)) {
          result[key] = numeric;
        }
      }
    }

    return result;
  }

  private extractExcerpt(text: string): string {
    const lines = text.split("\n").filter(line => line.trim().length > 20);
    return lines.join(" ").slice(0, 500).trim();
  }
}
