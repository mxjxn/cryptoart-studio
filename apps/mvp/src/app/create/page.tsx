import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import CreateAuctionClient from "./CreateAuctionClient";

const createImageUrl = process.env.NEXT_PUBLIC_URL 
  ? `${process.env.NEXT_PUBLIC_URL}/create/opengraph-image`
  : '/create/opengraph-image';

export async function generateMetadata(): Promise<Metadata> {
  const createPageUrl = process.env.NEXT_PUBLIC_URL
    ? `${process.env.NEXT_PUBLIC_URL}/create`
    : '/create';
  
  // Create separate metadata objects for fc:miniapp and fc:frame
  // fc:frame needs useFrameType: true for backward compatibility
  const miniappMetadata = getMiniAppEmbedMetadata(
    createImageUrl,
    createPageUrl,
    false,        // use launch_miniapp type
    createImageUrl,
  );
  const frameMetadata = getMiniAppEmbedMetadata(
    createImageUrl,
    createPageUrl,
    true,         // use launch_frame type for backward compatibility
    createImageUrl,
  );
  
  return {
    title: `Create Auction | ${APP_NAME}`,
    description: "Create a new NFT auction listing",
    other: {
      // Farcaster Mini App embed metadata
      // Follows spec: https://miniapps.farcaster.xyz/docs/guides/sharing
      "fc:miniapp": JSON.stringify(miniappMetadata),
      // For backward compatibility - use launch_frame type
      "fc:frame": JSON.stringify(frameMetadata),
    },
  };
}

export default function CreateAuctionPage() {
  return <CreateAuctionClient />;
}

