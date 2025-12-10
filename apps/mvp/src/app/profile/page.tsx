import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import ProfileClient from "./ProfileClient";

const profileImageUrl = process.env.NEXT_PUBLIC_URL
  ? `${process.env.NEXT_PUBLIC_URL}/profile/opengraph-image`
  : '/profile/opengraph-image';

export async function generateMetadata(): Promise<Metadata> {
  const profilePageUrl = process.env.NEXT_PUBLIC_URL
    ? `${process.env.NEXT_PUBLIC_URL}/profile`
    : '/profile';
  
  // Create separate metadata objects for fc:miniapp and fc:frame
  // fc:frame needs useFrameType: true for backward compatibility
  const miniappMetadata = getMiniAppEmbedMetadata(
    profileImageUrl,
    profilePageUrl,
    false,        // use launch_miniapp type
    profileImageUrl,
  );
  const frameMetadata = getMiniAppEmbedMetadata(
    profileImageUrl,
    profilePageUrl,
    true,         // use launch_frame type for backward compatibility
    profileImageUrl,
  );
  
  return {
    title: `Profile | ${APP_NAME}`,
    description: "View your created auctions, collected NFTs, and active bids",
    other: {
      // Farcaster Mini App embed metadata
      // Follows spec: https://miniapps.farcaster.xyz/docs/guides/sharing
      "fc:miniapp": JSON.stringify(miniappMetadata),
      // For backward compatibility - use launch_frame type
      "fc:frame": JSON.stringify(frameMetadata),
    },
  };
}

export default function ProfilePage() {
  return <ProfileClient />;
}

