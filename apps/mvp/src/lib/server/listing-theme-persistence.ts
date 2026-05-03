import {
  getDatabase,
  listingSellerTheme,
  listingThemeOverride,
  eq,
} from "@cryptoart/db";
import type { ListingThemeData } from "~/lib/listing-theme";
import { validateListingTheme } from "~/lib/listing-theme";

function parseStoredTheme(raw: unknown): ListingThemeData | null {
  const v = validateListingTheme(raw);
  return v.ok ? v.theme : null;
}

export async function getSellerDefaultThemeRow(
  sellerAddressLower: string
): Promise<ListingThemeData | null> {
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(listingSellerTheme)
    .where(eq(listingSellerTheme.sellerAddress, sellerAddressLower))
    .limit(1);
  if (!row) return null;
  return parseStoredTheme(row.theme);
}

export async function upsertSellerDefaultTheme(
  sellerAddressLower: string,
  theme: ListingThemeData
): Promise<void> {
  const db = getDatabase();
  await db
    .insert(listingSellerTheme)
    .values({
      sellerAddress: sellerAddressLower,
      theme,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: listingSellerTheme.sellerAddress,
      set: { theme, updatedAt: new Date() },
    });
}

export async function getListingThemeOverrideRow(
  listingId: string
): Promise<{ sellerAddress: string; theme: ListingThemeData } | null> {
  const db = getDatabase();
  const [row] = await db
    .select()
    .from(listingThemeOverride)
    .where(eq(listingThemeOverride.listingId, listingId))
    .limit(1);
  if (!row) return null;
  const theme = parseStoredTheme(row.theme);
  if (!theme) return null;
  return { sellerAddress: row.sellerAddress.toLowerCase(), theme };
}

export async function upsertListingThemeOverride(
  listingId: string,
  sellerAddressLower: string,
  theme: ListingThemeData
): Promise<void> {
  const db = getDatabase();
  await db
    .insert(listingThemeOverride)
    .values({
      listingId,
      sellerAddress: sellerAddressLower,
      theme,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: listingThemeOverride.listingId,
      set: {
        sellerAddress: sellerAddressLower,
        theme,
        updatedAt: new Date(),
      },
    });
}

export async function deleteListingThemeOverride(listingId: string): Promise<void> {
  const db = getDatabase();
  await db.delete(listingThemeOverride).where(eq(listingThemeOverride.listingId, listingId));
}
