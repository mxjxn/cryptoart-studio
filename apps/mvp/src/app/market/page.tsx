import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import MarketClient from "./MarketClient";

export const metadata: Metadata = {
  title: `Market | ${APP_NAME}`,
  description: "Browse all listings on cryptoart.social",
};

export default function MarketPage() {
  return <MarketClient />;
}





