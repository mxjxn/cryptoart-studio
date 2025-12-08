import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import CurateClient from "./CurateClient";

export const metadata: Metadata = {
  title: `My Galleries | ${APP_NAME}`,
  description: "Create and manage your curated galleries",
};

export default function CuratePage() {
  return <CurateClient />;
}

