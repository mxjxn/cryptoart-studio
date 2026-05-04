import type { Metadata } from "next";
import { getDatabase, curation, curationItems, desc, count } from "@cryptoart/db";
import { APP_NAME, APP_URL } from "~/lib/constants";
import { getGalleryUrl } from "~/lib/gallery-url";
import { getUserFromCache } from "~/lib/server/user-cache";

export const metadata: Metadata = {
  title: `Galleries | ${APP_NAME}`,
  description: "Internal directory of galleries (not linked from site navigation).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GalleriesDirectoryPage() {
  let rows: Awaited<ReturnType<typeof loadGalleryRows>>;
  try {
    rows = await loadGalleryRows();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return (
      <div className="min-h-screen bg-black text-white px-5 py-10 max-w-4xl mx-auto">
        <h1 className="text-xl font-normal mb-4">Galleries</h1>
        <p className="text-red-400">Could not load galleries: {message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-5 py-10 max-w-6xl mx-auto">
      <h1 className="text-xl font-normal mb-2">Galleries</h1>
      <p className="text-sm text-[#999999] mb-8">
        Newest first. Copy UUID or full URL. Drafts use the curate edit path.
      </p>

      <div className="overflow-x-auto border border-[#333333] rounded-lg">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[#333333] text-[#999999]">
              <th className="py-3 px-3 font-normal">Title</th>
              <th className="py-3 px-3 font-normal">Status</th>
              <th className="py-3 px-3 font-normal">Items</th>
              <th className="py-3 px-3 font-normal">Curator</th>
              <th className="py-3 px-3 font-normal">UUID</th>
              <th className="py-3 px-3 font-normal">Public / edit URL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#222222] last:border-0 align-top">
                <td className="py-3 px-3 text-white max-w-[200px]">
                  <span className="line-clamp-2">{row.title}</span>
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  {row.isPublished ? (
                    <span className="text-green-400">Published</span>
                  ) : (
                    <span className="text-[#888888]">Draft</span>
                  )}
                </td>
                <td className="py-3 px-3 tabular-nums">{row.itemCount}</td>
                <td className="py-3 px-3 font-mono text-xs text-[#bbbbbb] break-all">
                  {row.username ? (
                    <span title={row.curatorAddress}>@{row.username}</span>
                  ) : (
                    <span title="No username in cache">{row.curatorAddress}</span>
                  )}
                </td>
                <td className="py-3 px-3 font-mono text-xs text-[#bbbbbb] break-all">{row.id}</td>
                <td className="py-3 px-3">
                  <a
                    href={row.relativeUrl}
                    className="text-blue-400 hover:underline break-all font-mono text-xs"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {row.absoluteUrl}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="text-[#999999] mt-6">No galleries in the database yet.</p>
      )}
    </div>
  );
}

async function loadGalleryRows() {
  const db = getDatabase();

  const galleries = await db.select().from(curation).orderBy(desc(curation.createdAt));

  const itemCountRows = await db
    .select({
      curationId: curationItems.curationId,
      itemCount: count(),
    })
    .from(curationItems)
    .groupBy(curationItems.curationId);

  const itemCountByGallery = new Map(itemCountRows.map((r) => [r.curationId, Number(r.itemCount)]));

  const curatorKeys = [...new Set(galleries.map((g) => g.curatorAddress.toLowerCase()))];
  const usernameByCurator = new Map<string, string | null>();
  await Promise.all(
    curatorKeys.map(async (addr) => {
      const cached = await getUserFromCache(addr);
      usernameByCurator.set(addr, cached?.username ?? null);
    })
  );

  const sortedByCurator = new Map<string, typeof galleries>();
  for (const g of galleries) {
    const k = g.curatorAddress.toLowerCase();
    if (!sortedByCurator.has(k)) sortedByCurator.set(k, []);
    sortedByCurator.get(k)!.push(g);
  }
  for (const list of sortedByCurator.values()) {
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  const indexByGalleryId = new Map<string, number>();
  for (const list of sortedByCurator.values()) {
    list.forEach((g, i) => indexByGalleryId.set(g.id, i + 1));
  }

  const base = APP_URL.replace(/\/$/, "");

  return galleries.map((g) => {
    const curatorKey = g.curatorAddress.toLowerCase();
    const username = usernameByCurator.get(curatorKey) ?? null;
    const galleryIndex = indexByGalleryId.get(g.id) ?? 1;
    const itemCount = itemCountByGallery.get(g.id) ?? 0;

    const relativeUrl = g.isPublished
      ? getGalleryUrl(g, username, g.slug ? undefined : galleryIndex)
      : `/curate/${g.id}`;

    const absoluteUrl = `${base}${relativeUrl}`;

    return {
      id: g.id,
      title: g.title,
      isPublished: g.isPublished,
      itemCount,
      curatorAddress: g.curatorAddress,
      username,
      relativeUrl,
      absoluteUrl,
    };
  });
}
