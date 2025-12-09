import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import UserProfileClient from "./UserProfileClient";

interface UserProfilePageProps {
  params: Promise<{ fname: string }>;
}

export async function generateMetadata({ params }: UserProfilePageProps): Promise<Metadata> {
  const { fname } = await params;
  
  const title = `${fname} | ${APP_NAME}`;
  const description = `View profile for ${fname}`;

  return {
    title,
    description,
  };
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { fname } = await params;
  return <UserProfileClient fname={fname} />;
}






