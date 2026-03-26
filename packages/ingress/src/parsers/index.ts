import type { SourceType } from "@prisma/client";
import type { IEmailParser } from "../types.js";
import { FathomParser } from "./fathom.js";
import { FirefliesParser } from "./fireflies.js";
import { GenericParser } from "./generic.js";

const PARSER_ENTRIES: Array<[SourceType, IEmailParser]> = [
  ["fathom", new FathomParser()],
  ["fireflies", new FirefliesParser()],
  // 'generic' parser - debug mode only, not a real source.
  ["generic", new GenericParser()],
];

const PARSERS: Map<SourceType, IEmailParser> = new Map(PARSER_ENTRIES);

export function getParser(source: SourceType): IEmailParser | null {
  return PARSERS.get(source) ?? null;
}

export function getAllParsers(): IEmailParser[] {
  return Array.from(PARSERS.values());
}
