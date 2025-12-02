import { Metadata } from 'next';
import NotificationsClient from './NotificationsClient';

export const metadata: Metadata = {
  title: 'Notifications | CryptoArt',
  description: 'View your notifications',
};

export default function NotificationsPage() {
  return <NotificationsClient />;
}

