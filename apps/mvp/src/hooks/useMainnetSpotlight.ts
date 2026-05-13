"use client";

import { useState, useEffect } from "react";
import type { EnrichedAuctionData } from "~/lib/types";
import { ETHEREUM_MAINNET_CHAIN_ID } from "~/lib/server/subgraph-endpoints";
import { HOMEPAGE_MAINNET_LISTING_IDS } from "~/lib/homepage-static-data";

export function useMainnetSpotlight(hideAuctionCards: boolean) {
  const [mainnetSpotlightAuctions, setMainnetSpotlightAuctions] = useState<EnrichedAuctionData[]>([]);

  useEffect(() => {
    if (hideAuctionCards) {
      setMainnetSpotlightAuctions([]);
      return;
    }
    let cancelled = false;

    void (async () => {
      const loaded: EnrichedAuctionData[] = [];
      try {
        for (const id of HOMEPAGE_MAINNET_LISTING_IDS) {
          if (cancelled) break;
          try {
            const params = new URLSearchParams();
            params.set("chainId", String(ETHEREUM_MAINNET_CHAIN_ID));
            params.set("refresh", "1");
            const res = await fetch(`/api/auctions/${encodeURIComponent(id)}?${params.toString()}`, {
              cache: "no-store",
            });
            if (!res.ok) {
              if (res.status === 503) {
                try { await res.json(); } catch {}
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
        }
      } catch {
        if (!cancelled) {
          setMainnetSpotlightAuctions([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hideAuctionCards]);

  return { mainnetSpotlightAuctions };
}
