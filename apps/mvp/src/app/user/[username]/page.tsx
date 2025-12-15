import { Metadata } from "next";
import { APP_NAME } from "~/lib/constants";
import UserProfileClient from "./UserProfileClient";

interface UserProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: UserProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  
  const title = `${username} | ${APP_NAME}`;
  const description = `View profile for ${username}`;

  return {
    title,
    description,
  };
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { username } = await params;
  return <UserProfileClient username={username} />;
}





