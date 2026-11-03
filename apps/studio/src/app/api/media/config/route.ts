import { NextResponse } from 'next/server';

export async function GET() {
  const isProd = process.env.NODE_ENV === 'production';
  const allowMock =
    process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT === 'true'
      ? true
      : process.env.CRYPTOART_MEDIA_ALLOW_MOCK_PAYMENT === 'false'
        ? false
        : !isProd;

  return NextResponse.json({
    allowMockPayment: allowMock,
    hasTurbo: Boolean(process.env.TURBO_PRIVATE_KEY),
    hasFacilitator: Boolean(process.env.X402_FACILITATOR_URL),
    network: process.env.CRYPTOART_MEDIA_NETWORK ?? null,
  });
}
