"use client";

import { TransitionLink } from "~/components/TransitionLink";
import { getChainNetworkInfo } from "~/lib/chain-display";
import { canonicalListingDetailPath } from "~/lib/listing-chain-paths";
import {
  BASE_CHAIN_ID,
  ETHEREUM_MAINNET_CHAIN_ID,
} from "~/lib/server/subgraph-endpoints";

type Variant = "light" | "dark";

/**
 * Shown when the same numeric `listingId` exists on more than one configured chain
 * and the URL does not specify `chainId` (e.g. legacy `/auction/:id` or `/listing/:id`).
 */
export function AmbiguousListingPicker({
  listingId,
  chains,
  variant = "light",
}: {
  listingId: string;
  chains: number[];
  variant?: Variant;
}) {
  const uniq = [...new Set(chains.filter((n) => Number.isFinite(n)))].sort(
    (a, b) => a - b
  );
  const toShow =
    uniq.length >= 2 ? uniq : [ETHEREUM_MAINNET_CHAIN_ID, BASE_CHAIN_ID];

  const shell =
    variant === "dark"
      ? "min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center px-4"
      : "listing-detail-page min-h-screen bg-neutral-50 text-neutral-900 flex flex-col items-center justify-center px-4";
  const card =
    variant === "dark"
      ? "max-w-md rounded-2xl border border-neutral-700 bg-neutral-900/80 p-6 shadow-xl"
      : "max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm";
  const titleClass =
    variant === "dark" ? "text-lg font-semibold text-white" : "text-lg font-semibold text-neutral-900";
  const bodyClass =
    variant === "dark" ? "mt-2 text-sm text-neutral-400" : "mt-2 text-sm text-neutral-600";
  const linkBase =
    variant === "dark"
      ? "block w-full rounded-lg border border-neutral-600 bg-neutral-800 px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-neutral-700"
      : "block w-full rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100";

  return (
    <div className={shell}>
      <div className={card}>
        <h1 className={titleClass}>Choose a network</h1>
        <p className={bodyClass}>
          Listing <span className="font-mono tabular-nums">#{listingId}</span> exists on more
          than one chain. Open the correct network so bids, balances, and metadata match the
          listing you intend.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {toShow.map((cid) => {
            const info = getChainNetworkInfo(cid);
            const href = canonicalListingDetailPath(cid, listingId);
            return (
              <li key={cid}>
                <TransitionLink href={href} className={linkBase}>
                  <span className="block font-semibold">{info.displayName}</span>
                  <span className="mt-1 block font-mono text-xs opacity-80">
                    chain ID {info.chainId}
                  </span>
                </TransitionLink>
              </li>
            );
          })}
        </ul>
        <div className="mt-6 text-center">
          <TransitionLink
            href="/"
            className={
              variant === "dark"
                ? "text-sm text-neutral-400 underline-offset-2 hover:text-white hover:underline"
                : "text-sm text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline"
            }
          >
            Back to home
          </TransitionLink>
        </div>
      </div>
    </div>
  );
}
