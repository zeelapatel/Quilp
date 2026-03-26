import type { RawEmail, SenderFingerprint } from "./types.js";

export const SENDER_FINGERPRINTS: SenderFingerprint[] = [
  {
    source: "fathom",
    senderPatterns: ["@fathom.video"],
    subjectPatterns: [/meeting\s+recap/i, /notes\s+from/i, /your\s+meeting/i],
    parserModule: "fathom",
  },
  {
    source: "fireflies",
    senderPatterns: ["no-reply@fireflies.ai", "team@fireflies.ai"],
    subjectPatterns: [/transcript/i, /meeting\s+notes/i, /fireflies.*recap/i],
    parserModule: "fireflies",
  },
  {
    source: "otter",
    senderPatterns: ["no-reply@otter.ai"],
    subjectPatterns: [/conversation\s+notes/i, /otter.*notes/i],
    parserModule: "otter",
  },
  {
    source: "gong",
    senderPatterns: ["noreply@gong.io"],
    subjectPatterns: [/call\s+recording/i, /deal/i, /coaching/i],
    parserModule: "gong",
  },
  {
    source: "tldv",
    senderPatterns: ["@tldv.io"],
    subjectPatterns: [/highlights/i, /recap/i, /meeting.*tldv/i],
    parserModule: "tldv",
  },
  {
    source: "zoom",
    senderPatterns: ["no-reply@zoom.us"],
    subjectPatterns: [/transcript/i, /meeting\s+summary/i, /cloud\s+recording/i],
    parserModule: "zoom",
  },
  {
    source: "loom",
    senderPatterns: ["@loom.com"],
    subjectPatterns: [/video.*shared/i, /loom.*recording/i],
    parserModule: "loom",
  },
  {
    source: "phantom",
    senderPatterns: ["@phantombuster.com"],
    subjectPatterns: [/export/i, /results/i, /campaign/i],
    parserModule: "phantom",
  },
  {
    source: "apollo",
    senderPatterns: ["@apollo.io"],
    subjectPatterns: [/sequence/i, /reply/i, /booked/i],
    parserModule: "apollo",
  },
];

export function matchSender(email: RawEmail): SenderFingerprint | null {
  const fromEmail = extractEmail(email.from).toLowerCase();
  const subject = email.subject;

  for (const fp of SENDER_FINGERPRINTS) {
    const senderMatch = fp.senderPatterns.some(pattern => {
      if (pattern.startsWith("@")) {
        return fromEmail.endsWith(pattern.toLowerCase());
      }
      return fromEmail === pattern.toLowerCase();
    });

    if (!senderMatch) {
      continue;
    }

    const subjectMatch = fp.subjectPatterns.some(regex => regex.test(subject));
    if (subjectMatch) {
      return fp;
    }
  }

  return null;
}

export function extractEmail(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match?.[1] ?? from.trim();
}
