import { MiniAppNotificationDetails } from '@farcaster/miniapp-sdk';
import { buildKey, get, set, del } from '@cryptoart/shared-db-config';
import { APP_NAME } from './constants';

function getUserNotificationDetailsKey(fid: number): string {
  return buildKey(APP_NAME, `user:${fid}`);
}

export async function getUserNotificationDetails(
  fid: number
): Promise<MiniAppNotificationDetails | null> {
  const key = getUserNotificationDetailsKey(fid);
  return await get<MiniAppNotificationDetails>(key);
}

export async function setUserNotificationDetails(
  fid: number,
  notificationDetails: MiniAppNotificationDetails
): Promise<void> {
  const key = getUserNotificationDetailsKey(fid);
  await set(key, notificationDetails);
}

export async function deleteUserNotificationDetails(
  fid: number
): Promise<void> {
  const key = getUserNotificationDetailsKey(fid);
  await del(key);
}
