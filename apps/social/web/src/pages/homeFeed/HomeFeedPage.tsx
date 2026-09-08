import { EventingProvider } from 'farcaster-client-hooks';
import { BorderedMainContent } from '~/components/BorderedMainContent';
import { Page } from '~/components/page/Page';
import { PageHeader } from '~/components/page/PageHeader';
import { PageTitle } from '~/components/page/PageTitle';
import { HomeFeedPageContent } from './HomeFeedPageContent';

export function HomeFeedPage() {
  return <Page meta={{ title: 'Cryptoart Social', description: 'Art and conversation from your channels.', canonical: 'https://cryptoart.social', twitterCard: 'summary' }}>
    <BorderedMainContent>
      <PageHeader footer={undefined}><PageTitle>Cryptoart Social</PageTitle></PageHeader>
      <EventingProvider on="home" channel="home"><HomeFeedPageContent /></EventingProvider>
    </BorderedMainContent>
  </Page>;
}
