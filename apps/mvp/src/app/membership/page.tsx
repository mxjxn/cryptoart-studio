import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import MembershipClient from "./MembershipClient";

const membershipImageUrl = process.env.NEXT_PUBLIC_URL
  ? `${process.env.NEXT_PUBLIC_URL}/membership/opengraph-image`
  : '/membership/opengraph-image';

export async function generateMetadata(): Promise<Metadata> {
  const membershipPageUrl = process.env.NEXT_PUBLIC_URL
    ? `${process.env.NEXT_PUBLIC_URL}/membership`
    : '/membership';
  
  // Create separate metadata objects for fc:miniapp and fc:frame
  // fc:frame needs useFrameType: true for backward compatibility
  const miniappMetadata = getMiniAppEmbedMetadata(
    membershipImageUrl,
    membershipPageUrl,
    false,        // use launch_miniapp type
    membershipImageUrl,
  );
  const frameMetadata = getMiniAppEmbedMetadata(
    membershipImageUrl,
    membershipPageUrl,
    true,         // use launch_frame type for backward compatibility
    membershipImageUrl,
  );
  
  return {
    title: `Membership | ${APP_NAME}`,
    description: "Mint or renew your membership to create auctions",
    other: {
      // Farcaster Mini App embed metadata
      // Follows spec: https://miniapps.farcaster.xyz/docs/guides/sharing
      "fc:miniapp": JSON.stringify(miniappMetadata),
      // For backward compatibility - use launch_frame type
      "fc:frame": JSON.stringify(frameMetadata),
    },
  };
}

export default function MembershipPage() {
  return <MembershipClient />;
}

