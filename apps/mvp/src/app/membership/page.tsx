import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import MembershipClient from "./MembershipClient";

const membershipImageUrl = process.env.NEXT_PUBLIC_URL
  ? `${process.env.NEXT_PUBLIC_URL}/membership/opengraph-image`
  : '/membership/opengraph-image';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Membership | ${APP_NAME}`,
    description: "Mint or renew your membership to create auctions",
    other: {
      "fc:miniapp": JSON.stringify(getMiniAppEmbedMetadata(membershipImageUrl)),
      "fc:frame": JSON.stringify(getMiniAppEmbedMetadata(membershipImageUrl)),
    },
  };
}

export default function MembershipPage() {
  return <MembershipClient />;
}

