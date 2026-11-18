import { parseCaip19Url } from 'farcaster-client-data';

export type ParsedMarketToken = {
  label: string;
  href: string;
  chainId?: number;
  contractAddress?: string;
  tokenId?: string;
  raw: string;
};

function chainLink(raw: string): ParsedMarketToken | null {
  const caip = parseCaip19Url(raw);
  if (!caip || caip.chainNamespace !== 'eip155') return null;
  const chainId = Number(caip.chainReference);
  if (!Number.isFinite(chainId)) return null;
  const contract = caip.assetReference.match(/^(0x[a-fA-F0-9]{40})/)?.[1];
  const tokenId = caip.assetReference.match(/\/(\d+)$/)?.[1]
    ?? (caip.assetNamespace.startsWith('erc') ? caip.assetReference.split(':')[1] : undefined);
  if (!contract) return null;
  const label = tokenId ? `Token #${tokenId}` : contract.slice(0, 6);
  return {
    label,
    href: raw.startsWith('chain://') ? raw : `chain://${raw.replace(/^chain:\/\//, '')}`,
    chainId,
    contractAddress: contract.toLowerCase(),
    tokenId,
    raw,
  };
}

function openSea(url: URL): ParsedMarketToken | null {
  const asset = url.pathname.match(/^\/assets\/([^/]+)\/(0x[a-fA-F0-9]{40})\/(\d+)/);
  if (asset) {
    return {
      label: `OpenSea #${asset[3]}`,
      href: url.toString(),
      chainId: asset[1] === 'ethereum' ? 1 : asset[1] === 'base' ? 8453 : undefined,
      contractAddress: asset[2].toLowerCase(),
      tokenId: asset[3],
      raw: url.toString(),
    };
  }
  const item = url.pathname.match(/^\/item\/([^/]+)\/(0x[a-fA-F0-9]{40})\/(\d+)/);
  if (item) {
    return {
      label: `OpenSea #${item[3]}`,
      href: url.toString(),
      chainId: item[1] === 'ethereum' ? 1 : item[1] === 'base' ? 8453 : undefined,
      contractAddress: item[2].toLowerCase(),
      tokenId: item[3],
      raw: url.toString(),
    };
  }
  return null;
}

function zora(url: URL): ParsedMarketToken | null {
  const collect = url.pathname.match(/^\/collect\/(?:[^:]+:)?(0x[a-fA-F0-9]{40})\/(\d+)/);
  if (collect) {
    return { label: `Zora #${collect[2]}`, href: url.toString(), contractAddress: collect[1].toLowerCase(), tokenId: collect[2], raw: url.toString() };
  }
  return null;
}

function objkt(url: URL): ParsedMarketToken | null {
  const asset = url.pathname.match(/^\/asset\/([^/]+)\/(0x[a-fA-F0-9]{40})\/(\d+)/);
  if (!asset) return null;
  return {
    label: `objkt #${asset[3]}`,
    href: url.toString(),
    contractAddress: asset[2].toLowerCase(),
    tokenId: asset[3],
    raw: url.toString(),
  };
}

function manifold(url: URL): ParsedMarketToken | null {
  const match = url.pathname.match(/^\/c\/[^/]+\/(0x[a-fA-F0-9]{40})\/n\/([^/]+)/);
  if (!match) return null;
  return {
    label: `Manifold #${match[2]}`,
    href: url.toString(),
    contractAddress: match[1].toLowerCase(),
    tokenId: match[2],
    raw: url.toString(),
  };
}

/** such.market token deep links (contract + tokenId when present in path). */
function suchMarket(url: URL): ParsedMarketToken | null {
  const match = url.pathname.match(/^\/(0x[a-fA-F0-9]{40})\/(\d+)/);
  if (!match) return null;
  return {
    label: `such.market #${match[2]}`,
    href: url.toString(),
    contractAddress: match[1].toLowerCase(),
    tokenId: match[2],
    raw: url.toString(),
  };
}

export function parseTokenUrl(raw: string): ParsedMarketToken | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('chain://') || trimmed.startsWith('eip155:')) {
    return chainLink(trimmed);
  }
  try {
    const url = new URL(trimmed);
    if (url.hostname.endsWith('opensea.io')) return openSea(url);
    if (url.hostname.endsWith('zora.co')) return zora(url);
    if (url.hostname.endsWith('objkt.com')) return objkt(url);
    if (url.hostname.endsWith('manifold.xyz')) return manifold(url);
    if (url.hostname.endsWith('such.market')) return suchMarket(url);
  } catch { /* not a URL */ }
  return null;
}