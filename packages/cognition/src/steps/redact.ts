export interface RedactedItem {
  original: string;
  replacement: string;
  type: "person" | "company" | "email" | "phone";
}

export interface RedactionResult {
  content: string;
  redactedItems: RedactedItem[];
  wasRedacted: boolean;
}

export function redactPII(content: string, userEmail: string): RedactionResult {
  let redacted = content;
  const items: RedactedItem[] = [];

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const emails = [...new Set(content.match(emailRegex) ?? [])];
  for (const email of emails) {
    if (email.toLowerCase() === userEmail.toLowerCase()) {
      continue;
    }
    redacted = redacted.replaceAll(email, "[EMAIL]");
    items.push({ original: email, replacement: "[EMAIL]", type: "email" });
  }

  const phoneRegex = /(\+?\d{1,2}\s?)?(\(?\d{3}\)?[\s.-]?)(\d{3}[\s.-]?)(\d{4})/g;
  const phones = [...new Set(content.match(phoneRegex) ?? [])];
  for (const phone of phones) {
    redacted = redacted.replaceAll(phone, "[PHONE]");
    items.push({ original: phone, replacement: "[PHONE]", type: "phone" });
  }

  const companyRegex = /\b([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*)*\s+(?:Inc|LLC|Ltd|Corp|Corporation|Company))\b/g;
  const companies = [...new Set(content.match(companyRegex) ?? [])];
  for (const company of companies) {
    redacted = redacted.replaceAll(company, "[COMPANY]");
    items.push({ original: company, replacement: "[COMPANY]", type: "company" });
  }

  const namePatterns = [
    /\b(?:spoke|met|talked|called|emailed|messaged)\s+with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g,
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:told|said|mentioned|shared|explained|asked)\b/g,
  ];
  for (const pattern of namePatterns) {
    const matches = [...content.matchAll(pattern)];
    for (const match of matches) {
      const candidate = match[1] ?? "";
      if (!candidate || candidate.toLowerCase().includes("[person]")) {
        continue;
      }
      redacted = redacted.replaceAll(candidate, "[PERSON]");
      items.push({ original: candidate, replacement: "[PERSON]", type: "person" });
    }
  }

  return {
    content: redacted,
    redactedItems: items,
    wasRedacted: items.length > 0,
  };
}
