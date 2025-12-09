import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import MaintenancePage from "./MaintenancePage";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${APP_NAME} - Maintenance`,
    description: "Cryptoart is down for routine maintenance. We'll be back shortly.",
  };
}

export default function Home() {
  return <MaintenancePage />;
}

