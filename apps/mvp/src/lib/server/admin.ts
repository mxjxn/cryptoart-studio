import { ADMIN_CONFIG, ALL_ADMIN_ADDRESSES } from '~/lib/constants';

/**
 * Check if an address is an admin address (primary or additional).
 * @param address - Wallet address to check
 * @returns boolean indicating if the address is an admin
 */
export function isAdminAddress(address: string | undefined | null): boolean {
  if (!address) return false;
  const normalizedAddress = address.toLowerCase();
  return ALL_ADMIN_ADDRESSES.some(adminAddr => adminAddr.toLowerCase() === normalizedAddress);
}

/**
 * Middleware helper for API routes that require admin access.
 * Throws an error if the address is not an admin.
 * @param address - Wallet address to verify
 * @throws Error if not an admin
 */
export function requireAdmin(address: string | undefined | null): void {
  if (!isAdminAddress(address)) {
    throw new Error('Unauthorized: Admin access required');
  }
}

/**
 * Verify admin status and return a response-friendly result.
 * @param address - Wallet address to verify
 * @returns Object with isAdmin boolean and optional error message
 */
export function verifyAdmin(address: string | undefined | null): { 
  isAdmin: boolean; 
  error?: string;
} {
  if (!address) {
    return { isAdmin: false, error: 'No address provided' };
  }
  
  const isAdmin = isAdminAddress(address);
  
  if (!isAdmin) {
    return { isAdmin: false, error: 'Unauthorized: Admin access required' };
  }
  
  return { isAdmin: true };
}

