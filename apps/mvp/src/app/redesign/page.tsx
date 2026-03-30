import type { Metadata } from "next";
import HomePageClientV2 from "../HomePageClientV2";

export const metadata: Metadata = {
  title: "Home (redesign preview)",
  description: "Work-in-progress homepage layout preview (Figma Homepage frame).",
  robots: { index: false, follow: false },
};

export default function RedesignPage() {
  return <HomePageClientV2 />;
}
