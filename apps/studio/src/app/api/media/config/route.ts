import { NextResponse } from 'next/server';
import { BASE_NETWORK, BASE_SEPOLIA_NETWORK, resolveAllowMockPayment } from '@cryptoart/media';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isProd = process.env.NODE_ENV === 'production';
  const allowMock = resolveAllowMockPayment({
    CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT: process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT,
    NODE_ENV: process.env.NODE_ENV,
  });
  const uploadMode = process.env.TURBO_PRIVATE_KEY
    ? 'turbo'
    : isProd
      ? 'unconfigured'
      : 'simulated';

  return NextResponse.json({
    allowMockPayment: allowMock,
    hasTurbo: Boolean(process.env.TURBO_PRIVATE_KEY),
    hasFacilitator: Boolean(process.env.X402_FACILITATOR_URL),
    network: process.env.CRYPTOART_MEDIA_NETWORK ?? (isProd ? BASE_NETWORK : BASE_SEPOLIA_NETWORK),
    uploadMode,
  });
}
