import type { CastCard } from '../neynar';
import { classifyCastEmbeds, embedLayoutClass } from './classify';
import { ListingEmbedCard } from './ListingEmbedCard';
import { DeskFrameCard } from './cards/DeskFrameCard';
import { DeskOpenGraphCard } from './cards/DeskOpenGraphCard';
import { DeskPlainLink } from './cards/DeskPlainLink';
import { DeskQuoteCard } from './cards/DeskQuoteCard';
import { DeskStubCard } from './cards/DeskStubCard';
import { DeskTokenCard } from './cards/DeskTokenCard';
import { DeskVideoCard } from './cards/DeskVideoCard';
import type { DeskImageEmbed } from './types';

function EmbedItem({ item }: { item: ReturnType<typeof classifyCastEmbeds>[number] }) {
  switch (item.kind) {
    case 'cryptoart-listing':
      return <ListingEmbedCard chainId={item.listing.chainId} listingId={item.listing.listingId} originalUrl={item.listing.originalUrl} />;
    case 'nft-token':
      return <DeskTokenCard token={item.token} />;
    case 'frame':
      return <DeskFrameCard frame={item.frame} />;
    case 'quote':
      return <DeskQuoteCard quote={item.quote} />;
    case 'video':
      return <DeskVideoCard video={item.video} />;
    case 'image':
      return <DeskImageEmbedView image={item.image} />;
    case 'open-graph':
      return <DeskOpenGraphCard urlEmbed={item.urlEmbed} />;
    case 'plain-link':
      return <DeskPlainLink href={item.href} label={item.label} />;
    default: {
      if ('stub' in item) return <DeskStubCard stub={item.stub} href={item.href} />;
      return null;
    }
  }
}

function DeskImageEmbedView({ image }: { image: DeskImageEmbed }) {
  return <div className="inline-block max-w-full overflow-hidden rounded-md border border-[#2a2a2a]">
    <img
      src={image.url}
      alt={image.alt || 'Embed image'}
      className="block max-h-[280px] max-w-full h-auto w-auto"
    />
  </div>;
}

export function DeskCastEmbeds({ cast }: { cast: CastCard }) {
  const items = classifyCastEmbeds(cast);
  if (!items.length) return null;
  return <div className={embedLayoutClass(items.length)}>
    {items.map(item => <EmbedItem key={item.key} item={item} />)}
  </div>;
}