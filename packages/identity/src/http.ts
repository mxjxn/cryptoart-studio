import type { CookieOptions, PlatformRequest, PlatformResponse } from './types';

export function parseCookies(header?: string) {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    cookies[trimmed.slice(0, eq)] = decodeURIComponent(trimmed.slice(eq + 1));
  }
  return cookies;
}

export function serializeCookie(name: string, value: string, options: CookieOptions) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`,
  ];
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function applyCookies(response: PlatformResponse, header: { append: (name: string, value: string) => void } | { setHeader: (name: string, value: string | string[]) => void }) {
  const cookies = (response.setCookies ?? []).map((cookie) => serializeCookie(cookie.name, cookie.value, cookie.options));
  if (!cookies.length) return;
  if ('append' in header) {
    for (const cookie of cookies) header.append('Set-Cookie', cookie);
    return;
  }
  header.setHeader('Set-Cookie', cookies);
}

export function toPlatformRequest(input: {
  method: string;
  url: string | URL;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}): PlatformRequest {
  const url = input.url instanceof URL ? input.url : new URL(input.url, 'http://localhost');
  const headers: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(input.headers)) {
    headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return {
    method: input.method,
    pathname: url.pathname,
    url,
    headers: { ...headers, host: headers.host },
    body: input.body,
    cookies: parseCookies(headers.cookie),
  };
}

export type { PlatformRequest, PlatformResponse };
