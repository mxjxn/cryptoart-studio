import { NextResponse } from 'next/server';
import { quoteUpload } from '@cryptoart/media';

export async function GET() {
  const isProd = process.env.NODE_ENV === 'production';
  const allowMock =
    process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT === 'true'
      ? true
      : process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT === 'false'
        ? false
        : !isProd;

  const maxFileSize = process.env.CRYPTOART_MEDIA_MAX_FILE_SIZE
    ? parseInt(process.env.CRYPTOART_MEDIA_MAX_FILE_SIZE, 10)
    : 100 * 1024 * 1024;

  const tempTtlSeconds = process.env.CRYPTOART_MEDIA_TEMP_TTL_SECONDS
    ? parseInt(process.env.CRYPTOART_MEDIA_TEMP_TTL_SECONDS, 10)
    : 3600;

  return NextResponse.json({
    allowMockPayment: allowMock,
    hasTurbo: Boolean(process.env.TURBO_PRIVATE_KEY || process.env.ARWEAVE_JWK),
    hasFacilitator: Boolean(process.env.X402_FACILITATOR_URL),
    network: process.env.CRYPTOART_MEDIA_NETWORK ?? null,
    uploaderType: process.env.ARWEAVE_UPLOADER || 'turbo',
    maxFileSize,
    maxFileSizeMB: Math.floor(maxFileSize / 1024 / 1024),
    tempUploadTtlSeconds: tempTtlSeconds,
  });
}
