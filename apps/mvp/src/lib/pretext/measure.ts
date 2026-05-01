import { layout, prepare, type PreparedText } from "@chenglou/pretext";

export type PretextPrepareOptions = {
  whiteSpace?: "normal" | "pre-wrap";
  wordBreak?: "normal" | "keep-all";
  letterSpacing?: number;
};

export type PreparedParagraph = PreparedText;

export type ParagraphLayoutResult = {
  height: number;
  lineCount: number;
};

const preparedCache = new Map<string, PreparedParagraph>();

function getPrepareCacheKey(text: string, font: string, options?: PretextPrepareOptions): string {
  return JSON.stringify({
    text,
    font,
    whiteSpace: options?.whiteSpace ?? "normal",
    wordBreak: options?.wordBreak ?? "normal",
    letterSpacing: options?.letterSpacing ?? 0,
  });
}

export function prepareParagraph(
  text: string,
  font: string,
  options?: PretextPrepareOptions,
): PreparedParagraph {
  const key = getPrepareCacheKey(text, font, options);
  const existing = preparedCache.get(key);
  if (existing) {
    return existing;
  }

  const prepared = prepare(text, font, options);
  preparedCache.set(key, prepared);
  return prepared;
}

export function measureParagraph(
  prepared: PreparedParagraph,
  maxWidth: number,
  lineHeight: number,
): ParagraphLayoutResult {
  const width = Number.isFinite(maxWidth) ? Math.max(0, maxWidth) : 0;
  const normalizedLineHeight = Number.isFinite(lineHeight) ? Math.max(0, lineHeight) : 0;
  return layout(prepared, width, normalizedLineHeight);
}

export function clearPreparedParagraphCache(): void {
  preparedCache.clear();
}
