import { NextResponse } from 'next/server';

export async function GET() {
  const isVercelProduction = process.env.VERCEL_ENV === 'production';
  
  // Never allow mock payment in Vercel production
  let allowMock = false;
  if (!isVercelProduction) {
    if (process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT === 'true') {
      allowMock = true;
    } else if (process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT === 'false') {
      allowMock = false;
    }
    // else: default to false
  }

  const maxFileSize = process.env.CRYPTOART_MEDIA_MAX_FILE_SIZE
    ? parseInt(process.env.CRYPTOART_MEDIA_MAX_FILE_SIZE, 10)
    : 100 * 1024 * 1024;

  const tempTtlSeconds = process.env.CRYPTOART_MEDIA_TEMP_TTL_SECONDS
    ? parseInt(process.env.CRYPTOART_MEDIA_TEMP_TTL_SECONDS, 10)
    : 604800; // 7 days default

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
