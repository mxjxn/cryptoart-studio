// NOTE: This cache package is currently not used - focusing on basics (Creator Core & Auctionhouse)
// All methods are commented out. Uncomment when implementing subscription features.

// import { eq, and, lt } from 'drizzle-orm';
// import { 
//   getDatabase, 
//   subscriptionsCache, 
//   subscribersCache,
//   type SubscriptionCacheData,
//   type SubscriberCacheData 
// } from '@repo/db';

// export class HypersubCache {
//   private db = getDatabase();

//   /**
//    * Get cached subscriptions for a user
//    * Returns null if not found or expired (1 hour TTL)
//    */
//   async getSubscriptions(fid: number): Promise<SubscriptionCacheData[] | null> {
//     try {
//       const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
//       const result = await this.db
//         .select()
//         .from(subscriptionsCache)
//         .where(
//           and(
//             eq(subscriptionsCache.fid, fid),
//             // Only return if cached within the last hour
//             lt(subscriptionsCache.cachedAt, oneHourAgo)
//           )
//         )
//         .orderBy(subscriptionsCache.cachedAt);

//       if (result.length === 0) {
//         return null;
//       }

//       // Return the most recent cache entry
//       return result[result.length - 1].metadata as SubscriptionCacheData[];
//     } catch (error) {
//       console.error('Error fetching cached subscriptions:', error);
//       return null;
//     }
//   }

//   /**
//    * Cache subscriptions for a user with 1 hour TTL
//    */
//   async setSubscriptions(fid: number, data: SubscriptionCacheData[]): Promise<void> {
//     try {
//       // First, delete any existing cache entries for this fid
//       await this.db
//         .delete(subscriptionsCache)
//         .where(eq(subscriptionsCache.fid, fid));

//       // Insert new cache entries
//       for (const subscription of data) {
//         await this.db.insert(subscriptionsCache).values({
//           fid,
//           contractAddress: subscription.contract_address,
//           metadata: subscription,
//           cachedAt: new Date(),
//         });
//       }
//     } catch (error) {
//       console.error('Error caching subscriptions:', error);
//       throw error;
//     }
//   }

//   /**
//    * Get cached subscribers for a specific subscription
//    * Returns null if not found or expired (15 minutes TTL)
//    */
//   async getSubscribers(fid: number, contractAddress: string): Promise<SubscriberCacheData[] | null> {
//     try {
//       const result = await this.db
//         .select()
//         .from(subscribersCache)
//         .where(
//           and(
//             eq(subscribersCache.fid, fid),
//             eq(subscribersCache.contractAddress, contractAddress),
//             // Only return if not expired
//             lt(subscribersCache.expiresAt, new Date())
//           )
//         )
//         .orderBy(subscribersCache.cachedAt);

//       if (result.length === 0) {
//         return null;
//       }

//       // Return the most recent cache entry
//       return result[result.length - 1].subscriberData as SubscriberCacheData[];
//     } catch (error) {
//       console.error('Error fetching cached subscribers:', error);
//       return null;
//     }
//   }

//   /**
//    * Cache subscribers for a specific subscription with 15 minute TTL
//    */
//   async setSubscribers(fid: number, contractAddress: string, data: SubscriberCacheData[]): Promise<void> {
//     try {
//       const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

//       // First, delete any existing cache entries for this fid + contract
//       await this.db
//         .delete(subscribersCache)
//         .where(
//           and(
//             eq(subscribersCache.fid, fid),
//             eq(subscribersCache.contractAddress, contractAddress)
//           )
//         );

//       // Insert new cache entry
//       await this.db.insert(subscribersCache).values({
//         fid,
//         contractAddress,
//         subscriberData: data,
//         subscriberCount: data.length,
//         cachedAt: new Date(),
//         expiresAt,
//       });
//     } catch (error) {
//       console.error('Error caching subscribers:', error);
//       throw error;
//     }
//   }

//   /**
//    * Invalidate all subscription cache entries for a user
//    */
//   async invalidateSubscriptions(fid: number): Promise<void> {
//     try {
//       await this.db
//         .delete(subscriptionsCache)
//         .where(eq(subscriptionsCache.fid, fid));
//     } catch (error) {
//       console.error('Error invalidating subscription cache:', error);
//       throw error;
//     }
//   }

//   /**
//    * Invalidate subscriber cache entries for a user
//    * If contractAddress is provided, only invalidate that specific contract
//    */
//   async invalidateSubscribers(fid: number, contractAddress?: string): Promise<void> {
//     try {
//       if (contractAddress) {
//         await this.db
//           .delete(subscribersCache)
//           .where(
//             and(
//               eq(subscribersCache.fid, fid),
//               eq(subscribersCache.contractAddress, contractAddress)
//             )
//           );
//       } else {
//         await this.db
//           .delete(subscribersCache)
//           .where(eq(subscribersCache.fid, fid));
//       }
//     } catch (error) {
//       console.error('Error invalidating subscriber cache:', error);
//       throw error;
//     }
//   }

//   /**
//    * Clean up expired cache entries
//    * Should be called periodically to keep the database clean
//    */
//   async cleanupExpiredEntries(): Promise<void> {
//     try {
//       const now = new Date();
      
//       // Delete expired subscriber cache entries
//       await this.db
//         .delete(subscribersCache)
//         .where(lt(subscribersCache.expiresAt, now));

//       // Delete subscription cache entries older than 24 hours
//       const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
//       await this.db
//         .delete(subscriptionsCache)
//         .where(lt(subscriptionsCache.cachedAt, oneDayAgo));
//     } catch (error) {
//       console.error('Error cleaning up expired cache entries:', error);
//       throw error;
//     }
//   }
// }

// // Export singleton instance
// export const hypersubCache = new HypersubCache();

// Placeholder export to prevent import errors
export const hypersubCache = {
  getSubscriptions: async () => null,
  setSubscriptions: async () => {},
  getSubscribers: async () => null,
  setSubscribers: async () => {},
  invalidateSubscriptions: async () => {},
  invalidateSubscribers: async () => {},
  cleanupExpiredEntries: async () => {},
};
