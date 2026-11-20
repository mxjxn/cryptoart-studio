import { NextResponse } from 'next/server';
import {
  BASE_NETWORK,
  BASE_SEPOLIA_NETWORK,
  DEFAULT_TURBO_UPLOAD_URL,
  resolveAllowMockPayment,
} from '@cryptoart/media';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isProd = process.env.NODE_ENV === 'production';
  const allowMock = resolveAllowMockPayment({
    CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT: process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT,
    NODE_ENV: process.env.NODE_ENV,
  });
  const network = process.env.CRYPTOART_MEDIA_NETWORK ?? (isProd ? BASE_NETWORK : BASE_SEPOLIA_NETWORK);
  const uploadMode = allowMock && !isProd ? 'simulated' : 'turbo-x402';

  return NextResponse.json({
    allowMockPayment: allowMock,
    network,
    uploadMode,
    turboUploadUrl: process.env.CRYPTOART_MEDIA_TURBO_UPLOAD_URL ?? DEFAULT_TURBO_UPLOAD_URL,
  });
}