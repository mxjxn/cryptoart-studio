import { ImageResponse } from 'next/og';
import { APP_NAME } from '~/lib/constants';

export const alt = 'Membership';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 60,
          background: 'black',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 20 }}>{APP_NAME}</div>
        <div style={{ fontSize: 30, color: '#cccccc' }}>Membership</div>
      </div>
    ),
    {
      ...size,
    }
  );
}

