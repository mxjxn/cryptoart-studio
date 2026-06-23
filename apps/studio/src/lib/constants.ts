const getBaseUrl = (): string => {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

export const APP_URL = getBaseUrl();
export const APP_NAME = 'cryptoart.studio';
export const APP_DESCRIPTION =
  'On-chain artist dashboard for deploying collections, minting work, and managing contracts.';
export const APP_ICON_URL = `${APP_URL}/icon.png`;

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '21fef48091f12692cad574a6f7753643';

export const ANALYTICS_ENABLED = true;
export const RETURN_URL: string | undefined = undefined;
