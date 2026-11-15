import {
  buildExactPaymentHeader,
  exactAuthorization,
  type X402Accepts,
} from '@cryptoart/media/client';

export function randomPaymentNonce(): `0x${string}` {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return `0x${hex}`;
}

type SignTypedData = (args: {
  domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
  types: {
    TransferWithAuthorization: Array<{ name: string; type: string }>;
  };
  primaryType: 'TransferWithAuthorization';
  message: {
    from: `0x${string}`;
    to: `0x${string}`;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    nonce: `0x${string}`;
  };
}) => Promise<`0x${string}`>;

/** EIP-3009 USDC authorization, encoded as the x402 v2 PAYMENT-SIGNATURE header. */
export async function signExactUsdcPayment(input: {
  requirement: X402Accepts;
  from: `0x${string}`;
  signTypedData: SignTypedData;
}): Promise<string> {
  const chainId = Number(input.requirement.network.split(':')[1]);
  if (!Number.isInteger(chainId)) throw new Error(`Unsupported payment network ${input.requirement.network}`);
  const nonce = randomPaymentNonce();
  const authorization = exactAuthorization({
    requirement: input.requirement,
    from: input.from,
    nowSeconds: Math.floor(Date.now() / 1000),
    nonce,
  });
  const signature = await input.signTypedData({
    domain: {
      name: input.requirement.extra.name ?? 'USDC',
      version: input.requirement.extra.version ?? '2',
      chainId,
      verifyingContract: input.requirement.asset as `0x${string}`,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: input.from,
      to: authorization.to as `0x${string}`,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce,
    },
  });
  return buildExactPaymentHeader({ requirement: input.requirement, authorization, signature });
}

export function chainIdFromNetwork(network: string) {
  const chainId = Number(network.split(':')[1]);
  return Number.isInteger(chainId) ? chainId : null;
}
