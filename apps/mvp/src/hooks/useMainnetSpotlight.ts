"use client";

import { useState, useEffect } from "react";
import type { EnrichedAuctionData } from "~/lib/types";
import {
  mergeSpotlightCopy,
  type HomepageSpotlightCopy,
} from "~/lib/homepage-spotlight-defaults";

type SpotlightPin = { listingId: string; chainId: number };

export function useMainnetSpotlight(hideAuctionCards: boolean) {
  const [mainnetSpotlightAuctions, setMainnetSpotlightAuctions] = useState<EnrichedAuctionData[]>([]);
  const [spotlightCardsVisible, setSpotlightCardsVisible] = useState(false);
  const [spotlightCopy, setSpotlightCopy] = useState<HomepageSpotlightCopy>(() =>
    mergeSpotlightCopy(null),
  );
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    if (hideAuctionCards) {
      setMainnetSpotlightAuctions([]);
      setSpotlightCardsVisible(false);
      setSpotlightCopy(mergeSpotlightCopy(null));
      setConfigLoaded(true);
      return;
    }
    let cancelled = false;

    void (async () => {
      setConfigLoaded(false);
      try {
        const configRes = await fetch("/api/homepage-spotlight", { cache: "no-store" });
        if (!configRes.ok) {
          if (!cancelled) {
            setMainnetSpotlightAuctions([]);
            setSpotlightCardsVisible(false);
            setSpotlightCopy(mergeSpotlightCopy(null));
            setConfigLoaded(true);
          }
          return;
        }
        const config = (await configRes.json()) as {
          cardsVisible?: boolean;
          pins?: SpotlightPin[];
          copy?: Partial<HomepageSpotlightCopy>;
        };
        const cardsVisible = config.cardsVisible === true;
        const pins = Array.isArray(config.pins) ? config.pins : [];

        if (!cancelled) {
          setSpotlightCardsVisible(cardsVisible);
          setSpotlightCopy(mergeSpotlightCopy(config.copy));
        }

        if (!cardsVisible || pins.length === 0) {
          if (!cancelled) {
            setMainnetSpotlightAuctions([]);
            setConfigLoaded(true);
          }
          return;
        }

        const loaded: EnrichedAuctionData[] = [];
        for (const pin of pins) {
          if (cancelled) break;
          try {
            const params = new URLSearchParams();
            params.set("chainId", String(pin.chainId));
            params.set("refresh", "1");
            const res = await fetch(
              `/api/auctions/${encodeURIComponent(pin.listingId)}?${params.toString()}`,
              { cache: "no-store" },
            );
            if (!res.ok) {
              if (res.status === 503) {
                try {
                  await res.json();
                } catch {
                  /* ignore */
                }
                break;
              }
              continue;
            }
            const data = (await res.json()) as { success?: boolean; auction?: EnrichedAuctionData };
            if (data?.success && data.auction && !cancelled) {
              loaded.push(data.auction);
            }
          } catch {
            // ignore per-listing failures
          }
        }
        if (!cancelled) {
          setMainnetSpotlightAuctions(loaded);
          setConfigLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setMainnetSpotlightAuctions([]);
          setSpotlightCardsVisible(false);
          setSpotlightCopy(mergeSpotlightCopy(null));
          setConfigLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hideAuctionCards]);

  const showSpotlightCards =
    !hideAuctionCards &&
    configLoaded &&
    spotlightCardsVisible &&
    mainnetSpotlightAuctions.length > 0;

  return {
    mainnetSpotlightAuctions,
    showSpotlightCards,
    spotlightCardsVisible,
    spotlightCopy,
    configLoaded,
  };
}
