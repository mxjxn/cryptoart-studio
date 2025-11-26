import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import CreateAuctionClient from "./CreateAuctionClient";

const createImageUrl = process.env.NEXT_PUBLIC_URL 
  ? `${process.env.NEXT_PUBLIC_URL}/create/opengraph-image`
  : '/create/opengraph-image';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Create Auction | ${APP_NAME}`,
    description: "Create a new NFT auction listing",
    other: {
      "fc:miniapp": JSON.stringify(getMiniAppEmbedMetadata(createImageUrl)),
      "fc:frame": JSON.stringify(getMiniAppEmbedMetadata(createImageUrl)),
    },
  };
}

export default function CreateAuctionPage() {
  return <CreateAuctionClient />;
}

