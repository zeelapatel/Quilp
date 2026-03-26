import type { ConfidentialityResult, RawEmail } from "../types.js";

const CONFIDENTIAL_SIGNALS = [
  "confidential",
  "do not share",
  "do not forward",
  "nda",
  "non-disclosure",
  "internal only",
  "strictly private",
  "privileged",
  "attorney-client",
  "not for distribution",
  "trade secret",
  "proprietary",
  "embargo",
  "off the record",
  "not for publication",
];

export function checkConfidentiality(email: RawEmail): ConfidentialityResult {
  const textToCheck = [email.subject.toLowerCase(), email.bodyText.slice(0, 500).toLowerCase()].join(" ");

  for (const signal of CONFIDENTIAL_SIGNALS) {
    if (textToCheck.includes(signal)) {
      return {
        isConfidential: true,
        reason: `Confidentiality signal detected: "${signal}"`,
        signal,
      };
    }
  }

  return {
    isConfidential: false,
    reason: null,
    signal: null,
  };
}
