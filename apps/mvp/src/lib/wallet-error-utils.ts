export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
}

function walkErrorChain(error: unknown): Array<{ code?: unknown; message?: string }> {
  const nodes: Array<{ code?: unknown; message?: string }> = [];
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
      data?: { originalError?: { code?: unknown; message?: unknown } };
    };
    nodes.push({
      code: record.code ?? record.data?.originalError?.code,
      message:
        typeof record.message === "string"
          ? record.message
          : typeof record.data?.originalError?.message === "string"
            ? record.data.originalError.message
            : undefined,
    });
    current = record.cause;
  }

  return nodes;
}

/** EIP-1193 4902: the wallet does not have this chain and must be asked to add it. */
export function isUnrecognizedChainError(error: unknown): boolean {
  return walkErrorChain(error).some((node) => {
    if (node.code === 4902 || node.code === "4902") return true;
    return typeof node.message === "string" &&
      /unrecognized chain|chain not added|wallet_addethereumchain|\b4902\b/i.test(node.message);
  });
}

export function isChainSwitchErrorMessage(message: string | null | undefined): boolean {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("switchchain") ||
    normalized.includes("switch chain") ||
    normalized.includes("wallet_switchethereumchain") ||
    normalized.includes("wallet_addethereumchain") ||
    normalized.includes("unrecognized chain") ||
    normalized.includes("chain not added") ||
    normalized.includes("4902") ||
    normalized.includes("getchainid") ||
    normalized.includes("connector not connected") ||
    normalized.includes("no connector")
  );
}

export function getActionableWalletErrorMessage(
  error: unknown,
  fallback: string,
  targetNetworkLabel?: string
): string {
  const message = getErrorMessage(error, fallback);

  if (!isChainSwitchErrorMessage(message) && !isUnrecognizedChainError(error)) {
    return message;
  }

  if (targetNetworkLabel) {
    return `Couldn't switch your wallet to ${targetNetworkLabel}. Try again, or open this listing in your browser.`;
  }

  return message;
}
