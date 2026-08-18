export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
}

export function isChainSwitchErrorMessage(message: string | null | undefined): boolean {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("switchchain") ||
    normalized.includes("wallet_switchethereumchain") ||
    normalized.includes("getchainid") ||
    normalized.includes("connector")
  );
}

export function getActionableWalletErrorMessage(
  error: unknown,
  fallback: string,
  targetNetworkLabel?: string
): string {
  const message = getErrorMessage(error, fallback);

  if (!isChainSwitchErrorMessage(message)) {
    return message;
  }

  if (targetNetworkLabel) {
    return `Couldn't switch your wallet to ${targetNetworkLabel}. Try again, or open this listing in your browser.`;
  }

  return message;
}
