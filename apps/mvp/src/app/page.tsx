import { Metadata } from "next";
import { APP_NAME, APP_DESCRIPTION, APP_OG_IMAGE_URL } from "~/lib/constants";
import { getMiniAppEmbedMetadata } from "~/lib/utils";
import HomePageClient from "./HomePageClient";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: APP_NAME,
    description: APP_DESCRIPTION,
    openGraph: {
      title: APP_NAME,
      description: APP_DESCRIPTION,
      images: [APP_OG_IMAGE_URL],
    },
    other: {
      "fc:miniapp": JSON.stringify(getMiniAppEmbedMetadata()),
      "fc:frame": JSON.stringify(getMiniAppEmbedMetadata()),
    },
  };
}

export default function Home() {
  return <HomePageClient />;
}

