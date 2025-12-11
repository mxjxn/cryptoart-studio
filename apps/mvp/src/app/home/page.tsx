import { Metadata } from "next";
import { APP_NAME, APP_DESCRIPTION } from "~/lib/constants";
import HomePageClient from "../HomePageClient";

export const metadata: Metadata = {
  title: `${APP_NAME} - Home (Preview)`,
  description: APP_DESCRIPTION,
};

// Enable ISR for preview page as well
export const revalidate = 60;

export default async function HomePreview() {
  // Client-side fetching is now handled in HomePageClient
  return <HomePageClient />;
}



