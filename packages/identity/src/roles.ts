import { CAPABILITIES, type Capability, type Role, type RoleGrant } from './types';

const ROLE_DEFAULTS: Record<Role, string[]> = {
  owner: [CAPABILITIES.ALL],
  admin: [
    CAPABILITIES.ROLES_MANAGE,
    CAPABILITIES.MARKETPLACE_OPERATE,
    CAPABILITIES.EXHIBITION_PUBLISH,
    CAPABILITIES.HOMEPAGE_PUBLISH,
    CAPABILITIES.GALLERY_MANAGE,
  ],
  editor: [CAPABILITIES.EXHIBITION_PUBLISH, CAPABILITIES.MARKETPLACE_OPERATE],
  curator: [],
};

export function isRole(value: string): value is Role {
  return value === 'owner' || value === 'admin' || value === 'editor' || value === 'curator';
}

export function activeGrants(grants: RoleGrant[], at = new Date()) {
  return grants.filter((grant) => {
    if (grant.revokedAt) return false;
    if (grant.expiresAt && Date.parse(grant.expiresAt) <= at.getTime()) return false;
    return true;
  });
}

export function hasCapability(grants: RoleGrant[], capability: Capability) {
  const live = activeGrants(grants);
  if (live.some((grant) => grant.role === 'owner' || grant.capability === CAPABILITIES.ALL)) {
    return true;
  }
  if (live.some((grant) => grant.capability === capability)) return true;
  return live.some((grant) => {
    if (grant.role === 'curator') return false;
    return ROLE_DEFAULTS[grant.role].includes(capability);
  });
}

export function curatorDirectoryRow(address: string, grants: RoleGrant[]) {
  const live = activeGrants(grants).filter((grant) => grant.walletAddress === address);
  const feed = live.find((grant) => grant.capability === CAPABILITIES.FEED_WEIGHT);
  return {
    walletAddress: address,
    roles: [...new Set(live.map((grant) => grant.role))],
    feedWeight: typeof feed?.scope?.weight === 'number' ? feed.scope.weight : 0,
    galleryManage: live.some((grant) => grant.capability === CAPABILITIES.GALLERY_MANAGE),
    exhibitionSubmit: live.some((grant) => grant.capability === CAPABILITIES.EXHIBITION_SUBMIT),
    homepagePublish: live.some((grant) => grant.capability === CAPABILITIES.HOMEPAGE_PUBLISH),
    grants: live,
  };
}

export function assertCanGrant(actor: RoleGrant[], input: { role: Role; capability: string }) {
  if (hasCapability(actor, CAPABILITIES.ALL)) return;
  if (!hasCapability(actor, CAPABILITIES.ROLES_MANAGE)) {
    throw new Error('Missing roles.manage');
  }
  if (input.role === 'owner') throw new Error('Only the owner can grant owner');
}
