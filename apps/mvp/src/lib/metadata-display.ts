import type { NFTMetadata } from "./nft-metadata";

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/**
 * Best-effort human title from common NFT metadata shapes (OpenSea, Manifold, Zora-ish JSON).
 */
export function pickDisplayTitle(metadata: NFTMetadata | null | undefined): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const r = metadata as Record<string, unknown>;
  const fromTop =
    str(metadata.title) ||
    str(metadata.name) ||
    str(r.title) ||
    str(r.name) ||
    str(r.Name) ||
    str(r.Title);
  if (fromTop) return fromTop;

  const props = r.properties;
  if (props && typeof props === "object") {
    const p = props as Record<string, unknown>;
    const fromProps = str(p.name) || str(p.title) || str(p.Name);
    if (fromProps) return fromProps;
  }

  const content = r.content;
  if (content && typeof content === "object") {
    const c = content as Record<string, unknown>;
    const fromContent = str(c.name) || str(c.title);
    if (fromContent) return fromContent;
  }

  return undefined;
}
