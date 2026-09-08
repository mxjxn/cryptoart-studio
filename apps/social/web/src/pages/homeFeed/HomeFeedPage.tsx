import { EventingProvider } from 'farcaster-client-hooks';
import { BorderedMainContent } from '~/components/BorderedMainContent';
import { Page } from '~/components/page/Page';
import { HomeFeedPageContent } from './HomeFeedPageContent';

export function HomeFeedPage() {
  return <Page meta={{ title: 'Cryptoart Social', description: 'Art and conversation from your channels.', canonical: 'https://cryptoart.social', twitterCard: 'summary' }}>
    <BorderedMainContent>
      <EventingProvider on="home" channel="home"><HomeFeedPageContent /></EventingProvider>
    </BorderedMainContent>
  </Page>;
}
