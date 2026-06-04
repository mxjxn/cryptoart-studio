import {
  getDatabase,
  homepageSpotlightListings,
  homepageSpotlightSettings,
  asc,
  eq,
} from "@cryptoart/db";
import {
  HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS,
  mergeSpotlightCopy,
  type HomepageSpotlightCopy,
} from "~/lib/homepage-spotlight-defaults";

export type HomepageSpotlightPin = {
  listingId: string;
  chainId: number;
};

export type HomepageSpotlightConfig = {
  cardsVisible: boolean;
  pins: HomepageSpotlightPin[];
  copy: HomepageSpotlightCopy;
};

const SETTINGS_ROW_ID = "default";

function rowToCopy(row: {
  sectionTitle?: string | null;
  sectionSubline?: string | null;
  eyebrow?: string | null;
  headline?: string | null;
  description?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
} | null | undefined): HomepageSpotlightCopy {
  if (!row) return mergeSpotlightCopy(null);
  return mergeSpotlightCopy({
    sectionTitle: row.sectionTitle ?? undefined,
    sectionSubline: row.sectionSubline ?? undefined,
    eyebrow: row.eyebrow ?? undefined,
    headline: row.headline ?? undefined,
    description: row.description ?? undefined,
    ctaLabel: row.ctaLabel ?? undefined,
    ctaHref: row.ctaHref ?? undefined,
  });
}

async function ensureSpotlightSettingsRow() {
  const db = getDatabase();
  const d = HOMEPAGE_SPOTLIGHT_COPY_DEFAULTS;
  await db
    .insert(homepageSpotlightSettings)
    .values({
      id: SETTINGS_ROW_ID,
      cardsVisible: false,
      sectionTitle: d.sectionTitle,
      sectionSubline: d.sectionSubline,
      eyebrow: d.eyebrow,
      headline: d.headline,
      description: d.description,
      ctaLabel: d.ctaLabel,
      ctaHref: d.ctaHref,
    })
    .onConflictDoNothing({ target: homepageSpotlightSettings.id });
}

export async function getHomepageSpotlightConfig(): Promise<HomepageSpotlightConfig> {
  try {
    const db = getDatabase();
    await ensureSpotlightSettingsRow();

    const [settings] = await db
      .select()
      .from(homepageSpotlightSettings)
      .where(eq(homepageSpotlightSettings.id, SETTINGS_ROW_ID))
      .limit(1);

    const rows = await db
      .select()
      .from(homepageSpotlightListings)
      .orderBy(asc(homepageSpotlightListings.displayOrder));

    return {
      cardsVisible: settings?.cardsVisible ?? false,
      pins: rows.map((r) => ({ listingId: r.listingId, chainId: r.chainId })),
      copy: rowToCopy(settings),
    };
  } catch (error) {
    console.error("[homepage-spotlight] Failed to load config:", error);
    return {
      cardsVisible: false,
      pins: [],
      copy: mergeSpotlightCopy(null),
    };
  }
}

export async function updateHomepageSpotlightSettings(input: {
  cardsVisible?: boolean;
  copy?: Partial<HomepageSpotlightCopy>;
}): Promise<void> {
  const db = getDatabase();
  await ensureSpotlightSettingsRow();

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof input.cardsVisible === "boolean") {
    patch.cardsVisible = input.cardsVisible;
  }
  if (input.copy) {
    const c = input.copy;
    if (c.sectionTitle !== undefined) patch.sectionTitle = c.sectionTitle.trim();
    if (c.sectionSubline !== undefined) patch.sectionSubline = c.sectionSubline.trim();
    if (c.eyebrow !== undefined) patch.eyebrow = c.eyebrow.trim();
    if (c.headline !== undefined) patch.headline = c.headline.trim();
    if (c.description !== undefined) patch.description = c.description.trim();
    if (c.ctaLabel !== undefined) patch.ctaLabel = c.ctaLabel.trim();
    if (c.ctaHref !== undefined) patch.ctaHref = c.ctaHref.trim();
  }

  await db
    .update(homepageSpotlightSettings)
    .set(patch)
    .where(eq(homepageSpotlightSettings.id, SETTINGS_ROW_ID));
}

/** @deprecated use updateHomepageSpotlightSettings */
export async function setHomepageSpotlightCardsVisible(cardsVisible: boolean): Promise<void> {
  await updateHomepageSpotlightSettings({ cardsVisible });
}
