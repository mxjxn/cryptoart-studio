export const SESSION_COOKIE = 'cryptoart_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const NONCE_TTL_MS = 10 * 60 * 1000;

export const ROLES = ['owner', 'admin', 'editor', 'curator'] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITIES = {
  ALL: '*',
  ROLES_MANAGE: 'roles.manage',
  EXHIBITION_PUBLISH: 'exhibition.publish',
  EXHIBITION_SUBMIT: 'exhibition.submit',
  GALLERY_MANAGE: 'gallery.manage',
  FEED_WEIGHT: 'feed.weight',
  HOMEPAGE_PUBLISH: 'homepage.publish',
  MARKETPLACE_OPERATE: 'marketplace.operate',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES] | string;

export type RoleGrant = {
  id: string;
  walletAddress: string;
  role: Role;
  capability: string;
  scope: Record<string, unknown> | null;
  grantedBy: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
};

export type SessionRecord = {
  id: string;
  tokenHash: string;
  address: string;
  chainId: number;
  fid: number | null;
  domain: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type AuditEvent = {
  id: string;
  occurredAt: string;
  actorAddress: string;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown> | null;
};

export type ExhibitionItemInput = {
  position: number;
  caption?: string;
  chainId: number;
  contractAddress: string;
  tokenId: string;
  listingId?: string;
  title: string;
  artist?: string;
  previewUrl?: string;
  canonicalUrl?: string;
};

export type ExhibitionRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  curatorAddress: string;
  curatorLabel: string | null;
  status: 'draft' | 'published' | 'unpublished';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  unpublishedAt: string | null;
  items: Array<ExhibitionItemInput & { id: string }>;
};

export type ExhibitionSlot = {
  slotKey: string;
  exhibitionId: string | null;
  assignedBy: string | null;
  assignedAt: string | null;
  scheduledAt: string | null;
};

export type SiweNonce = {
  nonce: string;
  address: string;
  domain: string;
  uri: string;
  chainId: number;
  issuedAt: string;
  expiresAt: string;
  consumedAt: string | null;
};

export type CookieOptions = {
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
  secure: boolean;
};

export type PlatformRequest = {
  method: string;
  pathname: string;
  url: URL;
  headers: Record<string, string | undefined>;
  body: unknown;
  cookies: Record<string, string>;
};

export type PlatformResponse = {
  status: number;
  body: unknown;
  setCookies?: Array<{ name: string; value: string; options: CookieOptions }>;
};
