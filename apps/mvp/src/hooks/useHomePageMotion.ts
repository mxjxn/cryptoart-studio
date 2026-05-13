"use client";

import { useRef, useEffect, useLayoutEffect } from "react";
import {
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { FEATURED_HEADER_HEIGHT_FALLBACK_PX } from "~/lib/homepage-static-data";

export function useHomePageMotion(searchParams: URLSearchParams) {
  const pageRef = useRef<HTMLDivElement>(null);
  const featuredSectionRef = useRef<HTMLElement>(null);
  const featuredHeaderMeasureRef = useRef<HTMLHeadingElement>(null);
  const featuredHeaderHeightMv = useMotionValue(FEATURED_HEADER_HEIGHT_FALLBACK_PX);
  const prefersReducedMotion = useReducedMotion();

  const devForceMotion =
    process.env.NODE_ENV !== "production" && searchParams.get("forceMotion") === "1";
  const shouldAnimate = devForceMotion || !prefersReducedMotion;
  const motionDebugEnabled =
    process.env.NODE_ENV !== "production" && searchParams.get("motionDebug") === "1";

  const { scrollYProgress } = useScroll({
    target: pageRef,
    offset: ["start start", "end end"],
  });

  const pageScrollLogBucketRef = useRef(-1);
  const featuredScrollLogBucketRef = useRef(-1);

  const heroY = useTransform(scrollYProgress, [0, 0.25], [0, shouldAnimate ? -28 : 0]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, shouldAnimate ? 0.82 : 1]);
  const heroScale = useTransform(scrollYProgress, [0, 0.25], [1, shouldAnimate ? 0.98 : 1]);

  const { scrollYProgress: featuredProgress } = useScroll({
    target: featuredSectionRef,
    offset: ["start end", "end start"],
  });

  const featuredContentY = useTransform([featuredProgress, featuredHeaderHeightMv], ([p, h]) => {
    if (!shouldAnimate) return 0;
    const H = typeof h === "number" && h > 0 ? h : FEATURED_HEADER_HEIGHT_FALLBACK_PX;
    const cap = -0.4 * H;
    const mid = cap * (68 / 120);
    const progress = typeof p === "number" ? p : 0;
    if (progress <= 0.45) return (progress / 0.45) * mid;
    return mid + ((progress - 0.45) / 0.55) * (cap - mid);
  });

  useLayoutEffect(() => {
    const el = featuredHeaderMeasureRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) featuredHeaderHeightMv.set(h);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [featuredHeaderHeightMv]);

  useEffect(() => {
    if (!motionDebugEnabled) return;
    console.log("[motion-debug] mount", {
      prefersReducedMotion,
      devForceMotion,
      shouldAnimate,
      motionPolicy:
        prefersReducedMotion && !devForceMotion
          ? "reduced — matches prefers-reduced-motion (OS/browser). Add &forceMotion=1 in dev to preview animations."
          : "full",
      href: window.location.href,
    });
  }, [motionDebugEnabled, prefersReducedMotion, devForceMotion, shouldAnimate]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (!motionDebugEnabled) return;
    const value = Number(latest.toFixed(3));
    const bucket = Math.min(10, Math.max(0, Math.floor(value * 10)));
    if (bucket !== pageScrollLogBucketRef.current) {
      pageScrollLogBucketRef.current = bucket;
      console.log("[motion-debug] page scroll progress", value);
    }
  });

  useMotionValueEvent(featuredProgress, "change", (latest) => {
    if (!motionDebugEnabled) return;
    const value = Number(latest.toFixed(3));
    const bucket = Math.min(10, Math.max(0, Math.floor(value * 10)));
    if (bucket !== featuredScrollLogBucketRef.current) {
      featuredScrollLogBucketRef.current = bucket;
      console.log("[motion-debug] featured section progress", value);
    }
  });

  return {
    pageRef,
    featuredSectionRef,
    featuredHeaderMeasureRef,
    shouldAnimate,
    heroY,
    heroOpacity,
    heroScale,
    featuredContentY,
    featuredProgress,
  };
}
