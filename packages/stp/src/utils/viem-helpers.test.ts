import { describe, it, expect } from 'vitest';
import { isSubscriptionActive, getRemainingTime } from './viem-helpers.js';
import type { SubscriptionView } from '../types/index.js';

describe('viem-helpers', () => {
  describe('isSubscriptionActive', () => {
    it('should return true for non-expired subscription', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400; // +1 day
      const subscription: SubscriptionView = {
        tierId: 1,
        tokenId: 1n,
        expiresAt: futureTimestamp,
        purchaseExpiresAt: futureTimestamp,
        rewardShares: 0n,
        rewardBalance: 0n,
      };

      expect(isSubscriptionActive(subscription)).toBe(true);
    });

    it('should return false for expired subscription', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 86400; // -1 day
      const subscription: SubscriptionView = {
        tierId: 1,
        tokenId: 1n,
        expiresAt: pastTimestamp,
        purchaseExpiresAt: pastTimestamp,
        rewardShares: 0n,
        rewardBalance: 0n,
      };

      expect(isSubscriptionActive(subscription)).toBe(false);
    });

    it('should return false for subscription expiring right now', () => {
      const nowTimestamp = Math.floor(Date.now() / 1000);
      const subscription: SubscriptionView = {
        tierId: 1,
        tokenId: 1n,
        expiresAt: nowTimestamp,
        purchaseExpiresAt: nowTimestamp,
        rewardShares: 0n,
        rewardBalance: 0n,
      };

      expect(isSubscriptionActive(subscription)).toBe(false);
    });
  });

  describe('getRemainingTime', () => {
    it('should return correct remaining seconds for active subscription', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // +1 hour
      const subscription: SubscriptionView = {
        tierId: 1,
        tokenId: 1n,
        expiresAt: futureTimestamp,
        purchaseExpiresAt: futureTimestamp,
        rewardShares: 0n,
        rewardBalance: 0n,
      };

      const remaining = getRemainingTime(subscription);
      expect(remaining).toBeGreaterThan(3500); // Allow some test execution time
      expect(remaining).toBeLessThanOrEqual(3600);
    });

    it('should return 0 for expired subscription', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // -1 hour
      const subscription: SubscriptionView = {
        tierId: 1,
        tokenId: 1n,
        expiresAt: pastTimestamp,
        purchaseExpiresAt: pastTimestamp,
        rewardShares: 0n,
        rewardBalance: 0n,
      };

      expect(getRemainingTime(subscription)).toBe(0);
    });
  });
});
