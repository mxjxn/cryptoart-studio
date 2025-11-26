import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import ProfileClient from "./ProfileClient";

const profileImageUrl = process.env.NEXT_PUBLIC_URL
  ? `${process.env.NEXT_PUBLIC_URL}/profile/opengraph-image`
  : '/profile/opengraph-image';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Profile | ${APP_NAME}`,
    description: "View your created auctions, collected NFTs, and active bids",
    other: {
      "fc:miniapp": JSON.stringify(getMiniAppEmbedMetadata(profileImageUrl)),
      "fc:frame": JSON.stringify(getMiniAppEmbedMetadata(profileImageUrl)),
    },
  };
}

export default function ProfilePage() {
  return <ProfileClient />;
}

