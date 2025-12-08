"use client";

import { useState, useEffect } from "react";
import type { ReactElement } from "react";
import { Address } from "viem";
import { fetchNFTMetadata } from "~/lib/nft-metadata";
import type { NFTMetadata } from "~/lib/nft-metadata";

interface MetadataViewerProps {
  contractAddress: Address;
  tokenId: string;
  tokenSpec: "ERC721" | "ERC1155" | number;
  collectionName?: string | null;
}

export function MetadataViewer({
  contractAddress,
  tokenId,
  tokenSpec,
  collectionName,
}: MetadataViewerProps) {
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadMetadata = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetched = await fetchNFTMetadata(contractAddress, tokenId, tokenSpec);
        if (isMounted) {
          setMetadata(fetched);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load metadata");
          setLoading(false);
        }
      }
    };

    loadMetadata();

    return () => {
      isMounted = false;
    };
  }, [contractAddress, tokenId, tokenSpec]);

  const displayName = collectionName || metadata?.name || metadata?.title || "Collection";
  const displayText = `${displayName} #${tokenId}`;

  if (loading) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="text-xs text-[#999999] hover:text-[#cccccc] hover:underline inline-flex items-center gap-1.5"
        aria-label={`${displayText} - Loading metadata`}
        aria-busy="true"
      >
        <span>{displayText}</span>
        <div className="w-3 h-3 border border-[#666666] border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
      </button>
    );
  }

  if (error || !metadata) {
    return (
      <div className="text-xs text-[#999999]" role="status" aria-live="polite">
        {displayText}
        {error && <span className="text-[#666666] ml-2" aria-label={`Error: ${error}`}>({error})</span>}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs text-[#999999] hover:text-[#cccccc] hover:underline mb-2 inline-block"
        aria-label={`${isExpanded ? "Collapse" : "Expand"} metadata for ${displayText}`}
        aria-expanded={isExpanded}
        aria-controls="metadata-display"
      >
        {displayText}
      </button>
      {isExpanded && (
        <div id="metadata-display" role="region" aria-label="NFT Metadata">
          <MetadataDisplay metadata={metadata} />
        </div>
      )}
    </div>
  );
}

function MetadataDisplay({ metadata }: { metadata: NFTMetadata }) {
  const sections: Array<{ title: string; content: ReactElement | null }> = [];

  // Name/Title
  if (metadata.name || metadata.title) {
    sections.push({
      title: "Name",
      content: (
        <div className="text-xs text-[#cccccc] font-mono">
          {metadata.name || metadata.title}
        </div>
      ),
    });
  }

  // Description
  if (metadata.description) {
    sections.push({
      title: "Description",
      content: (
        <div className="text-xs text-[#cccccc] leading-relaxed whitespace-pre-wrap">
          {metadata.description}
        </div>
      ),
    });
  }

  // Image
  if (metadata.image) {
    sections.push({
      title: "Image",
      content: (
        <a
          href={metadata.image}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#999999] hover:text-[#cccccc] hover:underline font-mono break-all"
          aria-label={`View image: ${metadata.image}`}
        >
          {metadata.image}
        </a>
      ),
    });
  }

  // Animation URL
  if (metadata.animation_url) {
    sections.push({
      title: "Animation",
      content: (
        <a
          href={metadata.animation_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#999999] hover:text-[#cccccc] hover:underline font-mono break-all"
          aria-label={`View animation: ${metadata.animation_url}`}
        >
          {metadata.animation_url}
        </a>
      ),
    });
  }

  // External URL
  if (metadata.external_url) {
    sections.push({
      title: "External URL",
      content: (
        <a
          href={metadata.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#999999] hover:text-[#cccccc] hover:underline font-mono break-all"
          aria-label={`Open external link: ${metadata.external_url}`}
        >
          {metadata.external_url}
        </a>
      ),
    });
  }

  // Background Color
  if (metadata.background_color) {
    sections.push({
      title: "Background Color",
      content: (
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded border border-[#333333]"
            style={{ backgroundColor: `#${metadata.background_color}` }}
          ></div>
          <span className="text-xs text-[#cccccc] font-mono">
            #{metadata.background_color}
          </span>
        </div>
      ),
    });
  }

  // Attributes
  if (metadata.attributes && metadata.attributes.length > 0) {
    sections.push({
      title: "Attributes",
      content: (
        <div className="space-y-1">
          {metadata.attributes.map((attr, idx) => (
            <div key={idx} className="text-xs text-[#cccccc]">
              <span className="text-[#999999]">{attr.trait_type}:</span>{" "}
              <span className="font-mono">{String(attr.value)}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  // Artist/Creator
  if (metadata.artist || metadata.creator) {
    sections.push({
      title: "Artist",
      content: (
        <div className="text-xs text-[#cccccc] font-mono">
          {metadata.artist || metadata.creator}
        </div>
      ),
    });
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 space-y-3 border-t border-[#333333] pt-3" role="list">
      {sections.map((section, idx) => (
        <div key={idx} role="listitem">
          <div className="text-[10px] text-[#666666] uppercase tracking-wider mb-1" role="heading" aria-level={3}>
            {section.title}
          </div>
          {section.content}
        </div>
      ))}
    </div>
  );
}

