import type { ConfidenceResult, ExtractedContent, IEmailParser, RawEmail } from "../types.js";

export class FirefliesParser implements IEmailParser {
  source = "fireflies" as const;

  canParse(email: RawEmail): boolean {
    return email.from.toLowerCase().includes("fireflies.ai") && /transcript|meeting\s+notes|notetaker/i.test(email.subject);
  }

  async parse(email: RawEmail): Promise<ExtractedContent> {
    const text = email.bodyText;
    const title = this.extractTitle(email.subject);
    const entities = this.extractSpeakers(text);
    const keyPoints = this.extractTopics(text);
    const actionItems = this.extractActionItems(text);
    const numericalData = this.extractTalkStats(text);
    const rawExcerpt = this.extractSummary(text);

    return {
      sourceType: "fireflies",
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
        hasTalkStats: Object.keys(numericalData).length > 0,
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
      missing.push("topics");
      score -= 35;
    }
    if (content.entities.length === 0) {
      missing.push("speakers");
      score -= 15;
    }
    if (!content.rawExcerpt || content.rawExcerpt.length < 30) {
      missing.push("summary");
      score -= 30;
    }

    return {
      score: Math.max(0, score),
      missingFields: missing,
      fallbackUsed: false,
      reason: missing.length === 0 ? "All Fireflies fields extracted" : `Missing: ${missing.join(", ")}`,
    };
  }

  private extractTitle(subject: string): string {
    return subject.replace(/fireflies\.ai\s+notetaker:?\s*/i, "").replace(/^(re:|fwd:)\s*/i, "").trim();
  }

  private extractSpeakers(text: string): string[] {
    const speakerPattern = /([A-Z][a-z]+\s+[A-Z][a-z]+):\s*\d+%/g;
    const matches = [...text.matchAll(speakerPattern)];
    if (matches.length > 0) {
      return matches.map(match => match[1] ?? "").filter(Boolean).slice(0, 10);
    }

    const attendeeMatch = text.match(/attendees?:?\s*\n?([\s\S]*?)(?:\n\n)/i);
    if (attendeeMatch && attendeeMatch[1]) {
      return attendeeMatch[1]
        .split(/[,\n]/)
        .map(segment => segment.trim())
        .filter(segment => segment.length > 2)
        .slice(0, 10);
    }

    return [];
  }

  private extractTopics(text: string): string[] {
    const topicMatch = text.match(/(?:topics?|discussed|agenda):?\s*\n([\s\S]*?)(?:\n\n[A-Z]|\n##)/i);
    if (!topicMatch || !topicMatch[1]) {
      return [];
    }

    return topicMatch[1]
      .split(/\n[•\-*\d]/)
      .map(segment => segment.trim())
      .filter(segment => segment.length > 5)
      .slice(0, 10);
  }

  private extractActionItems(text: string): string[] {
    const match = text.match(/action\s+items?:?\s*\n([\s\S]*?)(?:\n\n[A-Z]|\n##|$)/i);
    if (!match || !match[1]) {
      return [];
    }

    return match[1]
      .split(/\n[•\-*]|\n\d+\./)
      .map(segment => segment.trim())
      .filter(segment => segment.length > 5)
      .slice(0, 8);
  }

  private extractTalkStats(text: string): Record<string, number> {
    const stats: Record<string, number> = {};
    const talkPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?):\s*(\d+)%/g;
    let match: RegExpExecArray | null = talkPattern.exec(text);

    while (match !== null) {
      const speaker = (match[1] ?? "").replace(/\s+/g, "_");
      const percentage = Number.parseInt(match[2] ?? "", 10);
      if (speaker && !Number.isNaN(percentage)) {
        stats[`talkTime_${speaker}`] = percentage;
      }
      match = talkPattern.exec(text);
    }

    return stats;
  }

  private extractSummary(text: string): string {
    const summaryMatch = text.match(/(?:overview|summary|recap):?\s*\n([\s\S]*?)(?:\n\n)/i);
    if (summaryMatch && summaryMatch[1]) {
      return summaryMatch[1].trim().slice(0, 500);
    }

    const paragraphs = text.split("\n\n").filter(paragraph => paragraph.trim().length > 50);
    return paragraphs[0]?.trim().slice(0, 500) ?? "";
  }
}
