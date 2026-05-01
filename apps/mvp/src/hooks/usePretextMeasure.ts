"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  measureParagraph,
  prepareParagraph,
  type ParagraphLayoutResult,
  type PretextPrepareOptions,
} from "~/lib/pretext/measure";

type UsePretextMeasureArgs = {
  text: string;
  font: string;
  lineHeightPx: number;
  options?: PretextPrepareOptions;
};

type UsePretextMeasureResult<T extends HTMLElement> = {
  ref: RefObject<T | null>;
  width: number;
  predicted: ParagraphLayoutResult;
  actualLineCount: number;
  actualHeight: number;
};

function parseLineHeightPx(el: HTMLElement, fallback: number): number {
  const computed = window.getComputedStyle(el);
  const lineHeight = Number.parseFloat(computed.lineHeight);
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
  return fallback;
}

export function usePretextMeasure<T extends HTMLElement = HTMLElement>({
  text,
  font,
  lineHeightPx,
  options,
}: UsePretextMeasureArgs): UsePretextMeasureResult<T> {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  const [actualHeight, setActualHeight] = useState(0);
  const [actualLineCount, setActualLineCount] = useState(0);

  const prepared = useMemo(() => {
    return prepareParagraph(text, font, options);
  }, [text, font, options?.letterSpacing, options?.whiteSpace, options?.wordBreak]);

  const predicted = useMemo(() => {
    return measureParagraph(prepared, width, lineHeightPx);
  }, [prepared, width, lineHeightPx]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateMeasurements = () => {
      const nextWidth = element.clientWidth;
      const nextHeight = element.clientHeight;
      const measuredLineHeight = parseLineHeightPx(element, lineHeightPx);
      const nextLineCount = measuredLineHeight > 0 ? Math.round(nextHeight / measuredLineHeight) : 0;
      setWidth(nextWidth);
      setActualHeight(nextHeight);
      setActualLineCount(nextLineCount);
    };

    updateMeasurements();

    const resizeObserver = new ResizeObserver(() => {
      updateMeasurements();
    });
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [lineHeightPx, text]);

  return {
    ref,
    width,
    predicted,
    actualLineCount,
    actualHeight,
  };
}
