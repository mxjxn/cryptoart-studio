import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import GalleryEditClient from "./GalleryEditClient";

interface GalleryEditPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: GalleryEditPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Edit Gallery | ${APP_NAME}`,
    description: "Edit your curated gallery",
  };
}

export default async function GalleryEditPage({ params }: GalleryEditPageProps) {
  const { id } = await params;
  return <GalleryEditClient galleryId={id} />;
}

