export type NormalizedListingType =
  | "INDIVIDUAL_AUCTION"
  | "FIXED_PRICE"
  | "DYNAMIC_PRICE"
  | "OFFERS_ONLY";

/**
 * Normalize listingType from subgraph numeric or string values.
 * Shared client/server helper — keep free of server-only imports.
 */
export function normalizeListingType(
  listingType: string | number | undefined,
  listing?: { lazy?: boolean }
): NormalizedListingType {
  const typeFromNumber = (num: number): NormalizedListingType => {
    switch (num) {
      case 0:
        return "INDIVIDUAL_AUCTION";
      case 1:
        return "INDIVIDUAL_AUCTION";
      case 2:
        return "FIXED_PRICE";
      case 3:
        return "DYNAMIC_PRICE";
      case 4:
        return "OFFERS_ONLY";
      default:
        return "INDIVIDUAL_AUCTION";
    }
  };

  if (typeof listingType === "number") {
    const result = typeFromNumber(listingType);
    if (result === "DYNAMIC_PRICE" && listing && listing.lazy === false) {
      return "FIXED_PRICE";
    }
    return result;
  }

  const typeStr = String(listingType || "").trim();
  const numericValue = parseInt(typeStr, 10);
  if (!isNaN(numericValue) && String(numericValue) === typeStr) {
    const result = typeFromNumber(numericValue);
    if (result === "DYNAMIC_PRICE" && listing && listing.lazy === false) {
      return "FIXED_PRICE";
    }
    return result;
  }

  const upperTypeStr = typeStr.toUpperCase();
  if (upperTypeStr === "DYNAMIC_PRICE" && listing && listing.lazy === false) {
    return "FIXED_PRICE";
  }

  if (
    upperTypeStr === "INDIVIDUAL_AUCTION" ||
    upperTypeStr === "FIXED_PRICE" ||
    upperTypeStr === "DYNAMIC_PRICE" ||
    upperTypeStr === "OFFERS_ONLY"
  ) {
    return upperTypeStr as NormalizedListingType;
  }

  return "INDIVIDUAL_AUCTION";
}
