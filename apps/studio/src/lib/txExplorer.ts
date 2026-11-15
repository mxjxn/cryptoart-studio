export function txExplorerUrl(chainId: number, hash: string) {
  if (chainId === 84532) return `https://sepolia.basescan.org/tx/${hash}`;
  if (chainId === 8453) return `https://basescan.org/tx/${hash}`;
  if (chainId === 1) return `https://etherscan.io/tx/${hash}`;
  return null;
}
