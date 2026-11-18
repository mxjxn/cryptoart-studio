import { CryptoartHeader } from './CryptoartHeader';
import { DeskCastEmbeds } from './embeds/DeskCastEmbeds';
import { embedFixtureCasts } from './embeds/fixtures';

export function EmbedFixturesPage() {
  const entries = Object.entries(embedFixtureCasts);
  return <main className="cryptoart-shell min-h-screen bg-black text-white">
    <CryptoartHeader active="feed" />
    <section className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-medium">Desk embed fixtures</h1>
      <p className="mt-2 text-sm text-[#888]">Visual review route for every classified embed type.</p>
      <ul className="mt-8 space-y-10">
        {entries.map(([key, cast]) => <li key={key}>
          <p className="cryptoart-mono mb-2 text-[11px] uppercase tracking-[0.12em] text-[#dcf54c]">{key}</p>
          <DeskCastEmbeds cast={cast} />
        </li>)}
      </ul>
    </section>
  </main>;
}